import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ref, set, push, update, remove, onValue, get,
  query, orderByKey, startAt, endAt,
} from 'firebase/database';
import { db } from '../firebase';
import {
  generateId, dateKey,
  parseMenu, parseGroups, parseToppings, parseDayOrders,
} from '../utils';

// ── Cache keys ──
const SK = {
  MENU: 'dol_menu', GROUPS: 'dol_groups',
  ORDERS: 'dol_orders', REPORT: 'dol_report_cache', TOPPINGS: 'dol_toppings',
};
const REPORT_TTL = 5 * 60 * 1000;

const fromStorage = (key) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; } };
const toStorage = (key, data) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} };

export function useAppLogic() {
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

  // ── Toast & Confirm ──
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({ message: '', subtext: '', onConfirm: null });

  // ── Monthly stats ──
  const [monthlyItemStats, setMonthlyItemStats] = useState(
    () => { try { const c = JSON.parse(localStorage.getItem('dol_top_monthly') || '{}'); return c.ts && Date.now() - c.ts < 10*60*1000 ? c.stats : {}; } catch { return {}; } }
  );

  // ── Menu management ──
  const [menuView, setMenuView] = useState('list');
  const [editingItem, setEditingItem] = useState(null);
  const [menuTab, setMenuTab] = useState('items');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [form, setForm] = useState({ category: '', name: '', price: '', applicableToppingGroups: [] });
  const [groupForm, setGroupForm] = useState({ name: '' });
  const [toppingForm, setToppingForm] = useState({ name: '', price: '' });

  // ── Cache report helpers ──
  const loadReportCache = (period) => {
    try { const c = JSON.parse(localStorage.getItem(SK.REPORT) || '{}'); const e = c[period]; if (!e || Date.now() - e.ts > REPORT_TTL) return null; return e.data; } catch { return null; }
  };
  const saveReportCache = (period, data) => {
    try { const c = JSON.parse(localStorage.getItem(SK.REPORT) || '{}'); c[period] = { data, ts: Date.now() }; localStorage.setItem(SK.REPORT, JSON.stringify(c)); } catch {}
  };
  const invalidateReportCache = () => localStorage.removeItem(SK.REPORT);

  // ── Listeners ──
  useEffect(() => {
    const cm = fromStorage(SK.MENU); const cg = fromStorage(SK.GROUPS);
    const ct = fromStorage(SK.TOPPINGS);
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
    onValue(ref(db, `orders/${todayKey}`), snap => { setIsLoading(false); });

    return () => {
      unsubMenu(); unsubGroups(); unsubToppings();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Monthly stats fetch ──
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

  // ── Handlers ──
  const showConfirm = useCallback((message, subtext, onConfirm) => { setConfirmState({ message, subtext, onConfirm }); }, []);
  const hideConfirm = useCallback(() => { setConfirmState({ message: '', subtext: '', onConfirm: null }); }, []);

  const handleAddItem = (item) => {
    setSelectedItemToAdd(item);
    setSelectedToppings([]);
    setShowToppingSheet(true);
  };

  const closeSheet = useCallback(() => {
    setShowToppingSheet(false);
  }, []);

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

  const removeCartItem = (cartId) => setCurrentOrder(prev => prev.filter(i => i.cartId !== cartId));

  const completeOrder = async () => {
    if (!currentOrder.length) return;
    const todayKey = dateKey();
    const newRef = push(ref(db, `orders/${todayKey}`));
    const currentTotal = currentOrder.reduce((s, i) => s + i.totalPrice, 0);
    const newOrder = {
      id: newRef.key, dateKey: todayKey,
      items: currentOrder.map(({ cartId, ...rest }) => rest),
      total: currentTotal,
      timestamp: new Date().toISOString(),
    };
    const backupOrder = [...currentOrder];
    setCurrentOrder([]);
    invalidateReportCache();
    localStorage.removeItem('dol_top_monthly');
    try { await set(newRef, newOrder); } 
    catch (e) { setCurrentOrder(backupOrder); alert('⚠️ Lỗi khi log món!'); shadowLog(e); }
  };

  const showToast = useCallback((message, onUndo) => {
    setToast({ message, onUndo });
    setTimeout(() => setToast(null), 4000);
  }, []);

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

  const deleteOrder = async (order) => {
    const dk = order.dateKey || dateKey(new Date(order.timestamp));
    setPeriodOrders(prev => prev.filter(o => o.id !== order.id));
    invalidateReportCache();
    let undone = false;
    showToast('Đã xóa giao dịch', () => {
      undone = true;
      setPeriodOrders(prev => [order, ...prev].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    });
    setTimeout(async () => {
      if (!undone) {
        try { await remove(ref(db, `orders/${dk}/${order.id}`)); }
        catch (e) { alert('Lỗi xóa giao dịch'); fetchPeriodData(reportPeriod, true); }
      }
    }, 4000);
  };

  const saveMenuItem = async () => {
    if (!form.name.trim() || !form.category.trim() || !form.price) return;
    const payload = { category: form.category.trim(), name: form.name.trim(), price: parseInt(form.price, 10), applicableToppingGroups: form.applicableToppingGroups || [] };
    if (editingItem) { await update(ref(db, `menu/${editingItem.id}`), payload); }
    else { const newRef = push(ref(db, 'menu')); await set(newRef, payload); }
    setForm({ category: '', name: '', price: '', applicableToppingGroups: [] });
    setEditingItem(null); setMenuView('list');
  };

  const deleteMenuItem = async (item) => {
    try {
      await remove(ref(db, `menu/${item.id}`));
      showToast(`Đã xóa "${item.name}"`, () => {
        set(ref(db, `menu/${item.id}`), {
          category: item.category, name: item.name,
          price: item.price, applicableToppingGroups: item.applicableToppingGroups || []
        });
      });
    } catch (e) { alert('Xóa thất bại'); }
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) return;
    if (editingItem?.type === 'group') { await update(ref(db, `toppingGroups/${editingItem.id}`), { name: groupForm.name.trim() }); }
    else { const newRef = push(ref(db, 'toppingGroups')); await set(newRef, { name: groupForm.name.trim(), items: {} }); }
    setGroupForm({ name: '' }); setEditingItem(null); setMenuView('list');
  };

  const deleteGroup = async (group) => {
    try {
      await remove(ref(db, `toppingGroups/${group.id}`));
      showToast(`Đã xóa nhóm "${group.name}"`, () => {
        const itemsObj = (group.items || []).reduce((acc, id) => ({ ...acc, [id]: true }), {});
        set(ref(db, `toppingGroups/${group.id}`), { name: group.name, items: itemsObj });
      });
    } catch (e) { alert('Xóa thất bại'); }
  };

  const saveTopping = async () => {
    if (!toppingForm.name.trim() || !toppingForm.price) return;
    const payload = { name: toppingForm.name.trim(), price: parseInt(toppingForm.price, 10) };
    if (editingItem?.type === 'topping') { await update(ref(db, `toppings/${editingItem.id}`), payload); }
    else { const newRef = push(ref(db, 'toppings')); await set(newRef, payload); }
    setToppingForm({ name: '', price: '' }); setEditingItem(null); setMenuView('list');
  };

  const deleteTopping = async (t) => {
    try {
      await remove(ref(db, `toppings/${t.id}`));
      showToast(`Đã xóa topping "${t.name}"`, () => {
        set(ref(db, `toppings/${t.id}`), { name: t.name, price: t.price });
      });
    } catch (e) { alert('Xóa thất bại'); }
  };

  const toggleToppingForGroup = async (groupId, toppingId, isActive) => {
    if (isActive) await remove(ref(db, `toppingGroups/${groupId}/items/${toppingId}`));
    else await set(ref(db, `toppingGroups/${groupId}/items/${toppingId}`), true);
  };

  return {
    activeTab, setActiveTab,
    menuItems, toppingGroups, toppings,
    isLoading, isOnline,
    currentOrder, setCurrentOrder,
    showToppingSheet, setShowToppingSheet,
    selectedItemToAdd, setSelectedItemToAdd,
    selectedToppings, setSelectedToppings,
    searchQuery, setSearchQuery,
    reportPeriod, setReportPeriod,
    periodOrders, setPeriodOrders,
    cachedReport, setCachedReport,
    isLoadingPeriod, setIsLoadingPeriod,
    toast, setToast,
    confirmState, showConfirm, hideConfirm,
    monthlyItemStats, setMonthlyItemStats,
    menuView, setMenuView,
    editingItem, setEditingItem,
    menuTab, setMenuTab,
    expandedGroups, setExpandedGroups,
    form, setForm,
    groupForm, setGroupForm,
    toppingForm, setToppingForm,
    handleAddItem, closeSheet, toggleTopping, confirmAddItem,
    removeCartItem, completeOrder, deleteOrder,
    fetchPeriodData, saveMenuItem, deleteMenuItem,
    saveGroup, deleteGroup, saveTopping, deleteTopping, toggleToppingForGroup,
  };
}
