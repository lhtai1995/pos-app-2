import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

// ── Tabs ──
import OrderTab from './tabs/OrderTab';
import ReportTab from './tabs/ReportTab';
import MenuTab from './tabs/MenuTab';

// ── Components ──
import ConfirmDialog from './components/common/ConfirmDialog';
import StatusBadge from './components/common/StatusBadge';
import Toast from './components/common/Toast';
import BottomNav from './components/layout/BottomNav';
import CurrentOrderBar from './components/order/CurrentOrderBar';
import ToppingSheet from './components/order/ToppingSheet';

// ── Logic ──
import { useAppLogic } from './hooks/useAppLogic';

export default function App() {
  const logic = useAppLogic();
  const mainContentRef = useRef(null);

  // ── Derived View logic ──
  const { menuItems, activeTab, searchQuery, monthlyItemStats } = logic;
  const filteredItems = searchQuery
    ? menuItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.category.toLowerCase().includes(searchQuery.toLowerCase()))
    : menuItems;
  const hasMonthlyData = Object.keys(monthlyItemStats).length > 0;
  const top10MenuItems = hasMonthlyData
    ? [...menuItems].sort((a, b) => (monthlyItemStats[b.name] || 0) - (monthlyItemStats[a.name] || 0)).slice(0, 10)
    : [];
  const displayItems = searchQuery ? filteredItems : hasMonthlyData ? top10MenuItems : menuItems;

  // ── Tab Animation ──
  useEffect(() => {
    if (mainContentRef.current) {
      gsap.fromTo(mainContentRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
    }
  }, [activeTab]);

  // ── Early returns for Menu Form views ──
  if (logic.menuView !== 'list') {
    return logic.menuView === 'addItem' || logic.menuView === 'editItem' ? (
      <div className="app-container"><main className="main-content"><MenuFormItem logic={logic} /></main></div>
    ) : logic.menuView === 'addGroup' || logic.menuView === 'editGroup' ? (
      <div className="app-container"><main className="main-content"><MenuGroupForm logic={logic} /></main></div>
    ) : (
      <div className="app-container"><main className="main-content"><MenuToppingForm logic={logic} /></main></div>
    );
  }

  return (
    <div className="app-container">
      <main ref={mainContentRef} className="main-content">
        {activeTab === 'order' && (
          <OrderTab
            isLoading={logic.isLoading}
            searchQuery={searchQuery} setSearchQuery={logic.setSearchQuery}
            displayItems={displayItems} hasMonthlyData={hasMonthlyData} monthlyItemStats={monthlyItemStats}
            handleAddItem={logic.handleAddItem}
            statusBadge={<StatusBadge isOnline={logic.isOnline} />}
          />
        )}
        {activeTab === 'report' && (
          <ReportTab
            reportPeriod={logic.reportPeriod} setReportPeriod={logic.setReportPeriod}
            cachedReport={logic.cachedReport} periodOrders={logic.periodOrders} isLoadingPeriod={logic.isLoadingPeriod}
            fetchPeriodData={logic.fetchPeriodData} deleteOrder={logic.deleteOrder}
          />
        )}
        {activeTab === 'menu' && (
          <MenuTab
            menuItems={menuItems} toppingGroups={logic.toppingGroups} toppings={logic.toppings} categories={[...new Set(menuItems.map(i => i.category))]}
            menuTab={logic.menuTab} setMenuTab={logic.setMenuTab}
            expandedGroups={logic.expandedGroups} setExpandedGroups={logic.setExpandedGroups}
            setMenuView={logic.setMenuView} startEditItem={(item) => {
              logic.setEditingItem(item);
              logic.setForm({ category: item.category, name: item.name, price: String(item.price), applicableToppingGroups: item.applicableToppingGroups || [] });
              logic.setMenuView('editItem');
            }} deleteMenuItem={logic.deleteMenuItem}
            saveGroup={logic.saveGroup} deleteGroup={logic.deleteGroup}
            editingItem={logic.editingItem} setEditingItem={logic.setEditingItem}
            saveTopping={logic.saveTopping} deleteTopping={logic.deleteTopping}
            toggleToppingForGroup={logic.toggleToppingForGroup}
            setGroupForm={logic.setGroupForm} setToppingForm={logic.setToppingForm}
            showConfirm={logic.showConfirm}
          />
        )}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={logic.setActiveTab} />

      <Toast toast={logic.toast} setToast={logic.setToast} />

      <CurrentOrderBar 
        currentOrder={logic.currentOrder} 
        removeCartItem={logic.removeCartItem} 
        quickReAdd={(item) => { logic.setSelectedItemToAdd(item); logic.setSelectedToppings([]); logic.setShowToppingSheet(true); }} 
        completeOrder={logic.completeOrder} 
      />

      <ToppingSheet 
        showToppingSheet={logic.showToppingSheet} closeSheet={logic.closeSheet}
        selectedItemToAdd={logic.selectedItemToAdd} selectedToppings={logic.selectedToppings}
        toggleTopping={logic.toggleTopping} confirmAddItem={logic.confirmAddItem}
        toppingGroups={logic.toppingGroups} toppings={logic.toppings}
      />

      <ConfirmDialog
        message={logic.confirmState.message}
        subtext={logic.confirmState.subtext}
        onConfirm={() => { logic.confirmState.onConfirm?.(); logic.hideConfirm(); }}
        onCancel={logic.hideConfirm}
      />
    </div>
  );
}

