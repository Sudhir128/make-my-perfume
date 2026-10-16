import { create } from 'zustand';

export interface ToastAction {
  label: string;
  /** Either navigate to a route or run a callback (for example, undo). */
  to?: string;
  onAction?: () => void;
}

export interface Toast {
  id: number;
  message: string;
  action?: ToastAction;
}

interface ToastState {
  toast: Toast | null;
  show: (message: string, action?: ToastAction) => void;
  dismiss: () => void;
}

let seq = 0;

export const useToast = create<ToastState>()((set) => ({
  toast: null,
  show: (message, action) => set({ toast: { id: ++seq, message, action } }),
  dismiss: () => set({ toast: null }),
}));
