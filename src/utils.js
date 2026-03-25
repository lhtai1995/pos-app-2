// ── Shared utility functions ──
export const formatPrice = (p) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p);

export const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const dateKey = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Parse Firebase snapshots
export const parseMenu = (snap) => {
  const data = snap.val() || {};
  return Object.entries(data).map(([id, v]) => ({
    id, category: v.category, name: v.name, price: v.price,
    applicableToppingGroups: v.applicableToppingGroups || [],
  }));
};

export const parseGroups = (snap) => {
  const data = snap.val() || {};
  return Object.entries(data).map(([id, v]) => ({
    id, name: v.name,
    items: v.items ? Object.keys(v.items).filter(k => v.items[k] === true) : [],
  }));
};

export const parseToppings = (snap) => {
  const data = snap.val() || {};
  return Object.entries(data).map(([id, v]) => ({ id, name: v.name, price: v.price }));
};

export const parseDayOrders = (snap, dateStr) => {
  const data = snap.val() || {};
  return Object.entries(data)
    .map(([id, v]) => ({ id, dateKey: dateStr, ...v }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};
