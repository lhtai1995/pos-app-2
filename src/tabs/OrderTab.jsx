import React from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Check, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '../utils';

export default function OrderTab({
  isLoading, searchQuery, setSearchQuery,
  displayItems, hasMonthlyData, monthlyItemStats,
  handleAddItem,
  showToppingSheet, closeSheet, selectedItemToAdd, selectedToppings,
  toggleTopping, confirmAddItem, toppingGroups, toppings,
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
        <AnimatePresence>
          {showToppingSheet && (() => {
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
              <motion.div 
                className="fixed inset-0 bg-black/45 z-[1000] flex flex-col justify-end backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeSheet}
              >
                <motion.div 
                  className="bg-[#F3F4F6] w-full max-h-[90vh] rounded-t-[20px] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] flex flex-col relative overflow-hidden"
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 280 }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex-1 overflow-y-auto pb-[90px]">
                    <div className="flex justify-between items-center p-5 pb-3 sticky top-0 bg-[#F3F4F6] z-10 border-b border-gray-200/60">
                      <div>
                        <h3 className="text-[1.15rem] font-bold text-gray-800 m-0 leading-tight">Chọn topping</h3>
                        <p className="text-[0.88rem] text-indigo-600 font-semibold m-0 mt-1">{selectedItemToAdd?.name}</p>
                      </div>
                      <button 
                        className="w-9 h-9 border-none rounded-full bg-gray-200/80 text-gray-500 flex items-center justify-center cursor-pointer hover:bg-gray-300 active:opacity-75 transition-colors" 
                        onClick={closeSheet}
                      >
                        <X size={20} />
                      </button>
                    </div>
                    {resolvedGroups.every(g => g.resolvedItems.length === 0) ? (
                      <p className="p-4 text-center text-gray-500 text-[0.92rem]">Món này không có topping</p>
                    ) : (
                      <div className="p-4 pt-2">
                        {resolvedGroups.map(group => group.resolvedItems.length > 0 && (
                          <div key={group.id} className="mb-5 last:mb-0">
                            <p className="text-[0.82rem] font-bold text-gray-500 uppercase tracking-wider mb-2.5 ml-1">{group.name}</p>
                            {group.resolvedItems.map(topping => {
                              const isSel = selectedToppings.find(t => t.id === topping.id);
                              return (
                                <div 
                                  key={topping.id} 
                                  className={`flex justify-between items-center p-3.5 mb-2 rounded-[14px] bg-white border border-gray-200 cursor-pointer shadow-sm transition-all ${isSel ? 'border-none ring-2 ring-indigo-500 bg-indigo-50 shadow-[0_4px_12px_rgba(79,70,229,0.15)]' : 'hover:border-indigo-300'}`} 
                                  onClick={() => toggleTopping(topping)}
                                >
                                  <span className={`text-[0.93rem] ${isSel ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>{topping.name}</span>
                                  <div className="flex items-center gap-2 text-[0.9rem] font-semibold text-gray-500">
                                    <span className={isSel ? "text-indigo-600" : ""}>+{formatPrice(topping.price)}</span>
                                    {isSel && <Check size={16} className="text-white bg-indigo-600 rounded-full p-0.5" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex flex-col gap-3 z-20">
                    {selectedToppings.length > 0 && (
                      <div className="flex flex-wrap gap-[5px] text-[0.82rem] font-semibold text-gray-600 px-1">
                        <span className="text-gray-900">{selectedItemToAdd?.name}</span>
                        {selectedToppings.map(t => <span key={t.id} className="bg-gray-100 px-2 py-0.5 rounded-full">+ {t.name}</span>)}
                      </div>
                    )}
                    <button 
                      className="w-full py-3.5 rounded-xl border-none bg-indigo-600 text-white font-bold text-[1.05rem] cursor-pointer shadow-[0_4px_16px_rgba(79,70,229,0.35)] hover:bg-indigo-700 active:scale-[0.98] transition-all flex justify-center items-center" 
                      onClick={confirmAddItem}
                    >
                      Thêm vào đơn — {formatPrice((selectedItemToAdd?.price || 0) + toppingTotal)}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>, 
        document.body
      )}
    </div>
  );
}
