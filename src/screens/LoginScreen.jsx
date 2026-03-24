import React, { useState } from 'react';
import { LogIn, User, ShieldCheck, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const getStoredPin = () => localStorage.getItem('dol_admin_pin') || '1234';

export default function LoginScreen({ onLogin }) {
  const [step, setStep] = useState('role'); // 'role' | 'pin'
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  const handleStaff = () => onLogin('staff');

  const handleAdminSubmit = () => {
    if (pin === getStoredPin()) {
      onLogin('admin');
    } else {
      setError('Mã PIN không đúng, thử lại');
      setPin('');
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  const handlePinKey = (digit) => {
    if (pin.length >= 6) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length >= 4) {
      // auto-verify after 4+ digits on keypad press
    }
  };

  const handleBackspace = () => setPin(p => p.slice(0, -1));

  return (
    <div className="login-screen">
      {/* Logo area */}
      <div className="login-logo-area">
        <img src="/icon.png" alt="Trạm 81" className="login-logo-img" />
        <p className="login-subtitle">Hệ thống quản lý bán hàng</p>
      </div>

      {step === 'role' ? (
        <div className="login-role-select">
          <p className="login-prompt">Chọn vai trò của bạn</p>
          <div className="role-cards">
            {/* Staff card */}
            <button className="role-card role-staff" onClick={handleStaff}>
              <div className="role-card-icon"><User size={28} /></div>
              <div className="role-card-body">
                <h3>Nhân viên</h3>
                <p>Log món & xem lịch sử hôm nay</p>
              </div>
              <LogIn size={18} className="role-card-arrow" />
            </button>

            {/* Admin card */}
            <button className="role-card role-admin" onClick={() => setStep('pin')}>
              <div className="role-card-icon"><ShieldCheck size={28} /></div>
              <div className="role-card-body">
                <h3>Quản lý</h3>
                <p>Toàn quyền · Báo cáo · Menu</p>
              </div>
              <LogIn size={18} className="role-card-arrow" />
            </button>
          </div>
        </div>
      ) : (
        <div className={`pin-entry ${shaking ? 'shake' : ''}`}>
          <button className="pin-back-btn" onClick={() => { setStep('role'); setPin(''); setError(''); }}>
            <ArrowLeft size={18} /> Quay lại
          </button>

          <div className="pin-header">
            <div className="pin-icon"><ShieldCheck size={24} /></div>
            <h3>Nhập mã PIN quản lý</h3>
            <p>Mặc định: <strong>1234</strong></p>
          </div>

          {/* Dot indicators */}
          <div className="pin-dots">
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
            ))}
          </div>

          {error && <p className="pin-error">{error}</p>}

          {/* Number pad */}
          <div className="pin-pad">
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, idx) => (
              <button
                key={idx}
                className={`pin-key ${k === '' ? 'invisible' : ''} ${k === '⌫' ? 'backspace' : ''}`}
                onClick={() => {
                  if (k === '⌫') handleBackspace();
                  else if (k !== '') handlePinKey(k);
                }}
              >{k}</button>
            ))}
          </div>

          <button
            className="pin-confirm-btn"
            onClick={handleAdminSubmit}
            disabled={pin.length < 4}
          >
            Xác nhận
          </button>
        </div>
      )}

      <p className="login-version">Trạm 81 POS · v2.0</p>
    </div>
  );
}
