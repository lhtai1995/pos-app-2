import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { BarChart3, Home, Settings, Plus, Trash2, ChevronDown, ChevronUp, X, Edit2, Check, Search, Cloud, CloudOff, RefreshCw } from 'lucide-react';

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
  TOPPINGS: 'dol_toppings',
  ORDERS: 'dol_orders',
  SYNCED: 'dol_gs_synced', // flag đã sync lên Sheet chưa
};

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
const formatPrice = (price) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const loadFromStorage = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ──────────────────────────────────────────────
// CSV FETCHER
// ──────────────────────────────────────────────
const fetchAndParseCSV = (url) =>
  new Promise((resolve, reject) => {
    fetch(url)
      .then((r) => r.text())
      .then((text) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => resolve(result.data),
        });
      })
      .catch(reject);
  });

// ──────────────────────────────────────────────
// APP
// ──────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('order');
  const [menuItems, setMenuItems] = useState([]);
  const [toppings, setToppings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cloudStatus, setCloudStatus] = useState('idle'); // idle | syncing | ok | error

  // Order states
  const [currentOrder, setCurrentOrder] = useState([]);
  const [showToppingSheet, setShowToppingSheet] = useState(false);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState(null);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Menu management states
  const [menuView, setMenuView] = useState('list');
  const [editingItem, setEditingItem] = useState(null);
  const [menuTab, setMenuTab] = useState('items');

  // Form state
  const [form, setForm] = useState({ category: '', name: '', price: '', applicableToppings: [] });
  const [toppingForm, setToppingForm] = useState({ name: '', price: '' });
  const [expandedCategories, setExpandedCategories] = useState({});
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [orderQty, setOrderQty] = useState(1);

  // ── LOAD DATA ──
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      setCloudStatus('syncing');

      try {
        // Load Menu từ Google Sheets
        const gsMenu = await gsGet('getMenu');
        if (gsMenu && gsMenu.length > 0) {
          // Sheet đã có data → dùng từ Sheet
          const parsed = gsMenu.map((r) => ({
            id: generateId(),
            category: r.category,
            name: r.name,
            price: Number(r.price),
          }));
          setMenuItems(parsed);
          saveToStorage(STORAGE_KEYS.MENU, parsed);
        } else {
          // Sheet trống → sync từ localStorage hoặc CSV lên Sheet
          const savedMenu = loadFromStorage(STORAGE_KEYS.MENU);
          let menuToSync = savedMenu;

          if (!menuToSync || menuToSync.length === 0) {
            // Load từ CSV
            const rows = await fetchAndParseCSV('/Menu.csv');
            menuToSync = rows
              .filter((r) => r['Tên Món'] && r['Danh mục'])
              .map((r) => ({
                id: generateId(),
                category: r['Danh mục'].trim(),
                name: r['Tên Món'].trim(),
                price: parseInt(r['Giá'] || 0, 10),
              }));
          }

          setMenuItems(menuToSync);
          saveToStorage(STORAGE_KEYS.MENU, menuToSync);
          // Sync lên Sheet
          await gsPost('syncMenu', menuToSync);
        }

        // Load Toppings từ Google Sheets
        const gsToppings = await gsGet('getToppings');
        if (gsToppings && gsToppings.length > 0) {
          const parsed = gsToppings.map((r) => ({
            id: generateId(),
            name: r.name,
            price: Number(r.price),
          }));
          setToppings(parsed);
          saveToStorage(STORAGE_KEYS.TOPPINGS, parsed);
        } else {
          const savedToppings = loadFromStorage(STORAGE_KEYS.TOPPINGS);
          let toppingsToSync = savedToppings;

          if (!toppingsToSync || toppingsToSync.length === 0) {
            const rows = await fetchAndParseCSV('/Toppings.csv');
            toppingsToSync = rows
              .filter((r) => r['Tên Topping'])
              .map((r) => ({
                id: generateId(),
                name: r['Tên Topping'].trim(),
                price: parseInt(r['Giá'] || 0, 10),
              }));
          }

          setToppings(toppingsToSync);
          saveToStorage(STORAGE_KEYS.TOPPINGS, toppingsToSync);
          await gsPost('syncToppings', toppingsToSync);
        }

        // Load Orders từ Google Sheets
        const gsOrders = await gsGet('getOrders');
        if (gsOrders && gsOrders.length > 0) {
          setOrders(gsOrders);
          saveToStorage(STORAGE_KEYS.ORDERS, gsOrders);
        } else {
          const savedOrders = loadFromStorage(STORAGE_KEYS.ORDERS);
          if (savedOrders) setOrders(savedOrders);
        }

        setCloudStatus('ok');
      } catch (err) {
        console.error('Google Sheets load failed, using local cache', err);
        setCloudStatus('error');
        // Fallback: dùng localStorage
        const savedMenu = loadFromStorage(STORAGE_KEYS.MENU);
        const savedToppings = loadFromStorage(STORAGE_KEYS.TOPPINGS);
        const savedOrders = loadFromStorage(STORAGE_KEYS.ORDERS);
        if (savedMenu) setMenuItems(savedMenu);
        if (savedToppings) setToppings(savedToppings);
        if (savedOrders) setOrders(savedOrders);
      }

      setIsLoading(false);
    };

    initData();
  }, []);

  // ── FETCH ORDERS (always fresh from Sheet) ──
  const fetchTodayOrders = async (silent = false) => {
    if (!silent) setIsRefreshingOrders(true);
    try {
      const gsOrders = await gsGet('getTodayOrders');
      if (gsOrders && !gsOrders.error) {
        setOrders(gsOrders);
      }
    } catch (e) {
      console.error('Fetch orders failed', e);
    }
    if (!silent) setIsRefreshingOrders(false);
  };

  // Fetch orders khi switch sang tab Báo cáo + auto-refresh 60s
  useEffect(() => {
    if (activeTab !== 'report') return;
    fetchTodayOrders();
    const interval = setInterval(() => fetchTodayOrders(true), 60000);
    return () => clearInterval(interval);
  }, [activeTab]);
  // ── ORDER LOGIC ──
  const handleAddItemToCurrentOrder = (item) => {
    setSelectedItemToAdd(item);
    setSelectedToppings([]);
    setOrderQty(1);
    setShowToppingSheet(true);
  };

  const toggleTopping = (topping) => {
    setSelectedToppings((prev) =>
      prev.find((t) => t.id === topping.id)
        ? prev.filter((t) => t.id !== topping.id)
        : [...prev, topping]
    );
  };

  const confirmAddItem = () => {
    const unitPrice = selectedItemToAdd.price + selectedToppings.reduce((s, t) => s + t.price, 0);
    const newItem = {
      ...selectedItemToAdd,
      cartId: generateId(),
      toppings: [...selectedToppings],
      quantity: orderQty,
      totalPrice: unitPrice * orderQty,
    };
    setCurrentOrder((prev) => [...prev, newItem]);
    setShowToppingSheet(false);
  };

  const removeCurrentOrderItem = (cartId) => {
    setCurrentOrder((prev) => prev.filter((i) => i.cartId !== cartId));
  };

  const completeOrder = async () => {
    if (!currentOrder.length) return;
    const newOrder = {
      id: generateId(),
      items: currentOrder,
      total: currentOrder.reduce((s, i) => s + i.totalPrice, 0),
      timestamp: new Date().toISOString(),
    };
    setOrders((prev) => [newOrder, ...prev]);
    saveToStorage(STORAGE_KEYS.ORDERS, [newOrder, ...orders]);
    setCurrentOrder([]);
    try {
      setCloudStatus('syncing');
      await gsPost('addOrder', newOrder);
      setCloudStatus('ok');
    } catch {
      setCloudStatus('error');
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Xóa giao dịch này?')) return;
    const updated = orders.filter((o) => o.id !== orderId);
    setOrders(updated);
    saveToStorage(STORAGE_KEYS.ORDERS, updated);
    try {
      setCloudStatus('syncing');
      await gsPost('deleteOrder', { id: orderId });
      setCloudStatus('ok');
    } catch {
      setCloudStatus('error');
    }
  };

  // ── MENU CRUD ──
  const saveMenuItem = async () => {
    if (!form.name.trim() || !form.category.trim() || !form.price) return;
    const price = parseInt(form.price, 10);
    try {
      setCloudStatus('syncing');
      if (editingItem) {
        setMenuItems((prev) =>
          prev.map((i) => i.id === editingItem.id ? {
            ...i,
            category: form.category.trim(),
            name: form.name.trim(),
            price,
            applicableToppings: form.applicableToppings,
          } : i)
        );
        await gsPost('updateMenuItem', {
          originalName: editingItem.name,
          originalCategory: editingItem.category,
          category: form.category.trim(),
          name: form.name.trim(),
          price,
          applicableToppings: form.applicableToppings,
        });
      } else {
        const newItem = {
          id: generateId(),
          category: form.category.trim(),
          name: form.name.trim(),
          price,
          applicableToppings: form.applicableToppings,
        };
        setMenuItems((prev) => [...prev, newItem]);
        await gsPost('addMenuItem', newItem);
      }
      setCloudStatus('ok');
    } catch {
      setCloudStatus('error');
    }
    setForm({ category: '', name: '', price: '', applicableToppings: [] });
    setEditingItem(null);
    setMenuView('list');
  };

  const deleteMenuItem = async (id) => {
    const item = menuItems.find((i) => i.id === id);
    setMenuItems((prev) => prev.filter((i) => i.id !== id));
    try {
      setCloudStatus('syncing');
      await gsPost('deleteMenuItem', { name: item.name, category: item.category });
      setCloudStatus('ok');
    } catch {
      setCloudStatus('error');
    }
  };

  const startEditItem = (item) => {
    setEditingItem(item);
    setForm({
      category: item.category,
      name: item.name,
      price: String(item.price),
      applicableToppings: item.applicableToppings || [],
    });
    setMenuView('editItem');
  };

  const saveTopping = async () => {
    if (!toppingForm.name.trim() || !toppingForm.price) return;
    const price = parseInt(toppingForm.price, 10);
    try {
      setCloudStatus('syncing');
      if (editingItem) {
        setToppings((prev) =>
          prev.map((t) => t.id === editingItem.id ? { ...t, name: toppingForm.name.trim(), price } : t)
        );
        await gsPost('updateTopping', { originalName: editingItem.name, name: toppingForm.name.trim(), price });
      } else {
        const newT = { id: generateId(), name: toppingForm.name.trim(), price };
        setToppings((prev) => [...prev, newT]);
        await gsPost('addTopping', newT);
      }
      setCloudStatus('ok');
    } catch {
      setCloudStatus('error');
    }
    setToppingForm({ name: '', price: '' });
    setEditingItem(null);
    setMenuView('list');
  };

  const deleteTopping = async (id) => {
    const topping = toppings.find((t) => t.id === id);
    setToppings((prev) => prev.filter((t) => t.id !== id));
    try {
      setCloudStatus('syncing');
      await gsPost('deleteTopping', { name: topping.name });
      setCloudStatus('ok');
    } catch {
      setCloudStatus('error');
    }
  };

  const startEditTopping = (topping) => {
    setEditingItem(topping);
    setToppingForm({ name: topping.name, price: String(topping.price) });
    setMenuView('editTopping');
  };

  // ── COMPUTED ──
  const categories = [...new Set(menuItems.map((i) => i.category))];

  const filteredItems = searchQuery
    ? menuItems.filter((i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : menuItems;

  const filteredByCategory = categories.reduce((acc, cat) => {
    const items = filteredItems.filter((i) => i.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const todayOrders = orders.filter(
    (o) => new Date(o.timestamp).toDateString() === new Date().toDateString()
  );
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const todayCount = todayOrders.reduce((s, o) => s + o.items.length, 0);

  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const currentOrderTotal = currentOrder.reduce((s, i) => s + i.totalPrice, 0);

  // Cloud status badge
  const CloudBadge = () => {
    if (cloudStatus === 'syncing') return (
      <span className="cloud-badge syncing"><RefreshCw size={12} className="spin" /> Đang sync...</span>
    );
    if (cloudStatus === 'ok') return (
      <span className="cloud-badge ok"><Cloud size={12} /> Đã lưu</span>
    );
    if (cloudStatus === 'error') return (
      <span className="cloud-badge error"><CloudOff size={12} /> Offline</span>
    );
    return null;
  };

  // ──────────────────────────────────────────────
  // RENDER: ORDER TAB
  // ──────────────────────────────────────────────
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
            type="text"
            placeholder="Tìm món..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </header>

      <div className="menu-list">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Đang tải menu...</p>
          </div>
        ) : Object.keys(filteredByCategory).length === 0 ? (
          <p className="empty-state">Không tìm thấy món nào</p>
        ) : (
          Object.entries(filteredByCategory).map(([cat, items]) => (
            <div key={cat} className="category-section">
              <button
                className="category-title"
                onClick={() => toggleCategory(cat)}
              >
                <span>{cat}</span>
                <span className="cat-meta">
                  <span className="cat-count">{items.length}</span>
                  {expandedCategories[cat] ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </span>
              </button>

              {!expandedCategories[cat] && (
                <div className="item-grid">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="menu-card"
                      onClick={() => handleAddItemToCurrentOrder(item)}
                    >
                      <div className="menu-card-info">
                        <p className="item-name">{item.name}</p>
                        <p className="item-price">{formatPrice(item.price)}</p>
                      </div>
                      <button className="add-btn">
                        <Plus size={20} />
                      </button>
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
          <div className="current-order-summary">
            <span className="badge">{currentOrder.length} món</span>
            <span className="total-amount">{formatPrice(currentOrderTotal)}</span>
          </div>
          <button className="checkout-btn" onClick={completeOrder}>
            Thanh toán
          </button>
        </div>
      )}

      {/* Topping Bottom Sheet */}
      {showToppingSheet && (() => {
        // Lọc topping theo món được chọn
        const applicableToppingNames = selectedItemToAdd?.applicableToppings || [];
        const visibleToppings = applicableToppingNames.length > 0
          ? toppings.filter(t => applicableToppingNames.includes(t.name))
          : toppings; // fallback: hiện tất cả nếu chưa set
        const unitPrice = (selectedItemToAdd?.price || 0) + selectedToppings.reduce((s, t) => s + t.price, 0);

        return (
          <div className="bottom-sheet-overlay" onClick={() => setShowToppingSheet(false)}>
            <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-header">
                <div>
                  <h3>Thêm vào đơn</h3>
                  <p>{selectedItemToAdd?.name}</p>
                </div>
                <button className="sheet-close" onClick={() => setShowToppingSheet(false)}>
                  <X size={20} />
                </button>
              </div>

              {/* Số lượng */}
              <div className="qty-row">
                <span className="qty-label">Số lượng</span>
                <div className="qty-stepper">
                  <button className="qty-btn" onClick={() => setOrderQty(q => Math.max(1, q - 1))}>−</button>
                  <span className="qty-value">{orderQty}</span>
                  <button className="qty-btn" onClick={() => setOrderQty(q => q + 1)}>+</button>
                </div>
              </div>

              {/* Topping */}
              {visibleToppings.length > 0 && (
                <div className="topping-list">
                  <h4>Chọn Topping</h4>
                  {visibleToppings.map((topping) => {
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
              )}

              <div className="sheet-preview">
                <span>{selectedItemToAdd?.name}{orderQty > 1 ? ` x${orderQty}` : ''}</span>
                {selectedToppings.map((t) => (
                  <span key={t.id} className="preview-topping">+ {t.name}</span>
                ))}
              </div>

              <button className="confirm-btn" onClick={confirmAddItem}>
                Xác nhận — {formatPrice(unitPrice * orderQty)}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ──────────────────────────────────────────────
  // RENDER: REPORT TAB
  // ──────────────────────────────────────────────
  const renderReportTab = () => (
    <div className="report-tab">
      <header className="header">
        <div className="header-row">
          <div>
            <h2>Báo cáo Hôm nay</h2>
            <p className="header-sub">
              {new Date().toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>
          <button
            className={`refresh-btn ${isRefreshingOrders ? 'spinning' : ''}`}
            onClick={() => fetchTodayOrders()}
            title="Làm mới"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <div className="report-body">
        <div className="report-summary">
          <div className="summary-card total">
            <p>Doanh thu</p>
            <h3>{formatPrice(todayRevenue)}</h3>
          </div>
          <div className="summary-card count">
            <p>Ly đã bán</p>
            <h3>{todayCount} ly</h3>
          </div>
          <div className="summary-card orders">
            <p>Đơn hàng</p>
            <h3>{todayOrders.length} đơn</h3>
          </div>
        </div>

        <div className="recent-orders">
          <h3>Giao dịch gần đây</h3>
          {todayOrders.length === 0 ? (
            <p className="empty-state">Chưa có giao dịch nào hôm nay</p>
          ) : (
            todayOrders.map((order) => (
              <div key={order.id} className="transaction-card">
                <div className="tx-header">
                  <span className="tx-time">
                    {new Date(order.timestamp).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <div className="tx-header-right">
                    <span className="tx-total">{formatPrice(order.total)}</span>
                    <button
                      className="tx-delete-btn"
                      onClick={() => deleteOrder(order.id)}
                      title="Xóa giao dịch"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="tx-items">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="tx-item">
                      <span>{item.name}</span>
                      {item.toppings.length > 0 && (
                        <span className="tx-toppings">
                          + {item.toppings.map((t) => t.name).join(', ')}
                        </span>
                      )}
                      <span className="tx-item-price">
                        {formatPrice(item.totalPrice)}
                      </span>
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

  // ──────────────────────────────────────────────
  // RENDER: MENU MANAGEMENT TAB
  // ──────────────────────────────────────────────
  const renderMenuForm = (isTopping = false) => {
    const isEdit = menuView === 'editItem' || menuView === 'editTopping';
    const currentForm = isTopping ? toppingForm : form;
    const setCurrentForm = isTopping ? setToppingForm : setForm;

    return (
      <div className="form-page">
        <header className="header header-with-back">
          <button
            className="back-btn"
            onClick={() => {
              setMenuView('list');
              setEditingItem(null);
              setForm({ category: '', name: '', price: '' });
              setToppingForm({ name: '', price: '' });
            }}
          >
            <X size={20} />
          </button>
          <h2>{isEdit ? 'Chỉnh sửa' : isTopping ? 'Thêm Topping' : 'Thêm Món'}</h2>
          <div style={{ width: 36 }} />
        </header>

        <div className="form-body">
          {!isTopping && (
            <div className="form-group">
              <label>Danh mục</label>
              <input
                className="form-input"
                placeholder="VD: Coffee, Latte, Trà Trái Cây..."
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                list="category-list"
              />
              <datalist id="category-list">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          )}

          <div className="form-group">
            <label>{isTopping ? 'Tên topping' : 'Tên món'}</label>
            <input
              className="form-input"
              placeholder={isTopping ? 'VD: Hạt Đác' : 'VD: Matcha Latte - L'}
              value={currentForm.name}
              onChange={(e) => setCurrentForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label>Giá (VNĐ)</label>
            <input
              className="form-input"
              type="number"
              placeholder="VD: 25000"
              value={currentForm.price}
              onChange={(e) => setCurrentForm((p) => ({ ...p, price: e.target.value }))}
            />
          </div>

          {/* Checklist topping — chỉ hiện khi thêm/sửa món (không phải topping) */}
          {!isTopping && toppings.length > 0 && (
            <div className="form-group">
              <label>Topping áp dụng cho món này</label>
              <p className="form-hint">Chỉ những topping được chọn mới hiện khi log món này</p>
              <div className="topping-checklist">
                {toppings.map((t) => {
                  const checked = (form.applicableToppings || []).includes(t.name);
                  return (
                    <label key={t.id} className={`topping-check-item ${checked ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setForm((p) => ({
                            ...p,
                            applicableToppings: checked
                              ? p.applicableToppings.filter(n => n !== t.name)
                              : [...(p.applicableToppings || []), t.name],
                          }));
                        }}
                      />
                      <span>{t.name}</span>
                      <span className="topping-check-price">+{formatPrice(t.price)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <button className="save-btn" onClick={isTopping ? saveTopping : saveMenuItem}>
            <Check size={18} />
            {isEdit ? 'Lưu thay đổi' : 'Thêm mới'}
          </button>
        </div>
      </div>
    );
  };

  const renderMenuTab = () => {
    if (
      menuView === 'addItem' ||
      menuView === 'editItem'
    )
      return renderMenuForm(false);
    if (menuView === 'addTopping' || menuView === 'editTopping')
      return renderMenuForm(true);

    return (
      <div className="menu-mgmt-tab">
        <header className="header">
          <h2>Quản lý Menu</h2>
        </header>

        {/* Sub Tab */}
        <div className="sub-tabs">
          <button
            className={`sub-tab ${menuTab === 'items' ? 'active' : ''}`}
            onClick={() => setMenuTab('items')}
          >
            Thực đơn ({menuItems.length})
          </button>
          <button
            className={`sub-tab ${menuTab === 'toppings' ? 'active' : ''}`}
            onClick={() => setMenuTab('toppings')}
          >
            Topping ({toppings.length})
          </button>
        </div>

        {menuTab === 'items' && (
          <div className="mgmt-list">
            <button
              className="add-new-btn"
              onClick={() => setMenuView('addItem')}
            >
              <Plus size={18} /> Thêm món mới
            </button>

            {categories.map((cat) => {
              const items = menuItems.filter((i) => i.category === cat);
              return (
                <div key={cat} className="mgmt-category">
                  <div className="mgmt-cat-header">
                    <span className="mgmt-cat-name">{cat}</span>
                    <span className="mgmt-cat-count">{items.length} món</span>
                  </div>
                  {items.map((item) => (
                    <div key={item.id} className="mgmt-item">
                      <div className="mgmt-item-info">
                        <p className="mgmt-item-name">{item.name}</p>
                        <p className="mgmt-item-price">{formatPrice(item.price)}</p>
                      </div>
                      <div className="mgmt-item-actions">
                        <button
                          className="action-btn edit"
                          onClick={() => startEditItem(item)}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => deleteMenuItem(item.id)}
                        >
                          <Trash2 size={15} />
                        </button>
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
            <button
              className="add-new-btn"
              onClick={() => setMenuView('addTopping')}
            >
              <Plus size={18} /> Thêm topping mới
            </button>
            {toppings.map((topping) => (
              <div key={topping.id} className="mgmt-item">
                <div className="mgmt-item-info">
                  <p className="mgmt-item-name">{topping.name}</p>
                  <p className="mgmt-item-price">{formatPrice(topping.price)}</p>
                </div>
                <div className="mgmt-item-actions">
                  <button
                    className="action-btn edit"
                    onClick={() => startEditTopping(topping)}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    className="action-btn delete"
                    onClick={() => deleteTopping(topping.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ──────────────────────────────────────────────
  // ROOT RENDER
  // ──────────────────────────────────────────────
  return (
    <div className="app-container">
      <main className="main-content">
        {activeTab === 'order' && renderOrderTab()}
        {activeTab === 'report' && renderReportTab()}
        {activeTab === 'menu' && renderMenuTab()}
      </main>

      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === 'order' ? 'active' : ''}`}
          onClick={() => setActiveTab('order')}
        >
          <Home size={24} />
          <span>Bán hàng</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          <BarChart3 size={24} />
          <span>Báo cáo</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          <Settings size={24} />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
