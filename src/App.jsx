import React, { useState, useEffect } from 'react';
import {
  ref, set, push, update, remove, onValue, get,
  query, orderByKey, startAt, endAt,
} from 'firebase/database';
import { db } from './firebase';
import {
  BarChart3, Home, Settings, Plus, Trash2, X, Edit2, Check,
  Search, Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp, FolderPlus,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';

// ──────────────────────────────────────────────
// STORAGE (cache offline)
// ──────────────────────────────────────────────
const SK = {
  MENU: 'dol_menu',
  GROUPS: 'dol_groups',
  ORDERS: 'dol_orders',
  REPORT: 'dol_report_cache',
  TOPPINGS: 'dol_toppings',
};

const REPORT_TTL = 5 * 60 * 1000;

const fromStorage = (key) => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; }
};
const toStorage = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
};

const loadReportCache = (period) => {
  try {
    const cache = JSON.parse(localStorage.getItem(SK.REPORT) || '{}');
    const e = cache[period];
    if (!e || Date.now() - e.ts > REPORT_TTL) return null;
    return e.data;
  } catch { return null; }
};
const saveReportCache = (period, data) => {
  try {
    const cache = JSON.parse(localStorage.getItem(SK.REPORT) || '{}');
    cache[period] = { data, ts: Date.now() };
    localStorage.setItem(SK.REPORT, JSON.stringify(cache));
  } catch {}
};
const invalidateReportCache = () => localStorage.removeItem(SK.REPORT);

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
const formatPrice = (p) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const dateKey = (d = new Date()) => d.toISOString().split('T')[0]; // YYYY-MM-DD

// Parse Firebase snapshot của menu
const parseMenu = (snap) => {
  const data = snap.val() || {};
  return Object.entries(data).map(([id, v]) => ({
    id, category: v.category, name: v.name, price: v.price,
    applicableToppingGroups: v.applicableToppingGroups || [],
  }));
};

// Parse Firebase snapshot của toppingGroups
const parseGroups = (snap) => {
  const data = snap.val() || {};
  return Object.entries(data).map(([id, v]) => ({
    id, name: v.name,
    items: v.items ? Object.keys(v.items).filter(k => v.items[k] === true) : [],
  }));
};

const parseToppings = (snap) => {
  const data = snap.val() || {};
  return Object.entries(data).map(([id, v]) => ({ id, name: v.name, price: v.price }));
};

