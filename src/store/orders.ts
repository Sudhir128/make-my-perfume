/*
 * Persists placed order confirmations on the customer's device so Profile
 * and Bag confirmation views can inspect and re-print past invoices.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '../lib/storage';

export interface PlacedOrderItem {
  product_slug: string;
  product_name: string;
  collection?: string;
  size_ml: number;
  unit_price_inr: number;
  quantity: number;
  line_total_inr: number;
}

export interface PlacedOrderReceipt {
  orderId: string;
  outboxId?: string;
  orderNumber: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  paymentMethod: 'cod' | 'upi';
  paymentStatus: string;
  orderStatus: string;
  upiReference?: string | null;
  subtotalInr: number;
  shippingInr: number;
  totalInr: number;
  createdAt: string;
  invoiceHtml: string;
  emailStatus: 'pending' | 'sent' | 'failed' | 'queued_no_provider';
  emailMessage?: string;
  items: PlacedOrderItem[];
}

interface OrdersState {
  orders: PlacedOrderReceipt[];
  addOrder: (order: PlacedOrderReceipt) => void;
  clear: () => void;
}

export const ORDERS_STORAGE_KEY = 'mmp.orders.v1';

export const useOrders = create<OrdersState>()(
  persist(
    (set) => ({
      orders: [],
      addOrder: (order) =>
        set((s) => ({
          orders: [order, ...s.orders.filter((o) => o.orderNumber !== order.orderNumber)].slice(0, 25),
        })),
      clear: () => set({ orders: [] }),
    }),
    {
      name: ORDERS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ orders: s.orders }),
    },
  ),
);

