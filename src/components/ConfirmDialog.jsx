import React from 'react';
import { Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ConfirmDialog({ message, subtext, onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div 
          className="fixed inset-0 bg-black/45 flex items-center justify-center z-[999] p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onCancel}
        >
          <motion.div 
            className="bg-white rounded-2xl p-7 pt-8 w-full max-w-[320px] text-center shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300, duration: 0.2 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-[52px] h-[52px] bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} />
            </div>
            <p className="text-[1rem] font-semibold text-gray-800 mb-1.5">{message}</p>
            {subtext && <p className="text-[0.82rem] text-gray-500 mb-5">{subtext}</p>}
            <div className="flex gap-2.5 mt-5">
              <button 
                className="flex-1 p-3 rounded-xl text-[0.92rem] font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 active:opacity-75 transition-colors"
                onClick={onCancel}
              >
                Huỷ
              </button>
              <button 
                className="flex-1 p-3 rounded-xl text-[0.92rem] font-semibold bg-red-500 text-white hover:bg-red-600 active:opacity-75 transition-colors"
                onClick={onConfirm}
              >
                Xoá
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
