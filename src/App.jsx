import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ref, set, push, update, remove, onValue, get,
  query, orderByKey, startAt, endAt,
} from 'firebase/database';
import { db } from './firebase';
import {
  BarChart3, Home, Settings, Plus, X, Check,
  Wifi, WifiOff,
} from 'lucide-react';
import { gsap } from 'gsap';

// ── Tabs ──
import OrderTab from './tabs/OrderTab';
import ReportTab from './tabs/ReportTab';
import MenuTab from './tabs/MenuTab';

// ── Components ──
import ConfirmDialog from './components/ConfirmDialog';
import SwipeToDelete from './components/SwipeToDelete';

// ── Utilities ──
import {
  formatPrice, generateId, dateKey,
  parseMenu, parseGroups, parseToppings, parseDayOrders,
} from './utils';

// ──────────────────────────────────────────────
// CACHE HELPERS
// ──────────────────────────────────────────────
const SK = {
  MENU: 'dol_menu', GROUPS: 'dol_groups',
  ORDERS: 'dol_orders', REPORT: 'dol_report_cache', TOPPINGS: 'dol_toppings',
};
const REPORT_TTL = 5 * 60 * 1000;
const fromStorage = (key) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; } };
const toStorage = (key, data) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} };
const loadReportCache = (period) => {
  try { const c = JSON.parse(localStorage.getItem(SK.REPORT) || '{}'); const e = c[period]; if (!e || Date.now() - e.ts > REPORT_TTL) return null; return e.data; } catch { return null; }
};
const saveReportCache = (period, data) => {
  try { const c = JSON.parse(localStorage.getItem(SK.REPORT) || '{}'); c[period] = { data, ts: Date.now() }; localStorage.setItem(SK.REPORT, JSON.stringify(c)); } catch {}
};
const invalidateReportCache = () => localStorage.removeItem(SK.REPORT);

