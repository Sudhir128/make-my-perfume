/*
 * The bag lives in the browser only. Nothing here is an order: there is no
 * checkout, payment, shipping or tax in this prototype. When a backend exists,
 * these actions become calls to it; components keep using the same hooks.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Product } from '../data/catalog';
import { clampQty } from '../lib/pricing';
import { safeStorage } from '../lib/storage';

export interface ProductLine {
  id: string;
  kind: 'product';
  slug: string;
  name: string;
  collection: string;
  sizeMl: number;
  /** Provisional INR price captured when added. */
  unitPrice: number;
  qty: number;
}

// Custom blend lines arrive with the builder (Milestone 3).
export type BagLine = ProductLine;

interface BagState {
  lines: BagLine[];
  addProduct: (product: Product, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  /** Removes a line and returns it with its position, so it can be restored. */
  remove: (id: string) => { line: BagLine; index: number } | null;
  restore: (line: BagLine, index: number) => void;
  clear: () => void;
}

export const BAG_STORAGE_KEY = 'mmp.bag.v1';

export const useBag = create<BagState>()(
  persist(
    (set, get) => ({
      lines: [],
      addProduct: (product, qty = 1) =>
        set((s) => {
          const id = `${product.slug}-${product.sizeMl}`;
          const existing = s.lines.find((l) => l.id === id);
          if (existing) {
            return { lines: s.lines.map((l) => (l.id === id ? { ...l, qty: clampQty(l.qty + qty) } : l)) };
          }
          const line: ProductLine = {
            id,
            kind: 'product',
            slug: product.slug,
            name: product.name,
            collection: product.collection,
            sizeMl: product.sizeMl,
            unitPrice: product.price,
            qty: clampQty(qty),
          };
          return { lines: [...s.lines, line] };
        }),
      setQty: (id, qty) => set((s) => ({ lines: s.lines.map((l) => (l.id === id ? { ...l, qty: clampQty(qty) } : l)) })),
      remove: (id) => {
        const index = get().lines.findIndex((l) => l.id === id);
        if (index < 0) return null;
        const line = get().lines[index]!;
        set((s) => ({ lines: s.lines.filter((l) => l.id !== id) }));
        return { line, index };
      },
      restore: (line, index) =>
        set((s) => {
          if (s.lines.some((l) => l.id === line.id)) return s;
          const lines = [...s.lines];
          lines.splice(Math.min(index, lines.length), 0, line);
          return { lines };
        }),
      clear: () => set({ lines: [] }),
    }),
    {
      name: BAG_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ lines: s.lines }),
    },
  ),
);
