import { beforeEach, describe, expect, it } from 'vitest';
import { getProductBySlug } from '../data/catalog';
import { itemCount, subtotal } from '../lib/pricing';
import { useBag } from './bag';

const amber = getProductBySlug('amber-veil')!;
const nocturne = getProductBySlug('nocturne')!;

beforeEach(() => useBag.getState().clear());

describe('bag store', () => {
  it('adds a product with its provisional price and listed size', () => {
    useBag.getState().addProduct(amber);
    expect(useBag.getState().lines).toEqual([
      expect.objectContaining({ slug: 'amber-veil', unitPrice: 1490, sizeMl: 50, qty: 1, kind: 'product' }),
    ]);
  });

  it('merges repeat adds and caps quantity at 10', () => {
    useBag.getState().addProduct(amber, 4);
    useBag.getState().addProduct(amber, 9);
    expect(useBag.getState().lines).toHaveLength(1);
    expect(useBag.getState().lines[0]!.qty).toBe(10);
  });

  it('keeps quantity between 1 and 10', () => {
    useBag.getState().addProduct(amber);
    const id = useBag.getState().lines[0]!.id;
    useBag.getState().setQty(id, 0);
    expect(useBag.getState().lines[0]!.qty).toBe(1);
    useBag.getState().setQty(id, 99);
    expect(useBag.getState().lines[0]!.qty).toBe(10);
  });

  it('removes and restores a line in its original position', () => {
    useBag.getState().addProduct(amber);
    useBag.getState().addProduct(nocturne);
    const removed = useBag.getState().remove(useBag.getState().lines[0]!.id)!;
    expect(useBag.getState().lines.map((l) => l.slug)).toEqual(['nocturne']);
    useBag.getState().restore(removed.line, removed.index);
    expect(useBag.getState().lines.map((l) => l.slug)).toEqual(['amber-veil', 'nocturne']);
  });

  it('totals in whole rupees with no shipping or tax', () => {
    useBag.getState().addProduct(amber, 2);
    useBag.getState().addProduct(nocturne);
    const lines = useBag.getState().lines;
    expect(subtotal(lines)).toBe(1490 * 2 + 1750);
    expect(itemCount(lines)).toBe(3);
  });
});
