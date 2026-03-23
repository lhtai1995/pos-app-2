import React from 'react';
import { Trash2 } from 'lucide-react';

export default function ConfirmDialog({ message, subtext, onConfirm, onCancel }) {
  if (!message) return null;
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon"><Trash2 size={22} /></div>
        <p className="confirm-message">{message}</p>
        {subtext && <p className="confirm-subtext">{subtext}</p>}
        <div className="confirm-actions">
          <button className="confirm-cancel-btn" onClick={onCancel}>Huỷ</button>
          <button className="confirm-ok-btn" onClick={onConfirm}>Xoá</button>
        </div>
      </div>
    </div>
  );
}
