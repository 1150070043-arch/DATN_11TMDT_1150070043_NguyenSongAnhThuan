import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { ToastContainer } from '../design/Reference';

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  tone?: ToastTone;
  title: string;
  message?: string;
  duration?: number;
};

type ToastItem = ToastInput & { id: number; tone: ToastTone };

type ToastContextValue = {
  notify: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((input: ToastInput) => {
    const toast: ToastItem = {
      ...input,
      id: nextId.current++,
      tone: input.tone ?? "info"
    };
    setToasts((current) => [...current.slice(-2), toast]);
    window.setTimeout(() => dismiss(toast.id), input.duration ?? 4200);
  }, [dismiss]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts.map(toast => ({ id: toast.id, type: toast.tone, msg: [toast.title, toast.message].filter(Boolean).join(': ') }))} remove={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
