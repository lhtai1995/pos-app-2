import React, { useRef, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

const REVEAL = 76;  // px hiện nút xóa
const MAX_DX = 100; // giới hạn kéo (chỉ cần hé ra nút, không cần kéo mãi)

export default function SwipeToDelete({ onDelete, children }) {
  const wrapRef    = useRef(null);
  const contentRef = useRef(null);
  const bgRef      = useRef(null);
  const onDeleteR  = useRef(onDelete);

  // Touch tracking refs — không dùng state để không trigger re-render
  const startX   = useRef(0);
  const startY   = useRef(0);
  const baseX    = useRef(0);   // offset tại lúc touchstart
  const liveX    = useRef(0);   // offset hiện tại trong lúc kéo
  const revealed = useRef(false);
  const isScroll = useRef(null); // null → chưa biết | true → scroll | false → swipe

  // Luôn giữ ref onDelete mới nhất (tránh stale closure)
  useEffect(() => { onDeleteR.current = onDelete; });

  // Cập nhật DOM trực tiếp — không qua React state → 60fps
  const setTransform = useCallback((x, animate = false) => {
    const c = contentRef.current;
    const b = bgRef.current;
    if (!c) return;
    c.style.transition = animate ? 'transform 0.28s cubic-bezier(0.16,1,0.3,1)' : 'none';
    c.style.transform  = `translateX(${x}px)`;
    if (b) b.style.opacity = String(Math.min(1, Math.abs(x) / REVEAL));
  }, []);

  const snapTo = useCallback((x, cb) => {
    setTransform(x, true);
    revealed.current = x < -4;
    liveX.current = x;
    if (cb) setTimeout(cb, 280);
  }, [setTransform]);

  const triggerDelete = useCallback(() => {
    snapTo(-window.innerWidth, () => {
      onDeleteR.current?.();
      setTransform(0, false);
      liveX.current = 0;
      revealed.current = false;
    });
  }, [snapTo, setTransform]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      startX.current   = e.touches[0].clientX;
      startY.current   = e.touches[0].clientY;
      baseX.current    = liveX.current;
      isScroll.current = null;
      const c = contentRef.current;
      if (c) c.style.transition = 'none'; // tắt animation trong lúc kéo
    };

    const onMove = (e) => {
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      // Chỉ xác định chiều 1 lần duy nhất
      if (isScroll.current === null) {
        isScroll.current = Math.abs(dy) > Math.abs(dx) + 3;
        if (isScroll.current) return;
      }
      if (isScroll.current) return;

      e.preventDefault(); // chặn page scroll khi đang swipe ngang

      let x = baseX.current + dx;
      if (x > 0)       x = 0;       // không cho swipe phải
      if (x < -MAX_DX) x = -MAX_DX; // giới hạn swipe trái

      liveX.current = x;
      setTransform(x); // cập nhật DOM trực tiếp — không re-render
    };

    const onEnd = (e) => {
      // 1. Nếu tap đúng vào vùng nền đỏ (nút Xóa), trigger xóa ngay lập tức
      // Khắc phục triệt để lỗi iOS Safari bị mất sự kiện onClick
      if (revealed.current && bgRef.current && bgRef.current.contains(e.target)) {
        triggerDelete();
        return;
      }

      if (isScroll.current) return;
      const x = liveX.current;

      // Không có auto-delete — user phải tap nút Xóa (an toàn hơn)
      if (x < -(REVEAL * 0.5)) {
        snapTo(-REVEAL);                  // quẹt đủ ½ REVEAL (~38px) → lộ nút
      } else {
        snapTo(0);                        // quẹt ít → reset
      }
    };

    wrap.addEventListener('touchstart', onStart,  { passive: true  });
    wrap.addEventListener('touchmove',  onMove,   { passive: false });
    wrap.addEventListener('touchend',   onEnd,    { passive: true  });
    wrap.addEventListener('touchcancel',() => snapTo(0), { passive: true });

    return () => {
      wrap.removeEventListener('touchstart', onStart);
      wrap.removeEventListener('touchmove',  onMove);
      wrap.removeEventListener('touchend',   onEnd);
      wrap.removeEventListener('touchcancel',() => snapTo(0));
    };
  }, [setTransform, snapTo, triggerDelete]);

  return (
    <div
      ref={wrapRef}
      className="swipe-row-wrapper"
      onClick={() => { if (revealed.current) snapTo(0); }}
    >
      <div
        ref={bgRef}
        className="swipe-delete-bg"
        style={{ opacity: 0 }}
        onClick={(e) => { e.stopPropagation(); triggerDelete(); }}
      >
        <Trash2 size={17} />
        <span>Xóa</span>
      </div>
      <div ref={contentRef} className="swipe-row-content">
        {children}
      </div>
    </div>
  );
}
