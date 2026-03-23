import React from 'react';
import {
  Plus, Trash2, Edit2, Check, X, FolderPlus, ChevronDown, ChevronUp,
} from 'lucide-react';
import { formatPrice } from '../utils';

// ── Menu List Tab ──
export default function MenuTab({
  menuItems, toppingGroups, toppings, categories,
  menuTab, setMenuTab,
  expandedGroups, setExpandedGroups,
  setMenuView, startEditItem, deleteMenuItem,
  saveGroup, deleteGroup, editingItem, setEditingItem,
  saveTopping, deleteTopping,
  toggleToppingForGroup,
  setGroupForm, setToppingForm,
  showConfirm,
}) {
  return (
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
                  <button className="action-btn delete" onClick={() => showConfirm(`Xoá topping "${t.name}"?`, 'Hành động này không thể hoàn tác.', () => deleteTopping(t.id))}><Trash2 size={15} /></button>
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
                  <button className="action-btn delete" onClick={() => showConfirm(`Xoá nhóm "${group.name}"?`, 'Topping lẻ không bị xoá, chỉ nhóm bị xoá.', () => deleteGroup(group.id))}><Trash2 size={14} /></button>
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
                          {isInGroup
                            ? <Check size={20} color="var(--primary)" />
                            : <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderRadius: '4px' }} />
                          }
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
}
