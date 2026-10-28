"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ToastAction = { label: string; onAction: () => void };
type Toast = { id: number; message: string; action?: ToastAction };
type ToastContextValue = { toast: (message: string, action?: ToastAction) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (message: string, action?: ToastAction) => {
      const id = nextId.current++;
      setToasts((t) => [...t.filter((x) => x.message !== message), { id, message, action }].slice(-3));
      timers.current.set(id, setTimeout(() => dismiss(id), action ? 6000 : 4500));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-in pointer-events-auto flex w-full max-w-md items-center gap-1 rounded-xl bg-ink py-2 pl-4 pr-2 text-paper shadow-lg"
          >
            <p className="flex-1 py-1 text-sm">{t.message}</p>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action?.onAction();
                  dismiss(t.id);
                }}
                className="h-10 rounded-lg px-3 text-sm font-bold text-tag"
              >
                {t.action.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="h-10 rounded-lg px-3 text-sm font-semibold"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
