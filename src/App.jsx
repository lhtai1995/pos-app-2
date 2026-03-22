import React, { useState, useEffect } from 'react';
import { BarChart3, Home, Settings, Plus, Trash2, X, Edit2, Check,
  Search, Cloud, CloudOff, RefreshCw, ChevronDown, ChevronUp, FolderPlus } from 'lucide-react';

// ──────────────────────────────────────────────
// GOOGLE SHEETS API
// ──────────────────────────────────────────────
const GS_URL = 'https://script.google.com/macros/s/AKfycbzigqPwXPuR1j98CeX8YGrRZpPApXYmGtxotIdsWJGIbB38Gf0ATE0FPcufTElS-Fpo0A/exec';

const gsGet = async (action) => {
  const res = await fetch(`${GS_URL}?action=${action}`);
  return res.json();
};

const gsPost = async (action, payload) => {
  const res = await fetch(GS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, payload }),
  });
  return res.json();
};

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────
const STORAGE_KEYS = {
  MENU: 'dol_menu_items',
  TOPPING_GROUPS: 'dol_topping_groups',
  ORDERS: 'dol_orders',
};

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
const formatPrice = (p) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const loadFromStorage = (key) => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
  catch { return null; }
};
const saveToStorage = (key, data) => localStorage.setItem(key, JSON.stringify(data));

