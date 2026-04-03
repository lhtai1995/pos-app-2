import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export default function Toast({ toast, setToast }) {
  const toastRef = useRef(null);

  useEffect(() => {
    if (toast && toastRef.current) {
      gsap.fromTo(toastRef.current, 
        { y: 80, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.35, ease: 'back.out(1.5)' }
      );
    }
  }, [toast]);

  if (!toast) return null;

  return (
    <div ref={toastRef} className="toast">
      <span>{toast.message}</span>
      {toast.onUndo && (
        <button className="toast-undo" onClick={() => { toast.onUndo(); setToast(null); }}>
          Hoàn tác
        </button>
      )}
    </div>
  );
}
