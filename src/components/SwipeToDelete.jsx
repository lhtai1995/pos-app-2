import React, { useRef, useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';

const REVEAL = 76;

export default function SwipeToDelete({ onDelete, children }) {
  const x = useMotionValue(0);
  const controls = useAnimation();
  const [revealed, setRevealed] = useState(false);
  const bgOpacity = useTransform(x, [0, -REVEAL], [0, 1]);
  const bgScale = useTransform(x, [-REVEAL, -(REVEAL+20)], [1, 1.1]);

  const handleDragEnd = (event, info) => {
    const isScroll = Math.abs(info.offset.y) > Math.abs(info.offset.x);
    if (isScroll) {
      controls.start({ x: 0 });
      setRevealed(false);
      return;
    }

    if (info.offset.x < -(REVEAL * 0.5)) {
      controls.start({ x: -REVEAL, transition: { type: 'spring', stiffness: 300, damping: 25 } });
      setRevealed(true);
    } else {
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } });
      setRevealed(false);
    }
  };

  const triggerDelete = async () => {
    await controls.start({ x: -window.innerWidth, transition: { duration: 0.25 } });
    onDelete();
    controls.set({ x: 0 });
    setRevealed(false);
  };

  return (
    <div className="relative overflow-hidden rounded-md mb-2 last:mb-0 touch-pan-y" onClick={() => { if (revealed) { controls.start({ x: 0 }); setRevealed(false); } }}>
      <motion.div
        className="absolute inset-0 bg-red-500 flex flex-col items-end justify-center pr-[22px] gap-[3px] text-white text-[0.72rem] font-bold tracking-wide rounded-md cursor-pointer select-none"
        style={{ opacity: bgOpacity }}
        onClick={(e) => { e.stopPropagation(); triggerDelete(); }}
      >
        <motion.div style={{ scale: bgScale }} className="flex flex-col items-center">
          <Trash2 size={17} />
          <span>Xóa</span>
        </motion.div>
      </motion.div>

      <motion.div
        style={{ x }}
        animate={controls}
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.15}
        dragDirectionLock
        onDragEnd={handleDragEnd}
        className="relative z-10 w-full"
      >
        {children}
      </motion.div>
    </div>
  );
}
