import React from 'react';
import { Trash2 } from 'lucide-react';
import { formatPrice } from '../utils';

// Tab lịch sử đơn hàng hôm nay — chỉ dành cho nhân viên
export default function StaffHistoryTab({ todayOrders }) {
  return (
    <div className="report-tab">
      <header className="header">
        <div className="header-row"><h2>Lịch sử hôm nay</h2></div>
      </header>

      <div className="report-body">
        <div className="recent-orders">
          <h3>Giao dịch ({todayOrders.length})</h3>
          {todayOrders.length === 0 ? (
            <p className="empty-state">Chưa có giao dịch nào hôm nay</p>
          ) : (
            todayOrders.map(order => (
              <div key={order.id} className="transaction-card">
                <div className="tx-header">
                  <span className="tx-time">
                    {new Date(order.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="tx-total">{formatPrice(order.total)}</span>
                </div>
                <div className="tx-items">
                  {order.items?.map((item, idx) => (
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
}
