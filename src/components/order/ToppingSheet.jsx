import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { gsap } from 'gsap';
import { formatPrice } from '../../utils';

export default function ToppingSheet({
  showToppingSheet, closeSheet, selectedItemToAdd, selectedToppings,
  toggleTopping, confirmAddItem, toppingGroups, toppings,
}) {
  const sheetRef = useRef(null);
  const sheetOverlayRef = useRef(null);

  useEffect(() => {
    if (showToppingSheet && sheetRef.current) {
      gsap.set(sheetRef.current, { y: '100%' });
      gsap.set(sheetOverlayRef.current, { opacity: 0 });
      gsap.to(sheetOverlayRef.current, { opacity: 1, duration: 0.2, ease: 'power2.out' });
      gsap.to(sheetRef.current, { y: '0%', duration: 0.38, ease: 'power3.out' });
    }
  }, [showToppingSheet]);

  const handleClose = () => {
    if (sheetRef.current) {
      gsap.to(sheetOverlayRef.current, { opacity: 0, duration: 0.2 });
      gsap.to(sheetRef.current, { y: '100%', duration: 0.3, ease: 'power3.in', onComplete: closeSheet });
    } else {
      closeSheet();
    }
  };

  if (!showToppingSheet) return null;

  const appGroupIds = selectedItemToAdd?.applicableToppingGroups || [];
  const visibleGroups = appGroupIds.length > 0
    ? toppingGroups.filter(g => appGroupIds.includes(g.id))
    : toppingGroups;
  const resolvedGroups = visibleGroups.map(g => ({
    ...g,
    resolvedItems: g.items.map(tid => toppings.find(t => t.id === tid)).filter(Boolean)
  }));
  const toppingTotal = selectedToppings.reduce((s, t) => s + t.price, 0);

  return createPortal(
    <div 
      ref={sheetOverlayRef}
      className="bottom-sheet-overlay"
      onClick={handleClose}
    >
      <div 
        ref={sheetRef}
        className="bottom-sheet"
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-scroll-body">
          <div className="sheet-header">
            <div>
              <h3>Chọn topping</h3>
              <p>{selectedItemToAdd?.name}</p>
            </div>
            <button className="sheet-close" onClick={handleClose}>
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
    </div>,
    document.body
  );
}