// ──────────────────────────────────────────────
// APP
// ──────────────────────────────────────────────
export default function App() {
  // ── Core state ──
  const [activeTab, setActiveTab] = useState('order');
  const [menuItems, setMenuItems] = useState([]);
  const [toppingGroups, setToppingGroups] = useState([]); // [{ id, name, items: [{id,name,price}] }]
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cloudStatus, setCloudStatus] = useState('idle');

  // ── Order states ──
  const [currentOrder, setCurrentOrder] = useState([]);
  const [showToppingSheet, setShowToppingSheet] = useState(false);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState(null);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);

  // ── Menu management states ──
  const [menuView, setMenuView] = useState('list');
  const [editingItem, setEditingItem] = useState(null);
  const [menuTab, setMenuTab] = useState('items');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});

  // ── Menu item form ──
  const [form, setForm] = useState({ category: '', name: '', price: '', applicableToppingGroups: [] });

  // ── Topping group form ──
  const [groupForm, setGroupForm] = useState({ name: '' });
  const [toppingForm, setToppingForm] = useState({ name: '', price: '', groupId: '' });

  // ─────────────────────────────────────────────
  // DERIVED: flat list of all toppings (from groups)
  // ─────────────────────────────────────────────
  const allToppings = toppingGroups.flatMap(g => g.items);

  // ─────────────────────────────────────────────
  // INIT DATA
  // ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setCloudStatus('syncing');
      try {
        // ── Menu ──
        const gsMenu = await gsGet('getMenu');
        if (gsMenu?.length > 0) {
          const parsed = gsMenu.map(r => ({
            id: generateId(), category: r.category, name: r.name,
            price: Number(r.price),
            applicableToppingGroups: (() => { try { return JSON.parse(r.applicableToppingGroups || '[]'); } catch { return []; } })(),
          }));
          setMenuItems(parsed);
          saveToStorage(STORAGE_KEYS.MENU, parsed);
        } else {
          const saved = loadFromStorage(STORAGE_KEYS.MENU);
          if (saved?.length > 0) { setMenuItems(saved); await gsPost('syncMenu', saved); }
        }

        // ── Topping Groups ──
        // Try load from localStorage first (groups are managed locally + sheet backup)
        const savedGroups = loadFromStorage(STORAGE_KEYS.TOPPING_GROUPS);
        if (savedGroups?.length > 0) {
          setToppingGroups(savedGroups);
        } else {
          // Try to migrate old flat toppings into 1 default group
          const gsToppings = await gsGet('getToppings');
          if (gsToppings?.length > 0) {
            const defaultGroup = {
              id: generateId(), name: 'Topping',
              items: gsToppings.map(t => ({ id: generateId(), name: t.name, price: Number(t.price) })),
            };
            const groups = [defaultGroup];
            setToppingGroups(groups);
            saveToStorage(STORAGE_KEYS.TOPPING_GROUPS, groups);
          }
        }

        // ── Orders (today) ──
        const gsOrders = await gsGet('getTodayOrders');
        if (gsOrders?.length > 0 && !gsOrders.error) {
          setOrders(gsOrders);
          saveToStorage(STORAGE_KEYS.ORDERS, gsOrders);
        } else {
          const saved = loadFromStorage(STORAGE_KEYS.ORDERS);
          if (saved) setOrders(saved);
        }

        setCloudStatus('ok');
      } catch (err) {
        console.error('Init failed, using cache', err);
        setCloudStatus('error');
        const m = loadFromStorage(STORAGE_KEYS.MENU);
        const g = loadFromStorage(STORAGE_KEYS.TOPPING_GROUPS);
        const o = loadFromStorage(STORAGE_KEYS.ORDERS);
        if (m) setMenuItems(m);
        if (g) setToppingGroups(g);
        if (o) setOrders(o);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  // ── Auto-refresh orders when on report tab ──
  const fetchTodayOrders = async (silent = false) => {
    if (!silent) setIsRefreshingOrders(true);
    try {
      const gs = await gsGet('getTodayOrders');
      if (gs && !gs.error) setOrders(gs);
    } catch {}
    if (!silent) setIsRefreshingOrders(false);
  };

  useEffect(() => {
    if (activeTab !== 'report') return;
    fetchTodayOrders();
    const t = setInterval(() => fetchTodayOrders(true), 60000);
    return () => clearInterval(t);
  }, [activeTab]);

  // ─────────────────────────────────────────────
  // ORDER LOGIC
  // ─────────────────────────────────────────────
  const handleAddItem = (item) => {
    setSelectedItemToAdd(item);
    setSelectedToppings([]);
    setShowToppingSheet(true);
  };

  const toggleTopping = (topping) => {
    setSelectedToppings(prev =>
      prev.find(t => t.id === topping.id)
        ? prev.filter(t => t.id !== topping.id)
        : [...prev, topping]
    );
  };

  const confirmAddItem = () => {
    const toppingTotal = selectedToppings.reduce((s, t) => s + t.price, 0);
    const newItem = {
      ...selectedItemToAdd,
      cartId: generateId(),
      toppings: [...selectedToppings],
      totalPrice: selectedItemToAdd.price + toppingTotal,
    };
    setCurrentOrder(prev => [...prev, newItem]);
    setShowToppingSheet(false);
  };

  // Thêm lại cùng món vào đơn (nhanh, không qua topping sheet)
  const quickReAdd = (cartItem) => {
    setSelectedItemToAdd(cartItem);
    setSelectedToppings([]);
    setShowToppingSheet(true);
  };

  const removeCartItem = (cartId) => {
    setCurrentOrder(prev => prev.filter(i => i.cartId !== cartId));
  };

  const completeOrder = async () => {
    if (!currentOrder.length) return;
    const newOrder = {
      id: generateId(),
      items: currentOrder,
      total: currentOrder.reduce((s, i) => s + i.totalPrice, 0),
      timestamp: new Date().toISOString(),
    };
    setOrders(prev => [newOrder, ...prev]);
    saveToStorage(STORAGE_KEYS.ORDERS, [newOrder, ...orders]);
    setCurrentOrder([]);
    try {
      setCloudStatus('syncing');
      await gsPost('addOrder', newOrder);
      setCloudStatus('ok');
    } catch { setCloudStatus('error'); }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Xóa giao dịch này?')) return;
    const updated = orders.filter(o => o.id !== orderId);
    setOrders(updated);
    saveToStorage(STORAGE_KEYS.ORDERS, updated);
    try {
      setCloudStatus('syncing');
      await gsPost('deleteOrder', { id: orderId });
      setCloudStatus('ok');
    } catch { setCloudStatus('error'); }
  };

  // ─────────────────────────────────────────────
  // MENU ITEM CRUD
  // ─────────────────────────────────────────────
  const saveMenuItem = async () => {
    if (!form.name.trim() || !form.category.trim() || !form.price) return;
    const price = parseInt(form.price, 10);
    const payload = {
      category: form.category.trim(), name: form.name.trim(),
      price, applicableToppingGroups: form.applicableToppingGroups,
    };
    try {
      setCloudStatus('syncing');
      if (editingItem) {
        setMenuItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...payload } : i));
        await gsPost('updateMenuItem', { originalName: editingItem.name, originalCategory: editingItem.category, ...payload });
      } else {
        const newItem = { id: generateId(), ...payload };
        setMenuItems(prev => [...prev, newItem]);
        await gsPost('addMenuItem', { ...payload, applicableToppingGroups: JSON.stringify(payload.applicableToppingGroups) });
      }
      setCloudStatus('ok');
    } catch { setCloudStatus('error'); }
    setForm({ category: '', name: '', price: '', applicableToppingGroups: [] });
    setEditingItem(null);
    setMenuView('list');
  };

  const deleteMenuItem = async (id) => {
    const item = menuItems.find(i => i.id === id);
    setMenuItems(prev => prev.filter(i => i.id !== id));
    try { setCloudStatus('syncing'); await gsPost('deleteMenuItem', { name: item.name, category: item.category }); setCloudStatus('ok'); }
    catch { setCloudStatus('error'); }
  };

  const startEditItem = (item) => {
    setEditingItem(item);
    setForm({ category: item.category, name: item.name, price: String(item.price), applicableToppingGroups: item.applicableToppingGroups || [] });
    setMenuView('editItem');
  };

  // ─────────────────────────────────────────────
  // TOPPING GROUP CRUD
  // ─────────────────────────────────────────────
  const saveGroup = () => {
    if (!groupForm.name.trim()) return;
    let updated;
    if (editingItem?.type === 'group') {
      updated = toppingGroups.map(g => g.id === editingItem.id ? { ...g, name: groupForm.name.trim() } : g);
    } else {
      updated = [...toppingGroups, { id: generateId(), name: groupForm.name.trim(), items: [] }];
    }
    setToppingGroups(updated);
    saveToStorage(STORAGE_KEYS.TOPPING_GROUPS, updated);
    setGroupForm({ name: '' });
    setEditingItem(null);
    setMenuView('list');
  };

  const deleteGroup = (groupId) => {
    if (!window.confirm('Xóa nhóm topping này?')) return;
    const updated = toppingGroups.filter(g => g.id !== groupId);
    setToppingGroups(updated);
    saveToStorage(STORAGE_KEYS.TOPPING_GROUPS, updated);
  };

  const saveToppingToGroup = () => {
    if (!toppingForm.name.trim() || !toppingForm.price || !toppingForm.groupId) return;
    const price = parseInt(toppingForm.price, 10);
    let updated;
    if (editingItem?.type === 'topping') {
      updated = toppingGroups.map(g => ({
        ...g,
        items: g.items.map(t => t.id === editingItem.id ? { ...t, name: toppingForm.name.trim(), price } : t),
      }));
    } else {
      updated = toppingGroups.map(g =>
        g.id === toppingForm.groupId
          ? { ...g, items: [...g.items, { id: generateId(), name: toppingForm.name.trim(), price }] }
          : g
      );
    }
    setToppingGroups(updated);
    saveToStorage(STORAGE_KEYS.TOPPING_GROUPS, updated);
    setToppingForm({ name: '', price: '', groupId: '' });
    setEditingItem(null);
    setMenuView('list');
  };

  const deleteToppingFromGroup = (groupId, toppingId) => {
    const updated = toppingGroups.map(g =>
      g.id === groupId ? { ...g, items: g.items.filter(t => t.id !== toppingId) } : g
    );
    setToppingGroups(updated);
    saveToStorage(STORAGE_KEYS.TOPPING_GROUPS, updated);
  };

  // ─────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────
  const categories = [...new Set(menuItems.map(i => i.category))];

  const filteredItems = searchQuery
    ? menuItems.filter(i =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : menuItems;

  const filteredByCategory = categories.reduce((acc, cat) => {
    const items = filteredItems.filter(i => i.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const todayOrders = orders.filter(
    o => new Date(o.timestamp).toDateString() === new Date().toDateString()
  );
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const todayCount = todayOrders.reduce((s, o) => s + o.items.length, 0);
  const currentOrderTotal = currentOrder.reduce((s, i) => s + i.totalPrice, 0);

  // Cloud badge
  const CloudBadge = () => {
    if (cloudStatus === 'syncing') return <span className="cloud-badge syncing"><RefreshCw size={12} className="spin" /> Đang sync...</span>;
    if (cloudStatus === 'ok') return <span className="cloud-badge ok"><Cloud size={12} /> Đã lưu</span>;
    if (cloudStatus === 'error') return <span className="cloud-badge error"><CloudOff size={12} /> Offline</span>;
    return null;
  };

  // ─────────────────────────────────────────────
  // RENDER: ORDER TAB
  // ─────────────────────────────────────────────
  const renderOrderTab = () => (
    <div className="order-tab">
      <header className="header">
        <div className="header-row">
          <h2>Bán hàng</h2>
          <CloudBadge />
        </div>
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input
            className="search-input"
            placeholder="Tìm món..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="order-body">
        {isLoading ? (
          <div className="loading-state">Đang tải menu...</div>
        ) : Object.keys(filteredByCategory).length === 0 ? (
          <p className="empty-state">Không tìm thấy món nào</p>
        ) : (
          Object.entries(filteredByCategory).map(([cat, items]) => (
            <div key={cat} className="category-section">
              <button
                className="category-header"
                onClick={() => setExpandedCategories(p => ({ ...p, [cat]: !p[cat] }))}
              >
                <span className="cat-name">{cat}</span>
                <span className="cat-meta">
                  <span className="cat-count">{items.length}</span>
                  {expandedCategories[cat] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>

              {!expandedCategories[cat] && (
                <div className="item-grid">
                  {items.map(item => (
                    <div key={item.id} className="menu-card" onClick={() => handleAddItem(item)}>
                      <div className="menu-card-info">
                        <p className="item-name">{item.name}</p>
                        <p className="item-price">{formatPrice(item.price)}</p>
                      </div>
                      <button className="add-btn"><Plus size={20} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Current Order Bar */}
      {currentOrder.length > 0 && (
        <div className="current-order-bar">
          {/* Mini order list */}
          <div className="mini-order-list">
            {currentOrder.map(item => (
              <div key={item.cartId} className="mini-order-item">
                <span className="mini-item-name">
                  {item.name}
                  {item.toppings.length > 0 && (
                    <span className="mini-toppings"> · {item.toppings.map(t => t.name).join(', ')}</span>
                  )}
                </span>
                <div className="mini-item-actions">
                  <span className="mini-item-price">{formatPrice(item.totalPrice)}</span>
                  <button className="mini-re-add" onClick={() => quickReAdd(item)} title="Thêm ly này nữa">
                    <Plus size={12} />
                  </button>
                  <button className="mini-delete" onClick={() => removeCartItem(item.cartId)} title="Xóa">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="order-footer">
            <span className="order-total-label">{currentOrder.length} ly · <strong>{formatPrice(currentOrderTotal)}</strong></span>
            <button className="checkout-btn" onClick={completeOrder}>Thanh toán</button>
          </div>
        </div>
      )}

      {/* Topping Bottom Sheet */}
      {showToppingSheet && (() => {
        const appGroupIds = selectedItemToAdd?.applicableToppingGroups || [];
        const visibleGroups = appGroupIds.length > 0
          ? toppingGroups.filter(g => appGroupIds.includes(g.id))
          : toppingGroups;
        const visibleToppings = visibleGroups.flatMap(g => g.items);
        const toppingTotal = selectedToppings.reduce((s, t) => s + t.price, 0);

        return (
          <div className="bottom-sheet-overlay" onClick={() => setShowToppingSheet(false)}>
            <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
              <div className="sheet-header">
                <div>
                  <h3>Chọn topping</h3>
                  <p>{selectedItemToAdd?.name}</p>
                </div>
                <button className="sheet-close" onClick={() => setShowToppingSheet(false)}>
                  <X size={20} />
                </button>
              </div>

              {visibleToppings.length === 0 ? (
                <p className="empty-state" style={{ padding: '16px' }}>Món này không có topping</p>
              ) : (
                <div className="topping-list">
                  {/* Group by group name */}
                  {visibleGroups.map(group => (
                    group.items.length > 0 && (
                      <div key={group.id} className="topping-group-section">
                        <p className="topping-group-label">{group.name}</p>
                        {group.items.map(topping => {
                          const isSelected = selectedToppings.find(t => t.id === topping.id);
                          return (
                            <div
                              key={topping.id}
                              className={`topping-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => toggleTopping(topping)}
                            >
                              <span>{topping.name}</span>
                              <div className="topping-right">
                                <span>+{formatPrice(topping.price)}</span>
                                {isSelected && <Check size={16} className="check-icon" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ))}
                </div>
              )}

              <div className="sheet-preview">
                <span>{selectedItemToAdd?.name}</span>
                {selectedToppings.map(t => (
                  <span key={t.id} className="preview-topping">+ {t.name}</span>
                ))}
              </div>

              <button className="confirm-btn" onClick={confirmAddItem}>
                Thêm vào đơn — {formatPrice((selectedItemToAdd?.price || 0) + toppingTotal)}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ─────────────────────────────────────────────
  // RENDER: REPORT TAB
  // ─────────────────────────────────────────────
  const renderReportTab = () => (
    <div className="report-tab">
      <header className="header">
        <div className="header-row">
          <div>
            <h2>Báo cáo Hôm nay</h2>
            <p className="header-sub">
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button
            className={`refresh-btn ${isRefreshingOrders ? 'spinning' : ''}`}
            onClick={() => fetchTodayOrders()}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <div className="report-body">
        <div className="report-summary">
          <div className="summary-card total"><p>Doanh thu</p><h3>{formatPrice(todayRevenue)}</h3></div>
          <div className="summary-card count"><p>Ly đã bán</p><h3>{todayCount} ly</h3></div>
          <div className="summary-card orders"><p>Đơn hàng</p><h3>{todayOrders.length} đơn</h3></div>
        </div>

        <div className="recent-orders">
          <h3>Giao dịch gần đây</h3>
          {todayOrders.length === 0 ? (
            <p className="empty-state">Chưa có giao dịch nào hôm nay</p>
          ) : (
            todayOrders.map(order => (
              <div key={order.id} className="transaction-card">
                <div className="tx-header">
                  <span className="tx-time">
                    {new Date(order.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="tx-header-right">
                    <span className="tx-total">{formatPrice(order.total)}</span>
                    <button className="tx-delete-btn" onClick={() => deleteOrder(order.id)} title="Xóa giao dịch">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="tx-items">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="tx-item">
                      <span>{item.name}</span>
                      {item.toppings?.length > 0 && (
                        <span className="tx-toppings">+ {item.toppings.map(t => t.name).join(', ')}</span>
                      )}
                      <span className="tx-item-price">{formatPrice(item.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // RENDER: MENU MANAGEMENT TAB
  // ─────────────────────────────────────────────

  // Form thêm/sửa MenuItem
  if (menuView === 'addItem' || menuView === 'editItem') {
    const isEdit = menuView === 'editItem';
    return (
      <div className="app-container">
        <main className="main-content">
          <div className="form-page">
            <header className="header header-with-back">
              <button className="back-btn" onClick={() => { setMenuView('list'); setEditingItem(null); setForm({ category: '', name: '', price: '', applicableToppingGroups: [] }); }}>
                <X size={20} />
              </button>
              <h2>{isEdit ? 'Chỉnh sửa món' : 'Thêm món mới'}</h2>
              <div style={{ width: 36 }} />
            </header>
            <div className="form-body">
              <div className="form-group">
                <label>Danh mục</label>
                <input className="form-input" placeholder="VD: Coffee, Trà Trái Cây..."
                  value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  list="cat-list" />
                <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="form-group">
                <label>Tên món</label>
                <input className="form-input" placeholder="VD: Matcha Latte - L"
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Giá (VNĐ)</label>
                <input className="form-input" type="number" placeholder="VD: 35000"
                  value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
              </div>

              {/* Chọn nhóm topping */}
              {toppingGroups.length > 0 && (
                <div className="form-group">
                  <label>Nhóm topping áp dụng</label>
                  <p className="form-hint">Chỉ nhóm được tick mới hiện khi log món</p>
                  <div className="topping-checklist">
                    {toppingGroups.map(group => {
                      const checked = (form.applicableToppingGroups || []).includes(group.id);
                      return (
                        <label key={group.id} className={`topping-check-item ${checked ? 'checked' : ''}`}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            setForm(p => ({
                              ...p,
                              applicableToppingGroups: checked
                                ? p.applicableToppingGroups.filter(id => id !== group.id)
                                : [...p.applicableToppingGroups, group.id],
                            }));
                          }} />
                          <div className="topping-check-info">
                            <span className="topping-check-name">{group.name}</span>
                            <span className="topping-check-sub">{group.items.map(t => t.name).join(', ') || 'Chưa có topping'}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <button className="save-btn" onClick={saveMenuItem}>
                <Check size={18} /> {isEdit ? 'Lưu thay đổi' : 'Thêm món'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Form thêm nhóm topping
  if (menuView === 'addGroup' || menuView === 'editGroup') {
    return (
      <div className="app-container">
        <main className="main-content">
          <div className="form-page">
            <header className="header header-with-back">
              <button className="back-btn" onClick={() => { setMenuView('list'); setEditingItem(null); setGroupForm({ name: '' }); }}>
                <X size={20} />
              </button>
              <h2>{menuView === 'editGroup' ? 'Sửa nhóm' : 'Thêm nhóm topping'}</h2>
              <div style={{ width: 36 }} />
            </header>
            <div className="form-body">
              <div className="form-group">
                <label>Tên nhóm</label>
                <input className="form-input" placeholder="VD: Trân Châu, Thạch, Kem..."
                  value={groupForm.name} onChange={e => setGroupForm({ name: e.target.value })} />
              </div>
              <button className="save-btn" onClick={saveGroup}>
                <Check size={18} /> {menuView === 'editGroup' ? 'Lưu' : 'Tạo nhóm'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Form thêm topping vào nhóm
  if (menuView === 'addTopping' || menuView === 'editTopping') {
    const isEdit = menuView === 'editTopping';
    return (
      <div className="app-container">
        <main className="main-content">
          <div className="form-page">
            <header className="header header-with-back">
              <button className="back-btn" onClick={() => { setMenuView('list'); setEditingItem(null); setToppingForm({ name: '', price: '', groupId: '' }); }}>
                <X size={20} />
              </button>
              <h2>{isEdit ? 'Sửa topping' : 'Thêm topping'}</h2>
              <div style={{ width: 36 }} />
            </header>
            <div className="form-body">
              {!isEdit && (
                <div className="form-group">
                  <label>Nhóm</label>
                  <select className="form-input" value={toppingForm.groupId}
                    onChange={e => setToppingForm(p => ({ ...p, groupId: e.target.value }))}>
                    <option value="">-- Chọn nhóm --</option>
                    {toppingGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Tên topping</label>
                <input className="form-input" placeholder="VD: Trân Châu Trắng"
                  value={toppingForm.name} onChange={e => setToppingForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Giá (VNĐ)</label>
                <input className="form-input" type="number" placeholder="VD: 5000"
                  value={toppingForm.price} onChange={e => setToppingForm(p => ({ ...p, price: e.target.value }))} />
              </div>
              <button className="save-btn" onClick={saveToppingToGroup}>
                <Check size={18} /> {isEdit ? 'Lưu' : 'Thêm vào nhóm'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Main Menu Management Tab
  const renderMenuTab = () => (
    <div className="menu-mgmt-tab">
      <header className="header"><h2>Quản lý Menu</h2></header>

      <div className="sub-tabs">
        <button className={`sub-tab ${menuTab === 'items' ? 'active' : ''}`} onClick={() => setMenuTab('items')}>
          Thực đơn ({menuItems.length})
        </button>
        <button className={`sub-tab ${menuTab === 'toppings' ? 'active' : ''}`} onClick={() => setMenuTab('toppings')}>
          Nhóm Topping ({toppingGroups.length})
        </button>
      </div>

      {menuTab === 'items' && (
        <div className="mgmt-list">
          <button className="add-new-btn" onClick={() => setMenuView('addItem')}>
            <Plus size={18} /> Thêm món mới
          </button>
          {categories.map(cat => {
            const items = menuItems.filter(i => i.category === cat);
            return (
              <div key={cat} className="mgmt-category">
                <div className="mgmt-cat-header">
                  <span className="mgmt-cat-name">{cat}</span>
                  <span className="mgmt-cat-count">{items.length} món</span>
                </div>
                {items.map(item => (
                  <div key={item.id} className="mgmt-item">
                    <div className="mgmt-item-info">
                      <p className="mgmt-item-name">{item.name}</p>
                      <p className="mgmt-item-price">{formatPrice(item.price)}</p>
                      {item.applicableToppingGroups?.length > 0 && (
                        <p className="mgmt-item-groups">
                          {item.applicableToppingGroups.map(gid => toppingGroups.find(g => g.id === gid)?.name).filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="mgmt-item-actions">
                      <button className="action-btn edit" onClick={() => startEditItem(item)}><Edit2 size={15} /></button>
                      <button className="action-btn delete" onClick={() => deleteMenuItem(item.id)}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {menuTab === 'toppings' && (
        <div className="mgmt-list">
          <button className="add-new-btn" onClick={() => setMenuView('addGroup')}>
            <FolderPlus size={18} /> Thêm nhóm topping
          </button>

          {toppingGroups.length === 0 && (
            <p className="empty-state">Chưa có nhóm topping nào. Tạo nhóm trước nhé!</p>
          )}

          {toppingGroups.map(group => (
            <div key={group.id} className="topping-group-card">
              <div className="topping-group-header">
                <button
                  className="group-toggle"
                  onClick={() => setExpandedGroups(p => ({ ...p, [group.id]: !p[group.id] }))}
                >
                  <span className="group-name">📦 {group.name}</span>
                  <span className="group-meta">
                    <span className="group-count">{group.items.length} topping</span>
                    {expandedGroups[group.id] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </span>
                </button>
                <div className="group-actions">
                  <button className="action-btn edit" onClick={() => {
                    setEditingItem({ ...group, type: 'group' });
                    setGroupForm({ name: group.name });
                    setMenuView('editGroup');
                  }}><Edit2 size={14} /></button>
                  <button className="action-btn delete" onClick={() => deleteGroup(group.id)}><Trash2 size={14} /></button>
                </div>
              </div>

              {expandedGroups[group.id] && (
                <div className="group-topping-list">
                  {group.items.map(t => (
                    <div key={t.id} className="mgmt-item">
                      <div className="mgmt-item-info">
                        <p className="mgmt-item-name">{t.name}</p>
                        <p className="mgmt-item-price">{formatPrice(t.price)}</p>
                      </div>
                      <div className="mgmt-item-actions">
                        <button className="action-btn edit" onClick={() => {
                          setEditingItem({ ...t, type: 'topping', groupId: group.id });
                          setToppingForm({ name: t.name, price: String(t.price), groupId: group.id });
                          setMenuView('editTopping');
                        }}><Edit2 size={15} /></button>
                        <button className="action-btn delete" onClick={() => deleteToppingFromGroup(group.id, t.id)}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                  <button className="add-topping-to-group-btn" onClick={() => {
                    setToppingForm({ name: '', price: '', groupId: group.id });
                    setMenuView('addTopping');
                  }}>
                    <Plus size={14} /> Thêm topping vào nhóm
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────
  // ROOT RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="app-container">
      <main className="main-content">
        {activeTab === 'order' && renderOrderTab()}
        {activeTab === 'report' && renderReportTab()}
        {activeTab === 'menu' && renderMenuTab()}
      </main>
      <nav className="bottom-nav">
        <button className={`nav-item ${activeTab === 'order' ? 'active' : ''}`} onClick={() => setActiveTab('order')}>
          <Home size={24} /><span>Bán hàng</span>
        </button>
        <button className={`nav-item ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>
          <BarChart3 size={24} /><span>Báo cáo</span>
        </button>
        <button className={`nav-item ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => setActiveTab('menu')}>
          <Settings size={24} /><span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
