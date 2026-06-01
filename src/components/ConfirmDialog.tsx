import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'info',
}: ConfirmDialogProps) {
  const variantStyles = {
    danger: { icon: AlertCircle, iconColor: 'text-red-500', btnColor: 'bg-red-500 hover:bg-red-600' },
    warning: { icon: AlertTriangle, iconColor: 'text-amber-500', btnColor: 'bg-amber-500 hover:bg-amber-600' },
    info: { icon: Info, iconColor: 'text-brand-orange', btnColor: 'bg-brand-orange hover:bg-brand-orange/90' },
  };

  const { icon: Icon, iconColor, btnColor } = variantStyles[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-sm w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start space-x-3">
              <div className={`p-2 rounded-xl bg-slate-50 ${iconColor}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">{title}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{message}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors shadow-sm ${btnColor}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
