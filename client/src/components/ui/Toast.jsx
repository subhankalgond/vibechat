import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current[id] = setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (message, duration) => push(message, 'success', duration),
      error: (message, duration) => push(message, 'error', duration),
      info: (message, duration) => push(message, 'info', duration),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-pop animate-fadeIn ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                : toast.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
                : 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'
            }`}
            role="status"
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} className="shrink-0" />
            ) : toast.type === 'error' ? (
              <XCircle size={18} className="shrink-0" />
            ) : (
              <Info size={18} className="shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-md p-0.5 opacity-60 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
