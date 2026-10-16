// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { ExhibitLabel } from './ExhibitLabel';
import { ImageryPending } from './ImageryPending';
import { Price } from './Price';
import { getProductBySlug } from '../data/catalog';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const inRouter = (ui: ReactNode) =>
  render(<RouterProvider router={createMemoryRouter([{ path: '/', element: ui }])} />);

describe('ImageryPending', () => {
  it('is named as artwork, never as a product photo', () => {
    render(<ImageryPending subject="Amber Veil" />);
    expect(screen.getByRole('img', { name: 'Amber Veil, artwork' })).toBeTruthy();
  });
});

describe('Price', () => {
  it('shows INR and the provisional tag', () => {
    render(<Price amount={1490} sizeMl={50} kind="provisional" />);
    expect(screen.getByText('₹1,490')).toBeTruthy();
    expect(screen.getByText('50 ml')).toBeTruthy();
    expect(screen.getByText('Provisional price')).toBeTruthy();
  });

  it('labels computed prices as illustrative', () => {
    render(<Price amount={2450} kind="illustrative" />);
    expect(screen.getByText('Illustrative price')).toBeTruthy();
  });
});

describe('ExhibitLabel', () => {
  it('renders only facts from the product data, with no placeholder tags', () => {
    const p = getProductBySlug('nocturne')!;
    render(<ExhibitLabel product={p} />);
    expect(screen.getByRole('heading', { name: 'Nocturne' })).toBeTruthy();
    expect(screen.getByText('Black tea, Cardamom, Bergamot')).toBeTruthy();
    expect(screen.queryByText(/carried over/i)).toBeNull();
    expect(document.body.textContent).not.toMatch(/rating|review|hours|bestseller/i);
  });
});

describe('Button', () => {
  it('defaults to type=button and exposes disabled', () => {
    inRouter(<Button disabled>Make yours</Button>);
    const btn = screen.getByRole('button', { name: 'Make yours' }) as HTMLButtonElement;
    expect(btn.type).toBe('button');
    expect(btn.disabled).toBe(true);
  });
});