// ── Helper Sub-Components for Forms (keep App.jsx readable) ──
function MenuFormItem({ logic }) {
  const { form, setForm, menuView, setMenuView, toppingGroups, saveMenuItem, setEditingItem } = logic;
  const cats = [...new Set(logic.menuItems.map(i => i.category))];
  return (
    <div className="form-page">
      <header className="header header-with-back">
        <button className="back-btn" onClick={() => { setMenuView('list'); setEditingItem(null); setForm({ category: '', name: '', price: '', applicableToppingGroups: [] }); }}><X_Icon /></button>
        <h2>{menuView === 'editItem' ? 'Chỉnh sửa món' : 'Thêm món mới'}</h2>
        <div style={{ width: 36 }} />
      </header>
      <div className="form-body">
        <div className="form-group"><label>Danh mục</label>
          <input className="form-input" placeholder="VD: Coffee, Trà Trái Cây..." value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} list="cat-list" />
          <datalist id="cat-list">{cats.map(c => <option key={c} value={c} />)}</datalist>
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
            <div className="topping-checklist">
              {toppingGroups.map(group => {
                const checked = (form.applicableToppingGroups || []).includes(group.id);
                return (
                  <label key={group.id} className={`topping-check-item ${checked ? 'checked' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => setForm(p => ({
                      ...p, applicableToppingGroups: checked ? p.applicableToppingGroups.filter(id => id !== group.id) : [...p.applicableToppingGroups, group.id],
                    }))} />
                    <div className="topping-check-info"><span className="topping-check-name">{group.name}</span></div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        <button className="save-btn" onClick={saveMenuItem}><Check_Icon /> Save</button>
      </div>
    </div>
  );
}

function MenuGroupForm({ logic }) {
  const { groupForm, setGroupForm, menuView, setMenuView, setEditingItem, saveGroup } = logic;
  return (
    <div className="form-page">
      <header className="header header-with-back">
        <button className="back-btn" onClick={() => { setMenuView('list'); setEditingItem(null); setGroupForm({ name: '' }); }}><X_Icon /></button>
        <h2>{menuView === 'editGroup' ? 'Sửa nhóm' : 'Thêm nhóm'}</h2>
        <div style={{ width: 36 }} />
      </header>
      <div className="form-body">
        <div className="form-group"><label>Tên nhóm</label>
          <input className="form-input" placeholder="VD: Trân Châu" value={groupForm.name} onChange={e => setGroupForm({ name: e.target.value })} />
        </div>
        <button className="save-btn" onClick={saveGroup}><Check_Icon /> Lưu</button>
      </div>
    </div>
  );
}

function MenuToppingForm({ logic }) {
  const { toppingForm, setToppingForm, menuView, setMenuView, setEditingItem, saveTopping } = logic;
  const isEdit = menuView === 'editTopping';
  return (
    <div className="form-page">
      <header className="header header-with-back">
        <button className="back-btn" onClick={() => { setMenuView('list'); setEditingItem(null); setToppingForm({ name: '', price: '' }); }}><X_Icon /></button>
        <h2>{isEdit ? 'Sửa topping' : 'Thêm topping'}</h2>
        <div style={{ width: 36 }} />
      </header>
      <div className="form-body">
        <div className="form-group"><label>Tên topping</label>
          <input className="form-input" placeholder="VD: Trân Châu" value={toppingForm.name} onChange={e => setToppingForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="form-group"><label>Giá (VNĐ)</label>
          <input className="form-input" type="number" placeholder="VD: 5000" value={toppingForm.price} onChange={e => setToppingForm(p => ({ ...p, price: e.target.value }))} />
        </div>
        <button className="save-btn" onClick={saveTopping}><Check_Icon /> Lưu</button>
      </div>
    </div>
  );
}

// Minimal icons for internal helpers
const X_Icon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
const Check_Icon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
);
