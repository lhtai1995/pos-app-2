import React from 'react';
import { Plus, Search, X } from 'lucide-react';
import { formatPrice } from '../utils';

export default function OrderTab({
  isLoading, searchQuery, setSearchQuery,
  displayItems, hasMonthlyData, monthlyItemStats,
  handleAddItem,
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
    </div>
  );
}
