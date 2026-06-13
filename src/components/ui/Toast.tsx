'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

// Global toast state
let toasts: ToastItem[] = [];
let listeners: ((t: ToastItem[]) => void)[] = [];

function emitChange() {
  listeners.forEach((l) => l([...toasts]));
}

export const toast = {
  success: (message: string) => {
    const item: ToastItem = { id: Math.random().toString(36).slice(2), type: 'success', message };
    toasts = [...toasts, item];
    emitChange();
    setTimeout(() => toast.dismiss(item.id), 4000);
  },
  error: (message: string) => {
    const item: ToastItem = { id: Math.random().toString(36).slice(2), type: 'error', message };
    toasts = [...toasts, item];
    emitChange();
    setTimeout(() => toast.dismiss(item.id), 4000);
  },
  info: (message: string) => {
    const item: ToastItem = { id: Math.random().toString(36).slice(2), type: 'info', message };
    toasts = [...toasts, item];
    emitChange();
    setTimeout(() => toast.dismiss(item.id), 4000);
  },
  dismiss: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    emitChange();
  },
};

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-600" />,
  error: <XCircle className="w-5 h-5 text-red-600" />,
  info: <AlertCircle className="w-5 h-5 text-blue-600" />,
};

const bgMap: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200',
  error: 'bg-red-50 border-red-200',
  info: 'bg-blue-50 border-blue-200',
};

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {items.map((item) => (
        <div
          key={item.id}
          className={`
            flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg
            animate-in slide-in-from-right
            ${bgMap[item.type]}
          `}
        >
          {icons[item.type]}
          <p className="flex-1 text-sm text-gray-800 font-medium">{item.message}</p>
          <button
            onClick={() => toast.dismiss(item.id)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}