// Parse Firebase snapshot của orders (1 ngày)
const parseDayOrders = (snap, dateStr) => {
  const data = snap.val() || {};
  return Object.entries(data)
    .map(([id, v]) => ({ id, dateKey: dateStr, ...v }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

// ──────────────────────────────────────────────
// APP
// ──────────────────────────────────────────────
export default function App() {
  // ── Core state ──
  const [activeTab, setActiveTab] = useState('order');
  const [menuItems, setMenuItems] = useState([]);
  const [toppingGroups, setToppingGroups] = useState([]);
  const [toppings, setToppings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ── Order states ──
  const [currentOrder, setCurrentOrder] = useState([]);
  const [showToppingSheet, setShowToppingSheet] = useState(false);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState(null);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Report states ──
  const [reportPeriod, setReportPeriod] = useState('today');
  const [periodOrders, setPeriodOrders] = useState([]);
  const [cachedReport, setCachedReport] = useState(null);
  const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);

  // ── Toast (undo delete) & UI states ──
  const [toast, setToast] = useState(null); // { message, onUndo }
  const [activeCategoryOrder, setActiveCategoryOrder] = useState('All');

  // ── Menu management states ──
  const [menuView, setMenuView] = useState('list');
  const [editingItem, setEditingItem] = useState(null);
  const [menuTab, setMenuTab] = useState('items');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [form, setForm] = useState({ category: '', name: '', price: '', applicableToppingGroups: [] });
  const [groupForm, setGroupForm] = useState({ name: '' });
  const [toppingForm, setToppingForm] = useState({ name: '', price: '' });

  // ──────────────────────────────────────────────
  // REAL-TIME FIREBASE LISTENERS
  // ──────────────────────────────────────────────
  useEffect(() => {
    // Show cache ngay lập tức (0ms)
    const cm = fromStorage(SK.MENU); const cg = fromStorage(SK.GROUPS); const co = fromStorage(SK.ORDERS); const ct = fromStorage(SK.TOPPINGS);
    if (cm?.length) setMenuItems(cm);
    if (cg?.length) setToppingGroups(cg);
    if (ct?.length) setToppings(ct);
    if (co?.length) setOrders(co);
    setIsLoading(!cm?.length);

    // Online/offline monitor
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // ── Listen: Menu (real-time) ──
    const unsubMenu = onValue(ref(db, 'menu'), snap => {
      const items = parseMenu(snap);
      setMenuItems(items);
      toStorage(SK.MENU, items);
      setIsLoading(false);
    });

    // ── Listen: ToppingGroups (real-time) ──
    const unsubGroups = onValue(ref(db, 'toppingGroups'), snap => {
      const groups = parseGroups(snap);
      setToppingGroups(groups);
      toStorage(SK.GROUPS, groups);
    });

    const unsubToppings = onValue(ref(db, 'toppings'), snap => {
      const ts = parseToppings(snap);
      setToppings(ts);
      toStorage(SK.TOPPINGS, ts);
    });

    // ── Listen: Today's Orders (real-time) ──
    const todayKey = dateKey();
    const unsubOrders = onValue(ref(db, `orders/${todayKey}`), snap => {
      const todayOrders = parseDayOrders(snap, todayKey);
      setOrders(todayOrders);
      toStorage(SK.ORDERS, todayOrders);
      setIsLoading(false);
    });

    return () => {
      unsubMenu(); unsubGroups(); unsubToppings(); unsubOrders();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Derived
  const allToppings = toppings;
  const categories = [...new Set(menuItems.map(i => i.category))];
  const filteredItems = searchQuery
    ? menuItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.category.toLowerCase().includes(searchQuery.toLowerCase()))
    : menuItems;
  const filteredByCategory = categories.reduce((acc, cat) => {
    const items = filteredItems.filter(i => i.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});
  const currentOrderTotal = currentOrder.reduce((s, i) => s + i.totalPrice, 0);

  // ──────────────────────────────────────────────
  // ORDER LOGIC
  // ──────────────────────────────────────────────
  const handleAddItem = (item) => {
    setSelectedItemToAdd(item);
    setSelectedToppings([]);
    setShowToppingSheet(true);
  };

  const toggleTopping = (t) => {
    setSelectedToppings(prev =>
      prev.find(x => x.id === t.id) ? prev.filter(x => x.id !== t.id) : [...prev, t]
    );
  };

  const confirmAddItem = () => {
    const toppingTotal = selectedToppings.reduce((s, t) => s + t.price, 0);
    setCurrentOrder(prev => [...prev, {
      ...selectedItemToAdd,
      cartId: generateId(),
      toppings: [...selectedToppings],
      totalPrice: selectedItemToAdd.price + toppingTotal,
    }]);
    setShowToppingSheet(false);
  };

  const quickReAdd = (cartItem) => {
    setSelectedItemToAdd(cartItem);
    setSelectedToppings([]);
    setShowToppingSheet(true);
  };

  const removeCartItem = (cartId) => setCurrentOrder(prev => prev.filter(i => i.cartId !== cartId));

  const completeOrder = async () => {
    if (!currentOrder.length) return;
    const todayKey = dateKey();
    const newRef = push(ref(db, `orders/${todayKey}`));
    const newOrder = {
      id: newRef.key,
      dateKey: todayKey,
      items: currentOrder.map(({ cartId, ...rest }) => rest), // remove cartId before saving
      total: currentOrderTotal,
      timestamp: new Date().toISOString(),
    };
    setCurrentOrder([]);
    invalidateReportCache();
    await set(newRef, newOrder); // Real-time listener updates orders automatically
  };

  const deleteOrder = (order) => {
    const dk = order.dateKey || dateKey(new Date(order.timestamp));

    // Optimistic: xóa khỏi UI ngay lập tức (0ms)
    setOrders(prev => prev.filter(o => o.id !== order.id));
    setPeriodOrders(prev => prev.filter(o => o.id !== order.id));
    invalidateReportCache();

    // Undo buffer: giữ lại order trong 4s
    let undone = false;
    const timer = setTimeout(() => {
      if (!undone) remove(ref(db, `orders/${dk}/${order.id}`)); // xóa thật sau 4s
    }, 4000);

    // Hiện toast với nút hoàn tác
    setToast({
      message: 'Đã xóa giao dịch',
      onUndo: () => {
        undone = true;
        clearTimeout(timer);
        // Restore: add lại vào local state (Firebase onValue sẽ sync đúng)
        setOrders(prev => [order, ...prev].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        setPeriodOrders(prev => [order, ...prev].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        setToast(null);
      },
    });
    setTimeout(() => setToast(null), 4000);
  };

  // ──────────────────────────────────────────────
  // MENU ITEM CRUD
  // ──────────────────────────────────────────────
  const saveMenuItem = async () => {
    if (!form.name.trim() || !form.category.trim() || !form.price) return;
    const payload = {
      category: form.category.trim(), name: form.name.trim(),
      price: parseInt(form.price, 10),
      applicableToppingGroups: form.applicableToppingGroups || [],
    };
    if (editingItem) {
      await update(ref(db, `menu/${editingItem.id}`), payload);
    } else {
      const newRef = push(ref(db, 'menu'));
      await set(newRef, payload);
    }
    setForm({ category: '', name: '', price: '', applicableToppingGroups: [] });
    setEditingItem(null);
    setMenuView('list');
  };

  const deleteMenuItem = async (id) => {
    await remove(ref(db, `menu/${id}`));
  };

  const startEditItem = (item) => {
    setEditingItem(item);
    setForm({ category: item.category, name: item.name, price: String(item.price), applicableToppingGroups: item.applicableToppingGroups || [] });
    setMenuView('editItem');
  };

  // ──────────────────────────────────────────────
  // TOPPING GROUP CRUD
  // ──────────────────────────────────────────────
  const saveGroup = async () => {
    if (!groupForm.name.trim()) return;
    if (editingItem?.type === 'group') {
      await update(ref(db, `toppingGroups/${editingItem.id}`), { name: groupForm.name.trim() });
    } else {
      const newRef = push(ref(db, 'toppingGroups'));
      await set(newRef, { name: groupForm.name.trim(), items: {} });
    }
    setGroupForm({ name: '' }); setEditingItem(null); setMenuView('list');
  };

  const deleteGroup = async (groupId) => {
    if (!window.confirm('Xóa nhóm topping này?')) return;
    await remove(ref(db, `toppingGroups/${groupId}`));
  };

  const saveTopping = async () => {
    if (!toppingForm.name.trim() || !toppingForm.price) return;
    const payload = { name: toppingForm.name.trim(), price: parseInt(toppingForm.price, 10) };
    if (editingItem?.type === 'topping') {
      await update(ref(db, `toppings/${editingItem.id}`), payload);
    } else {
      const newRef = push(ref(db, 'toppings'));
      await set(newRef, payload);
    }
    setToppingForm({ name: '', price: '' }); setEditingItem(null); setMenuView('list');
  };

  const deleteTopping = async (id) => {
    if (!window.confirm('Xóa topping này?')) return;
    await remove(ref(db, `toppings/${id}`));
  };

  const toggleToppingForGroup = async (groupId, toppingId, isActive) => {
    if (isActive) {
      await remove(ref(db, `toppingGroups/${groupId}/items/${toppingId}`));
    } else {
      await set(ref(db, `toppingGroups/${groupId}/items/${toppingId}`), true);
    }
  };

  // ──────────────────────────────────────────────
  // REPORT DATA
  // ──────────────────────────────────────────────
  const getPeriodRange = (period) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(today.getTime() + 86400000 - 1);
    if (period === 'today') return {
      start: today, end: todayEnd,
      prevStart: new Date(today.getTime() - 86400000), prevEnd: new Date(today.getTime() - 1),
      label: 'Hôm nay', prevLabel: 'Hôm qua',
    };
    if (period === 'week') {
      const day = today.getDay() || 7;
      const weekStart = new Date(today.getTime() - (day - 1) * 86400000);
      return {
        start: weekStart, end: todayEnd,
        prevStart: new Date(weekStart.getTime() - 7 * 86400000), prevEnd: new Date(weekStart.getTime() - 1),
        label: 'Tuần này', prevLabel: 'Tuần trước',
      };
    }
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      start: monthStart, end: todayEnd,
      prevStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      prevEnd: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      label: 'Tháng này', prevLabel: 'Tháng trước',
    };
  };

  const fetchPeriodData = async (period, forceRefresh = false) => {
    // Stale-while-revalidate
    const cached = loadReportCache(period);
    if (cached && !forceRefresh) {
      setCachedReport(cached);
      setPeriodOrders(cached.curr?.rawOrders || []);
      setTimeout(() => fetchPeriodData(period, true), 0);
      return;
    }

    setIsLoadingPeriod(!cached);
    try {
      const range = getPeriodRange(period);
      const sk = dateKey(range.start), ek = dateKey(range.end);
      const psk = dateKey(range.prevStart), pek = dateKey(range.prevEnd);

      // Firebase query by date partition key
      const [currSnap, prevSnap] = await Promise.all([
        get(query(ref(db, 'orders'), orderByKey(), startAt(sk), endAt(ek))),
        get(query(ref(db, 'orders'), orderByKey(), startAt(psk), endAt(pek))),
      ]);

      const extractOrders = (snap) => {
        const data = snap.val() || {};
        return Object.entries(data).flatMap(([dk, dayOrders]) =>
          Object.entries(dayOrders || {}).map(([id, o]) => ({ id, dateKey: dk, ...o }))
        ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      };

      const aggregate = (orders, includeRaw) => ({
        revenue: orders.reduce((s, o) => s + o.total, 0),
        count: orders.reduce((s, o) => s + (o.items?.length || 0), 0),
        orders: orders.length,
        byDay: orders.reduce((acc, o) => {
          const d = new Date(o.timestamp);
          const k = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
          if (!acc[k]) acc[k] = { revenue: 0, count: 0 };
          acc[k].revenue += o.total; acc[k].count += o.items?.length || 0;
          return acc;
        }, {}),
        rawOrders: includeRaw ? orders : [],
      });

      const currOrders = extractOrders(currSnap);
      const prevOrders = extractOrders(prevSnap);
      const report = { curr: aggregate(currOrders, true), prev: aggregate(prevOrders, false) };

      saveReportCache(period, report);
      setCachedReport(report);
      setPeriodOrders(report.curr.rawOrders);
    } catch (err) { console.error('Report error', err); }
    setIsLoadingPeriod(false);
  };

  useEffect(() => {
    if (activeTab !== 'report') return;
    fetchPeriodData(reportPeriod);
  }, [activeTab, reportPeriod]);

  // ──────────────────────────────────────────────
  // STATUS BADGE
  // ──────────────────────────────────────────────
  const StatusBadge = () => isOnline
    ? <span className="cloud-badge ok"><Wifi size={12} /> Online</span>
    : <span className="cloud-badge error"><WifiOff size={12} /> Offline</span>;

  // ──────────────────────────────────────────────
  // RENDER: ORDER TAB
  // ──────────────────────────────────────────────
  const renderOrderTab = () => (
    <div className="order-tab">
      <header className="header">
        <div className="header-row"><h2>Bán hàng</h2><StatusBadge /></div>
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input className="search-input" placeholder="Tìm món..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </header>

      <div className="order-body">
        {isLoading ? (
          <div className="loading-state">Đang tải menu...</div>
        ) : Object.keys(filteredByCategory).length === 0 ? (
          <p className="empty-state">Không tìm thấy món nào</p>
        ) : (
          <>
            {/* ── Category Pills (Horizontal Scroll) ── */}
            <div className="category-pills">
              <button 
                className={`category-pill ${activeCategoryOrder === 'All' ? 'active' : ''}`}
                onClick={() => setActiveCategoryOrder('All')}
              >
                Tất cả
              </button>
              {Object.keys(filteredByCategory).map(cat => (
                <button 
                  key={cat}
                  className={`category-pill ${activeCategoryOrder === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategoryOrder(cat)}
                >
                  {cat} <span className="pill-count">{filteredByCategory[cat]?.length || 0}</span>
                </button>
              ))}
            </div>

            {/* ── Menu Items ── */}
            <div className="item-grid premium-grid">
              {Object.entries(filteredByCategory)
                .filter(([cat]) => activeCategoryOrder === 'All' || cat === activeCategoryOrder)
                .flatMap(([_, items]) => items)
                .map(item => (
                  <div key={item.id} className="menu-card premium-card" onClick={() => handleAddItem(item)}>
                    <div className="menu-card-info">
                      <p className="item-name">{item.name}</p>
                      <p className="item-price">{formatPrice(item.price)}</p>
                    </div>
                    <button className="add-btn premium-btn-plus"><Plus size={18} strokeWidth={3} /></button>
                  </div>
              ))}
            </div>
          </>
        )}
      </div>

      {currentOrder.length > 0 && (
        <div className="current-order-bar">
          <div className="mini-order-list">
            {currentOrder.map(item => (
              <div key={item.cartId} className="mini-order-item">
                <span className="mini-item-name">
                  {item.name}
                  {item.toppings?.length > 0 && <span className="mini-toppings"> · {item.toppings.map(t => t.name).join(', ')}</span>}
                </span>
                <div className="mini-item-actions">
                  <span className="mini-item-price">{formatPrice(item.totalPrice)}</span>
                  <button className="mini-re-add" onClick={() => quickReAdd(item)}><Plus size={12} /></button>
                  <button className="mini-delete" onClick={() => removeCartItem(item.cartId)}><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="order-footer">
            <span className="order-total-label">{currentOrder.length} ly · <strong>{formatPrice(currentOrderTotal)}</strong></span>
            <button className="checkout-btn" onClick={completeOrder}>Log món</button>
          </div>
        </div>
      )}

      {showToppingSheet && (() => {
        const appGroupIds = selectedItemToAdd?.applicableToppingGroups || [];
        const visibleGroups = appGroupIds.length > 0
          ? toppingGroups.filter(g => appGroupIds.includes(g.id))
          : toppingGroups;
        
        // Resolve topping IDs into actual topping objects
        const resolvedGroups = visibleGroups.map(g => ({
          ...g,
          resolvedItems: g.items.map(tid => toppings.find(t => t.id === tid)).filter(Boolean)
        }));

        const toppingTotal = selectedToppings.reduce((s, t) => s + t.price, 0);
        return (
          <div className="bottom-sheet-overlay" onClick={() => setShowToppingSheet(false)}>
            <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
              <div className="sheet-header">
                <div><h3>Chọn topping</h3><p>{selectedItemToAdd?.name}</p></div>
                <button className="sheet-close" onClick={() => setShowToppingSheet(false)}><X size={20} /></button>
              </div>
              {resolvedGroups.every(g => g.resolvedItems.length === 0) ? (
                <p className="empty-state" style={{ padding: '16px' }}>Món này không có topping</p>
              ) : (
                <div className="topping-list">
                  {resolvedGroups.map(group => group.resolvedItems.length > 0 && (
                    <div key={group.id} className="topping-group-section">
                      <p className="topping-group-label">{group.name}</p>
                      {group.resolvedItems.map(topping => {
                        const isSel = selectedToppings.find(t => t.id === topping.id);
                        return (
                          <div key={topping.id} className={`topping-item ${isSel ? 'selected' : ''}`} onClick={() => toggleTopping(topping)}>
                            <span>{topping.name}</span>
                            <div className="topping-right">
                              <span>+{formatPrice(topping.price)}</span>
                              {isSel && <Check size={16} className="check-icon" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
              <div className="sheet-preview">
                <span>{selectedItemToAdd?.name}</span>
                {selectedToppings.map(t => <span key={t.id} className="preview-topping">+ {t.name}</span>)}
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

  // ──────────────────────────────────────────────
  // RENDER: REPORT TAB
  // ──────────────────────────────────────────────
  const renderReportTab = () => {
    const range = getPeriodRange(reportPeriod);
    const curr = cachedReport?.curr || {};
    const prev = cachedReport?.prev || {};
    const currRevenue = curr.revenue ?? 0;
    const prevRevenue = prev.revenue ?? 0;
    const currCount   = curr.count   ?? 0;
    const prevCount   = prev.count   ?? 0;
    const currOrders  = curr.orders  ?? 0;
    const prevOrders  = prev.orders  ?? 0;
    const byDay       = curr.byDay   ?? {};

    // Build chart data (sorted by date)
    const chartData = Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, data]) => ({
        day,
        revenue: data.revenue,
        count: data.count,
      }));

    const pct = (c, p) => !p ? (c > 0 ? 100 : 0) : Math.round(((c - p) / p) * 100);

    const Trend = ({ curr, prev }) => {
      const p = pct(curr, prev);
      if (!prev && !curr) return null;
      const isUp = p >= 0;
      return (
        <span className={`trend ${isUp ? 'up' : 'down'}`}>
          {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(p)}% vs {range.prevLabel}
        </span>
      );
    };

    const formatRevTickY = (v) => {
      if (v >= 1000000) return `${(v/1000000).toFixed(1)}M`;
      if (v >= 1000) return `${(v/1000).toFixed(0)}k`;
      return v;
    };

    const CustomRevenueTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
        return (
          <div className="chart-tooltip">
            <p className="chart-tooltip-label">{label}</p>
            <p><strong>{formatPrice(payload[0].value)}</strong></p>
            {payload[1] && <p style={{color:'#10B981'}}>{payload[1].value} ly</p>}
          </div>
        );
      }
      return null;
    };

    return (
      <div className="report-tab">
        <header className="header">
          <div className="header-row">
            <h2>Báo cáo</h2>
            <button className={`refresh-btn ${isLoadingPeriod ? 'spinning' : ''}`} onClick={() => fetchPeriodData(reportPeriod, true)}>
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="period-tabs">
            {[['today', 'Hôm nay'], ['week', 'Tuần này'], ['month', 'Tháng này']].map(([key, label]) => (
              <button key={key} className={`period-tab ${reportPeriod === key ? 'active' : ''}`} onClick={() => setReportPeriod(key)}>
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="report-body">
          {isLoadingPeriod ? <div className="loading-state">Đang tải báo cáo...</div> : (
            <>
              <div className="report-summary">
                <div className="summary-card total">
                  <p>Doanh thu</p><h3>{formatPrice(currRevenue)}</h3>
                  <Trend curr={currRevenue} prev={prevRevenue} />
                </div>
                <div className="summary-card count">
                  <p>Ly bán</p><h3>{currCount} ly</h3>
                  <Trend curr={currCount} prev={prevCount} />
                </div>
                <div className="summary-card orders">
                  <p>Đơn hàng</p><h3>{currOrders} đơn</h3>
                  <Trend curr={currOrders} prev={prevOrders} />
                </div>
              </div>

              {/* ── AREA CHART (Revenue over time) ── */}
              {chartData.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3 className="chart-title">Doanh thu theo ngày</h3>
                    <span className="chart-unit">VNĐ</span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={formatRevTickY} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomRevenueTooltip />} />
                      <Area
                        type="monotone" dataKey="revenue"
                        stroke="#4F46E5" strokeWidth={2.5}
                        fill="url(#revenueGradient)"
                        dot={false} activeDot={{ r: 5, fill: '#4F46E5', strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── BAR CHART (Cup count per day) ── */}
              {chartData.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <h3 className="chart-title">Số ly bán theo ngày</h3>
                    <span className="chart-unit">ly</span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} margin={{ top: 6, right: 8, left: -16, bottom: 0 }} barSize={16}>
                      <defs>
                        <linearGradient id="countGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                          <stop offset="100%" stopColor="#10B981" stopOpacity={0.5} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v) => [`${v} ly`, 'Số ly']} labelStyle={{ color: '#111827' }} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="count" fill="url(#countGradient)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {reportPeriod !== 'today' && Object.keys(byDay).length > 0 && (
                <div className="day-breakdown">
                  <h3>Chi tiết theo ngày</h3>
                  {Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).map(([day, data]) => (
                    <div key={day} className="day-row">
                      <span className="day-label">{day}</span>
                      <span className="day-count">{data.count} ly</span>
                      <span className="day-revenue">{formatPrice(data.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}

              {reportPeriod === 'today' && (
                <div className="recent-orders">
                  <h3>Giao dịch ({periodOrders.length})</h3>
                  {periodOrders.length === 0 ? <p className="empty-state">Chưa có giao dịch nào</p> : (
                    periodOrders.map(order => (
                      <div key={order.id} className="transaction-card">
                        <div className="tx-header">
                          <span className="tx-time">{new Date(order.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                          <div className="tx-header-right">
                            <span className="tx-total">{formatPrice(order.total)}</span>
                            <button className="tx-delete-btn" onClick={() => deleteOrder(order)}><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="tx-items">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="tx-item">
                              <span>{item.name}</span>
                              {item.toppings?.length > 0 && <span className="tx-toppings">+ {item.toppings.map(t => t.name).join(', ')}</span>}
                              <span className="tx-item-price">{formatPrice(item.totalPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────
  // RENDER: MENU FORMS (add/edit item, group, topping)
  // ──────────────────────────────────────────────
  if (menuView === 'addItem' || menuView === 'editItem') {
    return (
      <div className="app-container"><main className="main-content"><div className="form-page">
        <header className="header header-with-back">
          <button className="back-btn" onClick={() => { setMenuView('list'); setEditingItem(null); setForm({ category: '', name: '', price: '', applicableToppingGroups: [] }); }}><X size={20} /></button>
          <h2>{menuView === 'editItem' ? 'Chỉnh sửa món' : 'Thêm món mới'}</h2>
          <div style={{ width: 36 }} />
        </header>
        <div className="form-body">
          <div className="form-group"><label>Danh mục</label>
            <input className="form-input" placeholder="VD: Coffee, Trà Trái Cây..." value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} list="cat-list" />
            <datalist id="cat-list">{categories.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="form-group"><label>Tên món</label>
            <input className="form-input" placeholder="VD: Matcha Latte - L" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-group"><label>Giá (VNĐ)</label>
            <input className="form-input" type="number" placeholder="VD: 35000" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
          </div>
          {toppingGroups.length > 0 && (
            <div className="form-group">
              <label>Nhóm topping áp dụng</label>
              <p className="form-hint">Chỉ nhóm được tick mới hiện khi log món</p>
              <div className="topping-checklist">
                {toppingGroups.map(group => {
                  const checked = (form.applicableToppingGroups || []).includes(group.id);
                  return (
                    <label key={group.id} className={`topping-check-item ${checked ? 'checked' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => setForm(p => ({
                        ...p, applicableToppingGroups: checked
                          ? p.applicableToppingGroups.filter(id => id !== group.id)
                          : [...p.applicableToppingGroups, group.id],
                      }))} />
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
          <button className="save-btn" onClick={saveMenuItem}><Check size={18} /> {menuView === 'editItem' ? 'Lưu thay đổi' : 'Thêm món'}</button>
        </div>
      </div></main></div>
    );
  }

  if (menuView === 'addGroup' || menuView === 'editGroup') {
    return (
      <div className="app-container"><main className="main-content"><div className="form-page">
        <header className="header header-with-back">
          <button className="back-btn" onClick={() => { setMenuView('list'); setEditingItem(null); setGroupForm({ name: '' }); }}><X size={20} /></button>
          <h2>{menuView === 'editGroup' ? 'Sửa nhóm' : 'Thêm nhóm topping'}</h2>
          <div style={{ width: 36 }} />
        </header>
        <div className="form-body">
          <div className="form-group"><label>Tên nhóm</label>
            <input className="form-input" placeholder="VD: Trân Châu, Thạch, Kem..." value={groupForm.name} onChange={e => setGroupForm({ name: e.target.value })} />
          </div>
          <button className="save-btn" onClick={saveGroup}><Check size={18} /> {menuView === 'editGroup' ? 'Lưu' : 'Tạo nhóm'}</button>
        </div>
      </div></main></div>
    );
  }

  if (menuView === 'addTopping' || menuView === 'editTopping') {
    const isEdit = menuView === 'editTopping';
    return (
      <div className="app-container"><main className="main-content"><div className="form-page">
        <header className="header header-with-back">
          <button className="back-btn" onClick={() => { setMenuView('list'); setEditingItem(null); setToppingForm({ name: '', price: '' }); }}><X size={20} /></button>
          <h2>{isEdit ? 'Sửa topping' : 'Thêm topping'}</h2>
          <div style={{ width: 36 }} />
        </header>
        <div className="form-body">
          <div className="form-group"><label>Tên topping</label>
            <input className="form-input" placeholder="VD: Trân Châu Trắng" value={toppingForm.name} onChange={e => setToppingForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-group"><label>Giá (VNĐ)</label>
            <input className="form-input" type="number" placeholder="VD: 5000" value={toppingForm.price} onChange={e => setToppingForm(p => ({ ...p, price: e.target.value }))} />
          </div>
          <button className="save-btn" onClick={saveTopping}><Check size={18} /> {isEdit ? 'Lưu thay đổi' : 'Thêm topping'}</button>
        </div>
      </div></main></div>
    );
  }

  // ──────────────────────────────────────────────
  // RENDER: MENU MANAGEMENT (list)
  // ──────────────────────────────────────────────
  const renderMenuTab = () => (
    <div className="menu-mgmt-tab">
      <header className="header"><h2>Quản lý Menu</h2></header>
      <div className="sub-tabs">
        <button className={`sub-tab ${menuTab === 'items' ? 'active' : ''}`} onClick={() => setMenuTab('items')}>Thực đơn ({menuItems.length})</button>
        <button className={`sub-tab ${menuTab === 'toppings' ? 'active' : ''}`} onClick={() => setMenuTab('toppings')}>Nhóm Topping ({toppingGroups.length})</button>
        <button className={`sub-tab ${menuTab === 'topping_items' ? 'active' : ''}`} onClick={() => setMenuTab('topping_items')}>Topping lẻ ({toppings.length})</button>
      </div>

      {menuTab === 'items' && (
        <div className="mgmt-list">
          <button className="add-new-btn" onClick={() => setMenuView('addItem')}><Plus size={18} /> Thêm món mới</button>
          {categories.map(cat => (
            <div key={cat} className="mgmt-category">
              <div className="mgmt-cat-header">
                <span className="mgmt-cat-name">{cat}</span>
                <span className="mgmt-cat-count">{menuItems.filter(i => i.category === cat).length} món</span>
              </div>
              {menuItems.filter(i => i.category === cat).map(item => (
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
          ))}
        </div>
      )}

      {menuTab === 'topping_items' && (
        <div className="mgmt-list">
          <button className="add-new-btn" onClick={() => { setToppingForm({ name: '', price: '' }); setMenuView('addTopping'); }}><Plus size={18} /> Thêm topping lẻ mới</button>
          {toppings.length === 0 && <p className="empty-state">Chưa có topping lẻ nào.</p>}
          <div className="mgmt-category">
            {toppings.map(t => (
              <div key={t.id} className="mgmt-item">
                <div className="mgmt-item-info">
                  <p className="mgmt-item-name">{t.name}</p>
                  <p className="mgmt-item-price">{formatPrice(t.price)}</p>
                </div>
                <div className="mgmt-item-actions">
                  <button className="action-btn edit" onClick={() => { setEditingItem({ ...t, type: 'topping' }); setToppingForm({ name: t.name, price: String(t.price) }); setMenuView('editTopping'); }}><Edit2 size={15} /></button>
                  <button className="action-btn delete" onClick={() => deleteTopping(t.id)}><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {menuTab === 'toppings' && (
        <div className="mgmt-list">
          <button className="add-new-btn" onClick={() => setMenuView('addGroup')}><FolderPlus size={18} /> Thêm nhóm topping</button>
          {toppingGroups.length === 0 && <p className="empty-state">Chưa có nhóm topping nào.</p>}
          {toppingGroups.map(group => (
            <div key={group.id} className="topping-group-card">
              <div className="topping-group-header">
                <button className="group-toggle" onClick={() => setExpandedGroups(p => ({ ...p, [group.id]: !p[group.id] }))}>
                  <span className="group-name">📦 {group.name}</span>
                  <span className="group-meta">
                    <span className="group-count">{group.items.length} topping</span>
                    {expandedGroups[group.id] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </span>
                </button>
                <div className="group-actions">
                  <button className="action-btn edit" onClick={() => { setEditingItem({ ...group, type: 'group' }); setGroupForm({ name: group.name }); setMenuView('editGroup'); }}><Edit2 size={14} /></button>
                  <button className="action-btn delete" onClick={() => deleteGroup(group.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              {expandedGroups[group.id] && (
                <div className="group-topping-list">
                  {toppings.length === 0 && <p style={{fontSize: '0.8rem', color: '#9CA3AF'}}>Chưa có topping lẻ nào, hãy tạo topping lẻ trước.</p>}
                  {toppings.map(t => {
                    const isInGroup = group.items.includes(t.id);
                    return (
                      <div key={t.id} className="mgmt-item topping-toggle-item" style={{ cursor: 'pointer' }} onClick={() => toggleToppingForGroup(group.id, t.id, isInGroup)}>
                        <div className="mgmt-item-info">
                          <p className="mgmt-item-name" style={{ color: isInGroup ? 'var(--text-main)' : 'var(--text-light)' }}>{t.name}</p>
                          <p className="mgmt-item-price">{formatPrice(t.price)}</p>
                        </div>
                        <div className="mgmt-item-actions">
                          {isInGroup ? (
                            <Check size={20} color="var(--primary)" />
                          ) : (
                            <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderRadius: '4px' }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ──────────────────────────────────────────────
  // ROOT
  // ──────────────────────────────────────────────
  return (
    <div className="app-container">
      <main className="main-content">
        {activeTab === 'order' && renderOrderTab()}
        {activeTab === 'report' && renderReportTab()}
        {activeTab === 'menu' && renderMenuTab()}
      </main>
      <nav className="bottom-nav">
        <button className={`nav-item ${activeTab === 'order' ? 'active' : ''}`} onClick={() => setActiveTab('order')}><Home size={24} /><span>Bán hàng</span></button>
        <button className={`nav-item ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}><BarChart3 size={24} /><span>Báo cáo</span></button>
        <button className={`nav-item ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => setActiveTab('menu')}><Settings size={24} /><span>Menu</span></button>
      </nav>

      {/* Undo Toast */}
      {toast && (
        <div className="toast">
          <span>{toast.message}</span>
          <button className="toast-undo" onClick={toast.onUndo}>Hoàn tác</button>
        </div>
      )}
    </div>
  );
}
