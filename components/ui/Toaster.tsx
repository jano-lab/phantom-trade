"use client";
import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { X, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";

interface Toast {
  id:      string;
  type:    "success" | "error" | "warning" | "info";
  title:   string;
  message?: string;
}

interface ToastContextType {
  toast: (t: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() { return useContext(ToastContext); }

const icons = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

const colors = {
  success: "border-phantom-nova/40 text-phantom-nova",
  error:   "border-phantom-pulse/40 text-phantom-pulse",
  warning: "border-phantom-amber/40 text-phantom-amber",
  info:    "border-phantom-signal/40 text-phantom-signal",
};

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = icons[t.type];
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(t.id), 5000);
    return () => clearTimeout(timer);
  }, [t.id, onDismiss]);

  return (
    <div className={`flex items-start gap-3 phantom-card p-4 animate-slide-up border ${colors[t.type]} min-w-[300px] max-w-sm`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-phantom-star">{t.title}</div>
        {t.message && <div className="text-xs text-phantom-ghost mt-0.5">{t.message}</div>}
      </div>
      <button onClick={() => onDismiss(t.id)} className="text-phantom-ghost hover:text-phantom-star flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...t, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Expose globally
  useEffect(() => {
    (window as any).__phantomToast = toast;
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function showToast(t: Omit<Toast, "id">) {
  (window as any).__phantomToast?.(t);
}
