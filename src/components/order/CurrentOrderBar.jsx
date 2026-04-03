import React from 'react';
import { Plus } from 'lucide-react';
import SwipeToDelete from '../common/SwipeToDelete';
import { formatPrice } from '../../utils';

export default function CurrentOrderBar({ currentOrder, removeCartItem, quickReAdd, completeOrder }) {
  if (currentOrder.length === 0) return null;

  const currentOrderTotal = currentOrder.reduce((s, i) => s + i.totalPrice, 0);

  return (
    <div className="current-order-bar">
      <div className="mini-order-list">
        {currentOrder.map(item => (
          <SwipeToDelete key={item.cartId} onDelete={() => removeCartItem(item.cartId)}>
            <div className="mini-order-item">
              <span className="mini-item-name">
                {item.name}
                {item.toppings?.length > 0 && (
                  <span className="mini-toppings"> · {item.toppings.map(t => t.name).join(', ')}</span>
                )}
              </span>
              <div className="mini-item-actions">
                <span className="mini-item-price">{formatPrice(item.totalPrice)}</span>
                <button className="mini-re-add" onClick={() => quickReAdd(item)}>
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </SwipeToDelete>
        ))}
      </div>
      <div className="order-footer">
        <span className="order-total-label">
          {currentOrder.length} ly · <strong>{formatPrice(currentOrderTotal)}</strong>
        </span>
        <button className="checkout-btn" onClick={completeOrder}>Log món</button>
      </div>
    </div>
  );
}