// ──────────────────────────────────────────────
// APP
// ──────────────────────────────────────────────
export default function App() {
  // ── Core state ──
  const [activeTab, setActiveTab] = useState('order');
  const [menuItems, setMenuItems] = useState([]);
  const [toppingGroups, setToppingGroups] = useState([]);
  const [toppings, setToppings] = useState([]);
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

  // ── Toast ──
  const [toast, setToast] = useState(null);

  // ── Confirm dialog (thay window.confirm) ──
  const [confirmState, setConfirmState] = useState({ message: '', subtext: '', onConfirm: null });
  const showConfirm = useCallback((message, subtext, onConfirm) => {
    setConfirmState({ message, subtext, onConfirm });
  }, []);
  const hideConfirm = useCallback(() => {
    setConfirmState({ message: '', subtext: '', onConfirm: null });
  }, []);

  // ── Monthly item stats ──
  const [monthlyItemStats, setMonthlyItemStats] = useState(
    () => { try { const c = JSON.parse(localStorage.getItem('dol_top_monthly') || '{}'); return c.ts && Date.now() - c.ts < 10*60*1000 ? c.stats : {}; } catch { return {}; } }
  );

  // ── Menu management states ──
  const [menuView, setMenuView] = useState('list');
  const [editingItem, setEditingItem] = useState(null);
  const [menuTab, setMenuTab] = useState('items');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [form, setForm] = useState({ category: '', name: '', price: '', applicableToppingGroups: [] });
  const [groupForm, setGroupForm] = useState({ name: '' });
  const [toppingForm, setToppingForm] = useState({ name: '', price: '' });

  // ── Animation refs ──
  const sheetRef = useRef(null);
  const sheetOverlayRef = useRef(null);
  const toastRef = useRef(null);
  const mainContentRef = useRef(null);

  // ──────────────────────────────────────────────
  // FIREBASE LISTENERS
  // ──────────────────────────────────────────────
  useEffect(() => {
    const cm = fromStorage(SK.MENU); const cg = fromStorage(SK.GROUPS);
    const co = fromStorage(SK.ORDERS); const ct = fromStorage(SK.TOPPINGS);
    if (cm?.length) setMenuItems(cm);
    if (cg?.length) setToppingGroups(cg);
    if (ct?.length) setToppings(ct);
    setIsLoading(!cm?.length);

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const unsubMenu = onValue(ref(db, 'menu'), snap => { const items = parseMenu(snap); setMenuItems(items); toStorage(SK.MENU, items); setIsLoading(false); });
    const unsubGroups = onValue(ref(db, 'toppingGroups'), snap => { const g = parseGroups(snap); setToppingGroups(g); toStorage(SK.GROUPS, g); });
    const unsubToppings = onValue(ref(db, 'toppings'), snap => { const ts = parseToppings(snap); setToppings(ts); toStorage(SK.TOPPINGS, ts); });

    const todayKey = dateKey();
    const unsubOrders = onValue(ref(db, `orders/${todayKey}`), snap => {
      const todayOrders = parseDayOrders(snap, todayKey);
      toStorage(SK.ORDERS, todayOrders);
      setIsLoading(false);
    });

    return () => {
      unsubMenu(); unsubGroups(); unsubToppings(); unsubOrders();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ──────────────────────────────────────────────
  // MONTHLY STATS FETCH
  // ──────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      const now = new Date();
      const sk = dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
      const ek = dateKey(now);
      try {
        const snap = await get(query(ref(db, 'orders'), orderByKey(), startAt(sk), endAt(ek)));
        const data = snap.val() || {};
        const stats = {};
        Object.values(data).forEach(day =>
          Object.values(day || {}).forEach(order =>
            (order.items || []).forEach(item => { stats[item.name] = (stats[item.name] || 0) + 1; })
          )
        );
        setMonthlyItemStats(stats);
        localStorage.setItem('dol_top_monthly', JSON.stringify({ stats, ts: Date.now() }));
      } catch (e) { console.warn('Monthly stats fetch failed', e); }
    };
    fetch();
  }, []);

  // ──────────────────────────────────────────────
  // DERIVED STATE
  // ──────────────────────────────────────────────
  const categories = [...new Set(menuItems.map(i => i.category))];
  const filteredItems = searchQuery
    ? menuItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.category.toLowerCase().includes(searchQuery.toLowerCase()))
    : menuItems;
  const hasMonthlyData = Object.keys(monthlyItemStats).length > 0;
  const top10MenuItems = hasMonthlyData
    ? [...menuItems].sort((a, b) => (monthlyItemStats[b.name] || 0) - (monthlyItemStats[a.name] || 0)).slice(0, 10)
    : [];
  const displayItems = searchQuery ? filteredItems : hasMonthlyData ? top10MenuItems : menuItems;
  const currentOrderTotal = currentOrder.reduce((s, i) => s + i.totalPrice, 0);

  // ──────────────────────────────────────────────
  // GSAP ANIMATIONS
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (showToppingSheet && sheetRef.current) {
      gsap.set(sheetRef.current, { y: '100%' });
      gsap.set(sheetOverlayRef.current, { opacity: 0 });
      gsap.to(sheetOverlayRef.current, { opacity: 1, duration: 0.2, ease: 'power2.out' });
      gsap.to(sheetRef.current, { y: '0%', duration: 0.38, ease: 'power3.out' });
    }
  }, [showToppingSheet]);

  useEffect(() => {
    if (mainContentRef.current) {
      gsap.fromTo(mainContentRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
    }
  }, [activeTab]);

  const closeSheet = useCallback(() => {
    if (sheetRef.current) {
      gsap.to(sheetOverlayRef.current, { opacity: 0, duration: 0.2 });
      gsap.to(sheetRef.current, { y: '100%', duration: 0.3, ease: 'power3.in', onComplete: () => setShowToppingSheet(false) });
    } else {
      setShowToppingSheet(false);
    }
  }, []);

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
    closeSheet();
  };

  const quickReAdd = (cartItem) => { setSelectedItemToAdd(cartItem); setSelectedToppings([]); setShowToppingSheet(true); };
  const removeCartItem = (cartId) => setCurrentOrder(prev => prev.filter(i => i.cartId !== cartId));

  const completeOrder = async () => {
    if (!currentOrder.length) return;
    const todayKey = dateKey();
    const newRef = push(ref(db, `orders/${todayKey}`));
    const newOrder = {
      id: newRef.key, dateKey: todayKey,
      items: currentOrder.map(({ cartId, ...rest }) => rest),
      total: currentOrderTotal,
      timestamp: new Date().toISOString(),
    };
    setCurrentOrder([]);
    invalidateReportCache();
    localStorage.removeItem('dol_top_monthly');
    await set(newRef, newOrder);
  };

  // ──────────────────────────────────────────────
  // TOAST HELPER
  // ──────────────────────────────────────────────
  const showToast = useCallback((message, onUndo) => {
    setToast({ message, onUndo });
    setTimeout(() => setToast(null), 4000);
    requestAnimationFrame(() => {
      if (toastRef.current) {
        gsap.fromTo(toastRef.current, { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'back.out(1.5)' });
      }
    });
  }, []);

  const deleteOrder = (order) => {
    const dk = order.dateKey || dateKey(new Date(order.timestamp));
    setPeriodOrders(prev => prev.filter(o => o.id !== order.id));
    invalidateReportCache();
    let undone = false;
    const timer = setTimeout(() => { if (!undone) remove(ref(db, `orders/${dk}/${order.id}`)); }, 4000);
    showToast('Đã xóa giao dịch', () => {
      undone = true; clearTimeout(timer);
      setPeriodOrders(prev => [order, ...prev].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    });
  };

  // ──────────────────────────────────────────────
  // MENU ITEM CRUD
  // ──────────────────────────────────────────────
  const saveMenuItem = async () => {
    if (!form.name.trim() || !form.category.trim() || !form.price) return;
    const payload = { category: form.category.trim(), name: form.name.trim(), price: parseInt(form.price, 10), applicableToppingGroups: form.applicableToppingGroups || [] };
    if (editingItem) { await update(ref(db, `menu/${editingItem.id}`), payload); }
    else { const newRef = push(ref(db, 'menu')); await set(newRef, payload); }
    setForm({ category: '', name: '', price: '', applicableToppingGroups: [] });
    setEditingItem(null); setMenuView('list');
  };

  const deleteMenuItem = (item) => {
    remove(ref(db, `menu/${item.id}`));
    showToast(`Đã xóa "${item.name}"`, () => {
      set(ref(db, `menu/${item.id}`), {
        category: item.category, name: item.name,
        price: item.price, applicableToppingGroups: item.applicableToppingGroups || []
      });
    });
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
    if (editingItem?.type === 'group') { await update(ref(db, `toppingGroups/${editingItem.id}`), { name: groupForm.name.trim() }); }
    else { const newRef = push(ref(db, 'toppingGroups')); await set(newRef, { name: groupForm.name.trim(), items: {} }); }
    setGroupForm({ name: '' }); setEditingItem(null); setMenuView('list');
  };

  const deleteGroup = (group) => {
    remove(ref(db, `toppingGroups/${group.id}`));
    showToast(`Đã xóa nhóm "${group.name}"`, () => {
      const itemsObj = (group.items || []).reduce((acc, id) => ({ ...acc, [id]: true }), {});
      set(ref(db, `toppingGroups/${group.id}`), { name: group.name, items: itemsObj });
    });
  };

  const saveTopping = async () => {
    if (!toppingForm.name.trim() || !toppingForm.price) return;
    const payload = { name: toppingForm.name.trim(), price: parseInt(toppingForm.price, 10) };
    if (editingItem?.type === 'topping') { await update(ref(db, `toppings/${editingItem.id}`), payload); }
    else { const newRef = push(ref(db, 'toppings')); await set(newRef, payload); }
    setToppingForm({ name: '', price: '' }); setEditingItem(null); setMenuView('list');
  };

  const deleteTopping = (t) => {
    remove(ref(db, `toppings/${t.id}`));
    showToast(`Đã xóa topping "${t.name}"`, () => {
      set(ref(db, `toppings/${t.id}`), { name: t.name, price: t.price });
    });
  };

  const toggleToppingForGroup = async (groupId, toppingId, isActive) => {
    if (isActive) await remove(ref(db, `toppingGroups/${groupId}/items/${toppingId}`));
    else await set(ref(db, `toppingGroups/${groupId}/items/${toppingId}`), true);
  };

  // ──────────────────────────────────────────────
  // REPORT DATA
  // ──────────────────────────────────────────────
  const fetchPeriodData = async (period, forceRefresh = false) => {
    const cached = loadReportCache(period);
    if (cached && !forceRefresh) {
      setCachedReport(cached);
      setPeriodOrders(cached.curr?.rawOrders || []);
      setTimeout(() => fetchPeriodData(period, true), 0);
      return;
    }
    setIsLoadingPeriod(!cached);
    try {
      const getPeriodRange = (p) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(today.getTime() + 86400000 - 1);
        if (p === 'today') return { start: today, end: todayEnd, prevStart: new Date(today.getTime() - 86400000), prevEnd: new Date(today.getTime() - 1) };
        if (p === 'week') { const day = today.getDay() || 7; const ws = new Date(today.getTime() - (day - 1) * 86400000); return { start: ws, end: todayEnd, prevStart: new Date(ws.getTime() - 7 * 86400000), prevEnd: new Date(ws.getTime() - 1) }; }
        const ms = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: ms, end: todayEnd, prevStart: new Date(now.getFullYear(), now.getMonth() - 1, 1), prevEnd: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) };
      };
      const range = getPeriodRange(period);
      const sk = dateKey(range.start), ek = dateKey(range.end);
      const psk = dateKey(range.prevStart), pek = dateKey(range.prevEnd);
      const [currSnap, prevSnap] = await Promise.all([
        get(query(ref(db, 'orders'), orderByKey(), startAt(sk), endAt(ek))),
        get(query(ref(db, 'orders'), orderByKey(), startAt(psk), endAt(pek))),
      ]);
      const extract = (snap) => Object.entries(snap.val() || {}).flatMap(([dk, d]) =>
        Object.entries(d || {}).map(([id, o]) => ({ id, dateKey: dk, ...o }))
      ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const agg = (orders, raw) => ({
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
        rawOrders: raw ? orders : [],
      });
      const currOrders = extract(currSnap); const prevOrders = extract(prevSnap);
      const report = { curr: agg(currOrders, true), prev: agg(prevOrders, false) };
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
  // MENU FORM VIEWS (early returns)
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
  // ROOT RENDER
  // ──────────────────────────────────────────────
  const StatusBadge = isOnline
    ? <span className="cloud-badge ok"><Wifi size={12} /> Online</span>
    : <span className="cloud-badge error"><WifiOff size={12} /> Offline</span>;

  return (
    <div className="app-container">
      <main ref={mainContentRef} className="main-content">
        {activeTab === 'order' && (
          <OrderTab
            isLoading={isLoading}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            displayItems={displayItems} hasMonthlyData={hasMonthlyData} monthlyItemStats={monthlyItemStats}
            handleAddItem={handleAddItem}
            showToppingSheet={showToppingSheet} closeSheet={closeSheet}
            selectedItemToAdd={selectedItemToAdd} selectedToppings={selectedToppings}
            toggleTopping={toggleTopping} confirmAddItem={confirmAddItem}
            toppingGroups={toppingGroups} toppings={toppings}
            sheetRef={sheetRef} sheetOverlayRef={sheetOverlayRef}
            statusBadge={StatusBadge}
          />
        )}
        {activeTab === 'report' && (
          <ReportTab
            reportPeriod={reportPeriod} setReportPeriod={setReportPeriod}
            cachedReport={cachedReport} periodOrders={periodOrders} isLoadingPeriod={isLoadingPeriod}
            fetchPeriodData={fetchPeriodData} deleteOrder={deleteOrder}
          />
        )}
        {activeTab === 'menu' && (
          <MenuTab
            menuItems={menuItems} toppingGroups={toppingGroups} toppings={toppings} categories={categories}
            menuTab={menuTab} setMenuTab={setMenuTab}
            expandedGroups={expandedGroups} setExpandedGroups={setExpandedGroups}
            setMenuView={setMenuView} startEditItem={startEditItem} deleteMenuItem={deleteMenuItem}
            saveGroup={saveGroup} deleteGroup={deleteGroup}
            editingItem={editingItem} setEditingItem={setEditingItem}
            saveTopping={saveTopping} deleteTopping={deleteTopping}
            toggleToppingForGroup={toggleToppingForGroup}
            setGroupForm={setGroupForm} setToppingForm={setToppingForm}
            showConfirm={showConfirm}
          />
        )}
      </main>

      <nav className="bottom-nav">
        <button className={`nav-item ${activeTab === 'order' ? 'active' : ''}`} onClick={() => setActiveTab('order')}><Home size={24} /><span>Bán hàng</span></button>
        <button className={`nav-item ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}><BarChart3 size={24} /><span>Báo cáo</span></button>
        <button className={`nav-item ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => setActiveTab('menu')}><Settings size={24} /><span>Menu</span></button>
      </nav>

      {/* Toast */}
      {toast && (
        <div ref={toastRef} className="toast">
          <span>{toast.message}</span>
          <button className="toast-undo" onClick={toast.onUndo}>Hoàn tác</button>
        </div>
      )}

      {/* Current Order Bar */}
      {activeTab === 'order' && currentOrder.length > 0 && (
        <div className="current-order-bar">
          <div className="mini-order-list">
            {currentOrder.map(item => (
              <SwipeToDelete key={item.cartId} onDelete={() => removeCartItem(item.cartId)}>
                <div className="mini-order-item">
                  <span className="mini-item-name">
                    {item.name}
                    {item.toppings?.length > 0 && <span className="mini-toppings"> · {item.toppings.map(t => t.name).join(', ')}</span>}
                  </span>
                  <div className="mini-item-actions">
                    <span className="mini-item-price">{formatPrice(item.totalPrice)}</span>
                    <button className="mini-re-add" onClick={() => quickReAdd(item)}><Plus size={12} /></button>
                  </div>
                </div>
              </SwipeToDelete>
            ))}
          </div>
          <div className="order-footer">
            <span className="order-total-label">{currentOrder.length} ly · <strong>{formatPrice(currentOrderTotal)}</strong></span>
            <button className="checkout-btn" onClick={completeOrder}>Log món</button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        message={confirmState.message}
        subtext={confirmState.subtext}
        onConfirm={() => { confirmState.onConfirm?.(); hideConfirm(); }}
        onCancel={hideConfirm}
      />
    </div>
  );
}
