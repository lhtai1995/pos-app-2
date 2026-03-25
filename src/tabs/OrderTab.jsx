import React from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Check, Search } from 'lucide-react';
import { formatPrice } from '../utils';

export default function OrderTab({
  isLoading, searchQuery, setSearchQuery,
  displayItems, hasMonthlyData, monthlyItemStats,
  handleAddItem,
  showToppingSheet, closeSheet, selectedItemToAdd, selectedToppings,
  toggleTopping, confirmAddItem, toppingGroups, toppings,
  sheetRef, sheetOverlayRef,
  statusBadge,
}) {
  return (
    <div className="order-tab">
      <header className="header">
        <div className="header-row"><h2>Bán hàng</h2>{statusBadge}</div>
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input
            className="search-input"
            placeholder={searchQuery ? 'Tìm món...' : '🔍 Tìm món khác...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}><X size={14} /></button>
          )}
        </div>
      </header>

      <div className="order-body">
        {isLoading ? (
          <div className="loading-state">Đang tải menu...</div>
        ) : displayItems.length === 0 ? (
          <p className="empty-state">Không tìm thấy món nào</p>
        ) : (
          <>
            <p className="order-list-label">
              {searchQuery
                ? `Kết quả tìm kiếm (${displayItems.length})`
                : hasMonthlyData
                  ? '🔥 Top 10 bán chạy tháng này'
                  : `Tất cả món (${displayItems.length})`}
            </p>
            <div className="item-grid premium-grid">
              {displayItems.map(item => (
                <div key={item.id} className="menu-card premium-card" onClick={() => handleAddItem(item)}>
                  <div className="menu-card-info">
                    <p className="item-name">{item.name}</p>
                    <p className="item-price">{formatPrice(item.price)}</p>
                  </div>
                  {monthlyItemStats[item.name] > 0 && !searchQuery && (
                    <span className="item-sold-badge">{monthlyItemStats[item.name]} ly</span>
                  )}
                  <button className="add-btn premium-btn-plus"><Plus size={18} strokeWidth={3} /></button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom Sheet — via Portal */}
      {createPortal(
        showToppingSheet && (() => {
          const appGroupIds = selectedItemToAdd?.applicableToppingGroups || [];
          const visibleGroups = appGroupIds.length > 0
            ? toppingGroups.filter(g => appGroupIds.includes(g.id))
            : toppingGroups;
          const resolvedGroups = visibleGroups.map(g => ({
            ...g,
            resolvedItems: g.items.map(tid => toppings.find(t => t.id === tid)).filter(Boolean)
          }));
          const toppingTotal = selectedToppings.reduce((s, t) => s + t.price, 0);

          return (
            <div 
              ref={sheetOverlayRef}
              className="bottom-sheet-overlay"
              style={{ opacity: 0 }}
              onClick={closeSheet}
            >
              <div 
                ref={sheetRef}
                className="bottom-sheet"
                style={{ transform: 'translateY(100%)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="sheet-scroll-body">
                  <div className="sheet-header">
                    <div>
                      <h3>Chọn topping</h3>
                      <p>{selectedItemToAdd?.name}</p>
                    </div>
                    <button className="sheet-close" onClick={closeSheet}>
                      <X size={20} />
                    </button>
                  </div>

                  {resolvedGroups.every(g => g.resolvedItems.length === 0) ? (
                    <p style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Món này không có topping</p>
                  ) : (
                    <div style={{ padding: '16px', paddingTop: '8px' }}>
                      {resolvedGroups.map(group => group.resolvedItems.length > 0 && (
                        <div key={group.id} style={{ marginBottom: '20px' }}>
                          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', marginLeft: '4px' }}>
                            {group.name}
                          </p>
                          {group.resolvedItems.map(topping => {
                            const isSel = selectedToppings.find(t => t.id === topping.id);
                            return (
                              <div 
                                key={topping.id} 
                                className={`topping-item ${isSel ? 'selected' : ''}`}
                                onClick={() => toggleTopping(topping)}
                              >
                                <span className={isSel ? 'topping-name-sel' : ''}>{topping.name}</span>
                                <div className="topping-actions">
                                  <span>+{formatPrice(topping.price)}</span>
                                  {isSel && <div className="topping-check"><Check size={14} strokeWidth={3} /></div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="sheet-sticky-footer">
                  {selectedToppings.length > 0 && (
                    <div className="sheet-preview">
                      <span style={{ color: 'var(--text-main)' }}>{selectedItemToAdd?.name}</span>
                      {selectedToppings.map(t => <span key={t.id} className="preview-pill">+ {t.name}</span>)}
                    </div>
                  )}
                  <button className="checkout-btn" onClick={confirmAddItem}>
                    Thêm vào đơn — {formatPrice((selectedItemToAdd?.price || 0) + toppingTotal)}
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
}
