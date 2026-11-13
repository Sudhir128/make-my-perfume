// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { SearchOverlay } from './SearchOverlay';
import Profile from '../pages/Profile';
import { useCustomerAuth } from '../store/customerAuth';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const inRouter = (ui: ReactNode) =>
  render(<RouterProvider router={createMemoryRouter([{ path: '/', element: ui }])} />);

describe('SiteHeader', () => {
  it('does not render a search input on the left side of the header', () => {
    inRouter(<SiteHeader />);
    // The main header .lead section on the left should only contain the mobile menu toggle, not a search input
    const leadSection = document.querySelector('header [class*="lead"]');
    expect(leadSection).toBeTruthy();
    expect(leadSection?.querySelector('input')).toBeNull();
  });

  it('renders the search icon button on the right to open SearchOverlay', () => {
    inRouter(<SiteHeader />);
    const searchBtn = screen.getByRole('button', { name: /search fragrances/i });
    expect(searchBtn).toBeTruthy();
  });
});

describe('SiteFooter', () => {
  it('does NOT contain "Admin Portal Login" in Support column', () => {
    inRouter(<SiteFooter />);
    const supportNav = screen.getByRole('navigation', { name: 'Support' });
    expect(supportNav).toBeTruthy();
    const linksInSupport = Array.from(supportNav.querySelectorAll('a')).map((a) => a.textContent?.trim());
    expect(linksInSupport).toContain('FAQs');
    expect(linksInSupport).toContain('Track Order');
    expect(linksInSupport).toContain('Store Locator');
    expect(linksInSupport).not.toContain('Admin Portal Login');
  });

  it('renders "Admin Portal Login" in the bottom legal row linking to /admin', () => {
    inRouter(<SiteFooter />);
    const adminLink = screen.getByRole('link', { name: 'Admin Portal Login' });
    expect(adminLink).toBeTruthy();
    expect(adminLink.getAttribute('href')).toBe('/admin');
  });
});

describe('SearchOverlay', () => {
  it('renders search input, favorites, and categories when open', () => {
    inRouter(<SearchOverlay open={true} onClose={() => {}} />);
    expect(screen.getByPlaceholderText('Search for products & more')).toBeTruthy();
    expect(screen.getByText('Current Favourites')).toBeTruthy();
    expect(screen.getByText('Explore Make My Perfume')).toBeTruthy();
  });

  it('filters results live based on user input spelling and notes', async () => {
    inRouter(<SearchOverlay open={true} onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Search for products & more');

    // Type 'citrus'
    fireEvent.change(input, { target: { value: 'citrus' } });
    expect(await screen.findByText(/Possible Results/i)).toBeTruthy();
    expect(await screen.findByRole('link', { name: /Citrus Noir/i })).toBeTruthy();

    // Type 'vetiver'
    fireEvent.change(input, { target: { value: 'vetiver' } });
    expect(await screen.findByRole('link', { name: /Citrus Noir/i })).toBeTruthy();

    // Type nonexistent term
    fireEvent.change(input, { target: { value: 'xyzunknownfragrance123' } });
    expect(await screen.findByText(/No exact match found/i)).toBeTruthy();
  });
});

describe('Profile customer logout confirmation', () => {
  it('asks for confirmation before logging the customer out', async () => {
    useCustomerAuth.setState({
      user: { id: 'cust-1', email: 'meera@example.com', fullName: 'Meera Krishnan' },
      initialized: true,
      loading: false,
    });

    inRouter(<Profile />);
    expect(screen.getByText(/Signed in as/i)).toBeTruthy();
    expect(screen.getByText('meera@example.com')).toBeTruthy();

    const signOutBtn = screen.getByRole('button', { name: 'Sign out' });
    expect(signOutBtn).toBeTruthy();

    // Click Sign out -> Confirmation prompt is presented
    fireEvent.click(signOutBtn);
    expect(screen.getByText('Are you sure you want to sign out?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yes, sign out' })).toBeTruthy();
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelBtn).toBeTruthy();

    // Click Cancel -> Confirmation box closes and user remains signed in
    fireEvent.click(cancelBtn);
    expect(screen.queryByText('Are you sure you want to sign out?')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });
});

