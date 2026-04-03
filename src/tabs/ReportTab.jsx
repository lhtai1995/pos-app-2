import React from 'react';
import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { formatPrice } from '../utils';
import SwipeToDelete from '../components/common/SwipeToDelete';

const getPeriodRange = (period) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(today.getTime() + 86400000 - 1);
  if (period === 'today') return {
    start: today, end: todayEnd,
    prevStart: new Date(today.getTime() - 86400000), prevEnd: new Date(today.getTime() - 1),
    label: 'Hôm nay', prevLabel: 'Hôm qua',
  };
  if (period === 'week') {
    const day = today.getDay() || 7;
    const weekStart = new Date(today.getTime() - (day - 1) * 86400000);
    return {
      start: weekStart, end: todayEnd,
      prevStart: new Date(weekStart.getTime() - 7 * 86400000), prevEnd: new Date(weekStart.getTime() - 1),
      label: 'Tuần này', prevLabel: 'Tuần trước',
    };
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: monthStart, end: todayEnd,
    prevStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    prevEnd: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    label: 'Tháng này', prevLabel: 'Tháng trước',
  };
};

export default function ReportTab({
  reportPeriod, setReportPeriod,
  cachedReport, periodOrders, isLoadingPeriod,
  fetchPeriodData, deleteOrder,
}) {
  const range = getPeriodRange(reportPeriod);
  const curr = cachedReport?.curr || {};
  const prev = cachedReport?.prev || {};
  const currRevenue = curr.revenue ?? 0;
  const prevRevenue = prev.revenue ?? 0;
  const currCount   = curr.count   ?? 0;
  const prevCount   = prev.count   ?? 0;
  const currOrders  = curr.orders  ?? 0;
  const prevOrders  = prev.orders  ?? 0;
  const byDay       = curr.byDay   ?? {};

  const chartData = Object.entries(byDay)
    .sort((a, b) => {
      const [d1, m1] = a[0].split('/').map(Number);
      const [d2, m2] = b[0].split('/').map(Number);
      return m1 === m2 ? d1 - d2 : m1 - m2;
    })
    .map(([day, data]) => ({ day, revenue: data.revenue, count: data.count }));

  const pct = (c, p) => !p ? (c > 0 ? 100 : 0) : Math.round(((c - p) / p) * 100);

  const Trend = ({ curr, prev }) => {
    const p = pct(curr, prev);
    if (!prev && !curr) return null;
    const isUp = p >= 0;
    return (
      <span className={`trend ${isUp ? 'up' : 'down'}`}>
        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {Math.abs(p)}% vs {range.prevLabel}
      </span>
    );
  };

  const formatRevTickY = (v) => {
    if (v >= 1000000) return `${(v/1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v/1000).toFixed(0)}k`;
    return v;
  };

  // Top items
  const itemStats = {};
  periodOrders.forEach(order => {
    (order.items || []).forEach(item => {
      const key = item.name;
      if (!itemStats[key]) itemStats[key] = { name: key, count: 0, revenue: 0 };
      itemStats[key].count += 1;
      itemStats[key].revenue += item.totalPrice || 0;
    });
  });
  const topItems = Object.values(itemStats).sort((a, b) => b.count - a.count).slice(0, 10);
  const maxCount = topItems[0]?.count || 1;

  return (
    <div className="report-tab">
      <header className="header">
        <div className="header-row">
          <h2>Báo cáo</h2>
          <button className={`refresh-btn ${isLoadingPeriod ? 'spinning' : ''}`} onClick={() => fetchPeriodData(reportPeriod, true)}>
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="period-tabs">
          {[['today', 'Hôm nay'], ['week', 'Tuần này'], ['month', 'Tháng này']].map(([key, label]) => (
            <button key={key} className={`period-tab ${reportPeriod === key ? 'active' : ''}`} onClick={() => setReportPeriod(key)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="report-body">
        {isLoadingPeriod ? <div className="loading-state">Đang tải báo cáo...</div> : (
          <>
            <div className="report-summary">
              <div className="summary-card total">
                <p>Doanh thu</p><h3>{formatPrice(currRevenue)}</h3>
                <Trend curr={currRevenue} prev={prevRevenue} />
              </div>
              <div className="summary-card count">
                <p>Ly bán</p><h3>{currCount} ly</h3>
                <Trend curr={currCount} prev={prevCount} />
              </div>
              <div className="summary-card orders">
                <p>Đơn hàng</p><h3>{currOrders} đơn</h3>
                <Trend curr={currOrders} prev={prevOrders} />
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="chart-card">
                <div className="chart-card-header">
                  <h3 className="chart-title">Tương quan Doanh thu & Số ly</h3>
                  <span className="chart-unit">VNĐ / ly</span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: -10, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="countGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" tickFormatter={formatRevTickY} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area yAxisId="left" type="monotone" dataKey="revenue" name="Doanh thu" stroke="#4F46E5" strokeWidth={2.5} fill="url(#revenueGradient)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                    <Bar yAxisId="right" dataKey="count" name="Số ly" fill="url(#countGradient)" barSize={14} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {topItems.length > 0 && (
              <div className="top-items-card">
                <div className="chart-card-header">
                  <h3 className="chart-title">🏆 Món bán chạy</h3>
                  <span className="chart-unit">{range.label}</span>
                </div>
                <div className="top-items-list">
                  {topItems.map((item, idx) => (
                    <div key={item.name} className="top-item-row">
                      <span className={`top-item-rank rank-${idx + 1}`}>{idx + 1}</span>
                      <div className="top-item-info">
                        <div className="top-item-name-row">
                          <span className="top-item-name">{item.name}</span>
                          <span className="top-item-count">{item.count} ly</span>
                        </div>
                        <div className="top-item-bar-track">
                          <div className="top-item-bar-fill" style={{ width: `${(item.count / maxCount) * 100}%` }} />
                        </div>
                      </div>
                      <span className="top-item-revenue">{formatPrice(item.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reportPeriod !== 'today' && Object.keys(byDay).length > 0 && (
              <div className="day-breakdown">
                <h3>Chi tiết theo ngày</h3>
                {Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).map(([day, data]) => (
                  <div key={day} className="day-row">
                    <span className="day-label">{day}</span>
                    <span className="day-count">{data.count} ly</span>
                    <span className="day-revenue">{formatPrice(data.revenue)}</span>
                  </div>
                ))}
              </div>
            )}

            {reportPeriod === 'today' && (
              <div className="recent-orders">
                <h3>Giao dịch ({periodOrders.length})</h3>
                {periodOrders.length === 0 ? <p className="empty-state">Chưa có giao dịch nào</p> : (
                  periodOrders.map(order => (
                    <SwipeToDelete key={order.id} onDelete={() => deleteOrder(order)}>
                      <div className="transaction-card">
                        <div className="tx-header">
                          <span className="tx-time">{new Date(order.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="tx-total">{formatPrice(order.total)}</span>
                        </div>
                        <div className="tx-items">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="tx-item">
                              <span>{item.name}</span>
                              {item.toppings?.length > 0 && <span className="tx-toppings">+ {item.toppings.map(t => t.name).join(', ')}</span>}
                              <span className="tx-item-price">{formatPrice(item.totalPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </SwipeToDelete>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
