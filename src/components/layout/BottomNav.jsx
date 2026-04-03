import React from 'react';
import { Home, BarChart3, Settings } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab }) {
  return (
    <nav className="bottom-nav">
      <button 
        className={`nav-item ${activeTab === 'order' ? 'active' : ''}`} 
        onClick={() => setActiveTab('order')}
      >
        <Home size={24} />
        <span>Bán hàng</span>
      </button>
      <button 
        className={`nav-item ${activeTab === 'report' ? 'active' : ''}`} 
        onClick={() => setActiveTab('report')}
      >
        <BarChart3 size={24} />
        <span>Báo cáo</span>
      </button>
      <button 
        className={`nav-item ${activeTab === 'menu' ? 'active' : ''}`} 
        onClick={() => setActiveTab('menu')}
      >
        <Settings size={24} />
        <span>Menu</span>
      </button>
    </nav>
  );
}
