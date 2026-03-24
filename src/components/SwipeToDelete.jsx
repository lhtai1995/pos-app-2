import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

const REVEAL_X  = 76;  // px để lộ nút xóa
const DELETE_X  = 210; // px để auto-delete khi quẹt mạnh

export default function SwipeToDelete({ onDelete, children, className = '' }) {
  const wrapperRef  = useRef(null);
  const startX      = useRef(0);
  const startY      = useRef(0);
  const baseOffset  = useRef(0);        // offset tại thời điểm touchstart
  const isScrolling = useRef(null);     // null | true | false
  const revealed    = useRef(false);

  const [offset,    setOffset]    = useState(0);
  const [animating, setAnimating] = useState(true);

  // Snap to position với animation
  const snapTo = useCallback((x, cb) => {
    setAnimating(true);
    setOffset(x);
    revealed.current = x < -4;
    if (cb) setTimeout(cb, 260);
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      startX.current    = e.touches[0].clientX;
      startY.current    = e.touches[0].clientY;
      baseOffset.current = revealed.current ? -REVEAL_X : 0;
      isScrolling.current = null;
      setAnimating(false);
    };

    const onTouchMove = (e) => {
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      // Nhận diện chiều scroll lần đầu
      if (isScrolling.current === null) {
        isScrolling.current = Math.abs(dy) > Math.abs(dx) + 4;
      }
      if (isScrolling.current) return;

      e.preventDefault(); // chặn vertical scroll khi đang swipe ngang

      let raw   = baseOffset.current + dx;
      // Rubber-band: giới hạn swipe phải (> 0) và trái (< -DELETE_X)
      if (raw > 0) raw = Math.min(12, raw * 0.15);
      if (raw < -DELETE_X) raw = -DELETE_X;
      setOffset(raw);
    };

    const onTouchEnd = (e) => {
      if (isScrolling.current) return;
      const x = parseFloat(wrapperRef.current?.style.transform?.replace(/[^-\d.]/g, '') || '0') || offset;

      // Lấy offset thực qua ref thay vì state (stale closure)
      const el  = e.currentTarget;
      const raw = parseFloat(el.querySelector('.swipe-row-content')?.style.transform?.replace('translateX(', '') || '0');

      if (raw < -(DELETE_X * 0.55)) {
        // Full swipe → delete ngay
        snapTo(-window.innerWidth, () => {
          onDelete();
          setOffset(0);
          setAnimating(false);
          revealed.current = false;
        });
      } else if (raw < -(REVEAL_X * 0.35)) {
        snapTo(-REVEAL_X); // reveal nút xóa
      } else {
        snapTo(0); // reset
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true  });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true  });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, [onDelete, snapTo]);

  // Đọc offset thực từ style để tránh stale closure trong touchend
  // (dùng state bình thường cho rendering, ref cho event handlers)
  useEffect(() => {
    const content = wrapperRef.current?.querySelector('.swipe-row-content');
    if (content) {
      content.style.transform  = `translateX(${offset}px)`;
      content.style.transition = animating ? 'transform 0.26s cubic-bezier(0.16,1,0.3,1)' : 'none';
    }
  }, [offset, animating]);

  const handleDeleteTap = (e) => {
    e.stopPropagation();
    snapTo(-window.innerWidth, () => {
      onDelete();
      setOffset(0);
      setAnimating(false);
      revealed.current = false;
    });
  };

  const handleWrapperClick = () => {
    if (revealed.current) snapTo(0);
  };

  const bgOpacity = Math.min(1, Math.abs(offset) / REVEAL_X);

  return (
    <div
      ref={wrapperRef}
      className={`swipe-row-wrapper ${className}`}
      onClick={handleWrapperClick}
    >
      {/* Nền đỏ bên phải */}
      <div
        className="swipe-delete-bg"
        style={{ opacity: bgOpacity }}
        onClick={handleDeleteTap}
      >
        <Trash2 size={17} />
        <span>Xóa</span>
      </div>

      {/* Content chính */}
      <div className="swipe-row-content">
        {children}
      </div>
    </div>
  );
}
