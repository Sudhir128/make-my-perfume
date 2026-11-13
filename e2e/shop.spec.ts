import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { VIEWPORTS, disablePointerLock, measureTextContrast, scrollThrough, settle, watchErrors } from './helpers';

const LAB = process.env.SHOP_LAB ?? 'scrollcraft/lab/shop';
fs.mkdirSync(LAB, { recursive: true });

test.beforeEach(async ({ page }) => {
  await disablePointerLock(page);
});

test.describe('header and footer', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('header carries the category navigation, search, profile and bag', async ({ page }) => {
    await page.goto('/');
    const cats = page.getByRole('navigation', { name: 'Categories' });
    const expected: Array<[string, RegExp]> = [
      ['Shop All Perfumes', /\/collection$/],
      ['Men', /audience=men$/],
      ['Women', /audience=women$/],
      ['Unisex', /audience=unisex$/],
      ['Inspired Fragrances', /type=inspired$/],
      ['Create Your Perfume', /\/make$/],
      ['Gifting & Combos', /type=bundle$/],
    ];
    for (const [name, href] of expected) await expect(cats.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    await expect(page.getByRole('banner').getByRole('link', { name: /Make My Perfume/i }).first()).toHaveAttribute('href', '/');
    await expect(page.getByRole('link', { name: 'Profile' }).first()).toHaveAttribute('href', '/profile');
    await expect(page.getByRole('button', { name: 'Search fragrances' }).first()).toBeVisible();
    // Verify no left-side desktop search box exists in header (clean atelier layout)
    await expect(page.getByRole('banner').locator('input[type="search"]')).toHaveCount(0);
    await cats.getByRole('link', { name: 'Men', exact: true }).click();
    await expect(cats.getByRole('link', { name: 'Men', exact: true })).toHaveAttribute('aria-current', 'page');
    await cats.getByRole('link', { name: 'Inspired Fragrances', exact: true }).click();
    await expect(cats.getByRole('link', { name: 'Inspired Fragrances', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('search option opens live search overlay with suggestions and spelling matches', async ({ page }) => {
    await page.goto('/');
    const searchBtn = page.getByRole('button', { name: 'Search fragrances' }).first();
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();

    const overlay = page.getByRole('dialog', { name: 'Search fragrances and explore' });
    await expect(overlay).toBeVisible();
    await expect(overlay.getByText('Current Favourites')).toBeVisible();
    await expect(overlay.getByText('Explore Make My Perfume')).toBeVisible();

    const searchInput = overlay.getByPlaceholder('Search for products & more');
    await expect(searchInput).toBeFocused();

    // Type letters to see live spelling matches
    await searchInput.fill('citrus');
    await expect(overlay.getByText(/Possible Results/i)).toBeVisible();
    await expect(overlay.getByRole('link', { name: /Citrus Noir/i })).toBeVisible();

    // Substring note match
    await searchInput.fill('vetiver');
    await expect(overlay.getByRole('link', { name: /Citrus Noir/i })).toBeVisible();

    // Explore link on the right navigates
    await overlay.getByRole('link', { name: 'Men', exact: true }).click();
    await expect(page).toHaveURL(/audience=men/);
    await expect(overlay).toBeHidden();
  });

  test('footer carries the previous site contents', async ({ page }) => {
    await page.goto('/collection');
    const footer = page.getByRole('contentinfo');
    for (const name of ['Shop All', 'Fresh', 'Woody', 'About Us', 'Careers', 'Blogs', 'FAQs', 'Track Order', 'Store Locator']) {
      await expect(footer.getByRole('link', { name, exact: true })).toBeVisible();
    }
    // Verify Admin Portal Login is removed from Support column and placed in bottom legal row
    const supportNav = footer.getByRole('navigation', { name: 'Support' });
    await expect(supportNav.getByRole('link', { name: 'Admin Portal Login' })).toHaveCount(0);
    const bottomAdminLink = footer.locator('a[href="/admin"]');
    await expect(bottomAdminLink).toBeVisible();
    await expect(bottomAdminLink).toHaveText('Admin Portal Login');
    for (const [label, href] of [
      ['Instagram', 'https://instagram.com/makemyperfume'],
      ['YouTube', 'https://youtube.com/@makemyperfume'],
      ['Pinterest', 'https://pinterest.com/makemyperfume'],
    ]) {
      const link = footer.getByRole('link', { name: new RegExp(`^${label}`) });
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
    await expect(footer.getByRole('link', { name: /hello@makemyperfume\.in/ })).toHaveAttribute('href', 'mailto:hello@makemyperfume.in');
    await expect(footer).toContainText('© 2026 Make My Perfume');
    await expect(footer).toContainText(/made in india/i);
    await footer.screenshot({ path: `${LAB}/footer-desktop.png` });
  });
});

test.describe('collection', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('filters, search and sort live in the URL; empty categories say so', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/collection');
    await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
    await expect(page.getByText('Find your signature.')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: /fragrances?/ })).toHaveText('6 fragrances');
    await page.getByRole('group', { name: 'Filter by scent family' }).getByRole('button', { name: 'Woody' }).click();
    await expect(page).toHaveURL(/family=Woody/);
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('group', { name: 'Filter by scent family' }).getByRole('button', { name: 'All' }).click();
    await page.getByRole('searchbox', { name: 'Search fragrances, notes or moods' }).fill('musk');
    await expect(page.getByRole('article')).toHaveCount(4);
    await page.getByRole('searchbox', { name: 'Search fragrances, notes or moods' }).fill('');
    const sortSelect = page.getByLabel('Sort by');
    for (const label of [
      'Make My Perfume Recommends',
      'Best Sellers',
      'New Arrivals',
      'Popularity',
      'Best Matches',
      'Price: Low to High',
      'Price: High to Low',
    ]) {
      await expect(sortSelect.locator('option', { hasText: label })).toHaveCount(1);
    }
    await sortSelect.selectOption('price-asc');
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(page.getByRole('article').first()).toHaveAccessibleName('Azure Skin');

    // Slide-over Filter Drawer with 6 collapsible sections + Clear All / Result (N)
    await page.getByRole('button', { name: /^Filter/ }).click();
    const drawer = page.getByRole('dialog', { name: 'Filter perfumes' });
    await expect(drawer).toBeVisible();
    for (const section of ['Price', 'Collection', 'Family', 'Fragrance Type', 'Quantity', 'Availability']) {
      await expect(drawer.locator('summary', { hasText: section })).toBeVisible();
    }
    await drawer.locator('summary', { hasText: 'Price' }).click();
    await drawer.getByLabel('Under ₹1,000').check();
    await expect(drawer.getByRole('button', { name: /Result \(/ })).toBeVisible();
    await drawer.getByRole('button', { name: /Result \(/ }).click();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/price=under-1000/);
    await page.getByRole('button', { name: 'Clear all', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(6);

    await scrollThrough(page);
    await page.screenshot({ path: `${LAB}/collection-desktop.png`, fullPage: true });
    await page.goto('/collection?collection=fusion');
    await expect(page.getByRole('heading', { name: /Fusion\s*is coming soon/ })).toBeVisible();
    await page.getByRole('link', { name: 'Browse all perfumes' }).click();
    await expect(page.getByRole('article')).toHaveCount(6);
    expect(errors).toEqual([]);
  });
});

test.describe('product page', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('shows price and details; quantity, Add to bag and Buy now work', async ({ page }) => {
    await page.goto('/product/azure-skin');
    await expect(page.getByRole('heading', { level: 1, name: 'Azure Skin' })).toBeVisible();
    await expect(page.getByText('₹990', { exact: true })).toBeVisible();
    await expect(page.getByText('The air after rain.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Aquatic');
    await expect(page.getByText('Yuzu · Juniper · Marine accord')).toBeVisible();
    // Never invented: no ratings, reviews or struck-through sale price.
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/review|rating|★|1,190/i);
    await page.getByText('Wear it well').click();
    await expect(page.getByText('6–8 hours')).toBeVisible();
    await page.getByText('Ingredients & details').click();
    await expect(page.getByText(/Denatured alcohol · Parfum · Aqua · Geraniol/)).toBeVisible();
    await page.getByRole('button', { name: 'Flask view' }).click();
    await expect(page.getByRole('button', { name: 'Flask view' })).toHaveAttribute('aria-pressed', 'true');
    const qty = page.getByRole('group', { name: 'Quantity, Azure Skin' });
    await qty.getByRole('button', { name: /Increase/ }).click();
    await qty.getByRole('button', { name: /Increase/ }).click();
    await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
    await expect(page.getByRole('link', { name: /^Bag 3 items$/ }).first()).toBeVisible();
    await page.screenshot({ path: `${LAB}/product-desktop.png` });
    await page.getByRole('button', { name: 'Buy now' }).click();
    await expect(page).toHaveURL(/\/bag$/);
    await expect(page.getByRole('heading', { name: 'Azure Skin' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Quantity, Azure Skin' }).locator('output')).toHaveText('6');
  });

  test('unknown product slug shows the not-found page', async ({ page }) => {
    await page.goto('/product/no-such-scent');
    await expect(page.getByRole('heading', { level: 1, name: /does not exist/ })).toBeVisible();
  });
});

test.describe('bag', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('quantity, remove with undo, totals, and an honest checkout', async ({ page }) => {
    await page.goto('/product/amber-veil');
    await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
    await page.goto('/product/nocturne');
    await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
    await page.goto('/bag');
    const summary = page.getByRole('complementary', { name: 'Order summary' });
    await expect(summary.getByText('₹3,240', { exact: true })).toBeVisible();
    await page.getByRole('group', { name: 'Quantity, Nocturne' }).getByRole('button', { name: /Increase/ }).click();
    await expect(summary.getByText('₹4,990', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Remove Amber Veil' }).click();
    await expect(page.getByRole('heading', { name: 'Amber Veil' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('heading', { name: 'Amber Veil' })).toBeVisible();
    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
    const authDialog = page.getByRole('dialog', { name: /Sign in\s*to continue|Create\s*your account/ });
    await expect(authDialog).toBeVisible();
    await expect(authDialog.getByRole('tab', { name: 'Log in' })).toBeVisible();
    await expect(authDialog.getByRole('tab', { name: 'Create account' })).toBeVisible();
    await authDialog.getByRole('tab', { name: 'Create account' }).click();
    await expect(authDialog.getByLabel('Full name')).toBeVisible();
    await expect(authDialog.getByRole('button', { name: 'Create account & continue' })).toBeVisible();
    await authDialog.getByRole('button', { name: 'Already have an account? Log in' }).click();
    await expect(authDialog.getByRole('button', { name: 'Log in & continue' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(authDialog).toBeHidden();
  });

  test('authenticates customer inside checkout, checks UPI QR, places COD order with invoice & records in profile (mocked auth + RPC)', async ({ page }) => {
    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projectUrl: 'https://mock-supabase.local',
          anonKey: 'mock-anon-key',
          merchantUpiId: 'makemyperfume@upi',
          merchantName: 'Make My Perfume',
        }),
      });
    });
    await page.route('https://mock-supabase.local/auth/v1/token**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt-customer',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-customer',
          user: {
            id: '11111111-1111-1111-1111-111111111111',
            email: 'meera@example.com',
            user_metadata: { full_name: 'Meera Krishnan' },
          },
        }),
      });
    });
    await page.route('https://mock-supabase.local/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '11111111-1111-1111-1111-111111111111',
          email: 'meera@example.com',
          user_metadata: { full_name: 'Meera Krishnan' },
        }),
      });
    });
    await page.route('**/rest/v1/rpc/place_order', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order_id: '00000000-0000-0000-0000-000000000101',
          outbox_id: '00000000-0000-0000-0000-000000000202',
          order_number: 'MMP-202611-0001',
          invoice_number: 'INV-MMP-202611-0001',
          payment_method: 'cod',
          payment_status: 'cod_due',
          order_status: 'placed',
          subtotal_inr: 1490,
          shipping_inr: 0,
          total_inr: 1490,
          created_at: '2026-11-12T10:00:00Z',
          invoice_html: '<!doctype html><html><body><h1>Tax Invoice INV-MMP-202611-0001</h1></body></html>',
          items: [{ product_slug: 'amber-veil', product_name: 'Amber Veil', size_ml: 50, quantity: 1, unit_price_inr: 1490, line_total_inr: 1490 }],
        }),
      });
    });
    await page.route('**/rest/v1/rpc/list_my_orders', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/send-invoice', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ dispatched: true, status: 'sent', provider: 'resend' }),
      });
    });
    await page.route('**/rest/v1/rpc/mark_order_email_status', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });

    await page.goto('/product/amber-veil');
    await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
    await page.goto('/bag');
    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();

    const authDialog = page.getByRole('dialog', { name: /Sign in\s*to continue/ });
    await authDialog.getByLabel('Email').fill('meera@example.com');
    await authDialog.getByLabel('Password').fill('secret123');
    await authDialog.getByRole('button', { name: 'Log in & continue' }).click();

    const dialog = page.getByRole('dialog', { name: /Complete\s*your order/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Cash on Delivery (COD)')).toBeVisible();
    await expect(dialog.getByText('UPI (GPay, PhonePe, Paytm, BHIM)')).toBeVisible();
    await dialog.getByLabel(/UPI \(GPay/).check();
    await expect(dialog.getByRole('img', { name: /UPI QR code/ })).toBeVisible();
    await expect(dialog.getByLabel('UPI Transaction ID / UTR Reference')).toBeVisible();
    await page.screenshot({ path: `${LAB}/bag-checkout-desktop.png` });
    await dialog.getByLabel(/Cash on Delivery/).check();

    await dialog.getByLabel('Full name').fill('Meera Krishnan');
    await dialog.getByLabel('Email (for invoice)').fill('meera@example.com');
    await dialog.getByLabel('Mobile number').fill('9840012345');
    await dialog.getByLabel('PIN code').fill('600001');
    await dialog.getByLabel('Delivery address').fill('14 Boat Club Road');
    await dialog.getByLabel('City').fill('Chennai');
    await dialog.getByLabel('State').fill('Tamil Nadu');
    await dialog.getByRole('button', { name: /Place order & send invoice/ }).click();

    const receiptDialog = page.getByRole('dialog', { name: /Order\s*placed/ });
    await expect(receiptDialog).toBeVisible();
    await expect(receiptDialog.getByText('MMP-202611-0001', { exact: true })).toBeVisible();
    await expect(receiptDialog.getByText('INV-MMP-202611-0001', { exact: true })).toBeVisible();
    await expect(receiptDialog.getByRole('button', { name: 'Print Invoice' })).toBeVisible();
    await expect(receiptDialog.getByRole('button', { name: 'Download PDF' })).toBeVisible();
    await expect(receiptDialog.getByRole('button', { name: 'Download HTML' })).toBeVisible();
    await receiptDialog.getByRole('button', { name: 'Done' }).click();

    await page.goto('/profile');
    await expect(page.getByText('MMP-202611-0001', { exact: true })).toBeVisible();
  });

  test('empty bag offers the collection', async ({ page }) => {
    await page.goto('/bag');
    await expect(page.getByRole('heading', { level: 1, name: /Your bag\s*is empty/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Shop the collection' })).toHaveAttribute('href', '/collection');
  });
});

test.describe('profile', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('validates, saves on this device and greets by name after reload', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Your profile.' })).toBeVisible();
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.getByText('Enter your full name.')).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeFocused();
    await page.getByLabel('Full name').fill('Meera Krishnan');
    await page.getByLabel('Email', { exact: true }).fill('meera@example.com');
    await page.getByLabel('Mobile number').fill('98400 12345');
    await page.getByLabel('PIN code').fill('0123');
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.getByText('Enter a 6-digit PIN code.')).toBeVisible();
    await page.getByLabel('PIN code').fill('600001');
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Your details are saved.' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Hello, Meera.' })).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('meera@example.com');
    await expect(page.getByText('No orders yet.')).toBeVisible();
    await page.screenshot({ path: `${LAB}/profile-desktop.png` });
  });

  test('confirms sign out when authenticated customer logs out', async ({ page }) => {
    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ projectUrl: 'https://mock-supabase.local', anonKey: 'mock-anon-key' }),
      });
    });
    await page.route('https://mock-supabase.local/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'c1', email: 'meera@example.com' }),
      });
    });
    await page.route('https://mock-supabase.local/auth/v1/logout**', async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });
    await page.addInitScript(() => {
      window.localStorage.setItem('mmp_customer_user', JSON.stringify({ id: 'c1', email: 'meera@example.com' }));
    });
    await page.goto('/profile');
    await expect(page.getByText('meera@example.com')).toBeVisible();

    // Click Sign out -> Confirmation box appears
    const signOutBtn = page.getByRole('button', { name: 'Sign out' });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    await expect(page.getByText('Are you sure you want to sign out?')).toBeVisible();
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    const confirmBtn = page.getByRole('button', { name: 'Yes, sign out' });
    await expect(cancelBtn).toBeVisible();
    await expect(confirmBtn).toBeVisible();

    // Cancel preserves signed-in state
    await cancelBtn.click();
    await expect(page.getByText('Are you sure you want to sign out?')).toHaveCount(0);
    await expect(page.getByText('meera@example.com')).toBeVisible();

    // Sign out confirms and signs out
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('button', { name: 'Yes, sign out' }).click();
    await expect(page.getByText('Signed out successfully.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in to Account' })).toBeVisible();
  });
});

test.describe('home additions', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('explore scents tiles, tabbed and dedicated carousels, trending showcase and best sellers render', async ({ page }) => {
    await page.goto('/?tier=still');
    const explore = page.locator('section[aria-labelledby="explore-title"]');
    await expect(explore.getByRole('link')).toHaveCount(6);
    await expect(explore.getByRole('link', { name: /Floral/ })).toHaveAttribute('href', '/collection?family=Floral');

    // Tabbed carousel allows switching between Trending, New Arrivals, On Sale, Signature
    const tablist = page.getByRole('tablist', { name: /filter tabs/i }).first();
    await expect(tablist).toBeVisible();
    await expect(tablist.getByRole('tab', { name: /Trending/i })).toBeVisible();
    await expect(tablist.getByRole('tab', { name: /New Arrivals/i })).toBeVisible();
    await expect(tablist.getByRole('tab', { name: /On Sale/i })).toBeVisible();
    await tablist.getByRole('tab', { name: /On Sale/i }).click();

    // Dedicated Trending Fragrances section prominently on homepage
    const trendingSection = page.locator('section[aria-labelledby="trending-title"]');
    await expect(trendingSection).toBeVisible();
    expect(await trendingSection.getByRole('article').count()).toBeGreaterThan(0);

    for (const heading of [/Trending\s*perfumes\./, /New\s*arrivals\./, /Signature\s*perfumes\./]) {
      const section = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: heading }) }).first();
      await expect(section).toBeVisible();
      expect(await section.getByRole('article').count()).toBeGreaterThan(0);
    }

    const best = page.locator('section[aria-labelledby="best-title"]');
    await expect(best.getByRole('article')).toHaveCount(4);
    await expect(best.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/collection');
    await scrollThrough(page);
    await explore.screenshot({ path: `${LAB}/home-explore-desktop.png` });
    await trendingSection.screenshot({ path: `${LAB}/home-trending-desktop.png` });
    await best.screenshot({ path: `${LAB}/home-best-desktop.png` });
  });
});

test.describe('admin portal', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('renders standalone without storefront header/footer and confirms admin sign-out', async ({ page }) => {
    const errors = watchErrors(page);
    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projectUrl: 'https://mock-supabase.local',
          anonKey: 'mock-anon-key',
        }),
      });
    });

    let signedIn = false;
    await page.route('https://mock-supabase.local/rest/v1/rpc/admin_status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          signedIn
            ? { authenticated: true, is_admin: true, has_any_admin: true, email: 'admin@makemyperfume.in', user_id: 'admin-1' }
            : { authenticated: false, is_admin: false, has_any_admin: true, email: null, user_id: null },
        ),
      });
    });
    await page.route('https://mock-supabase.local/auth/v1/token**', async (route) => {
      signedIn = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt-admin',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-admin',
          user: { id: 'admin-1', email: 'admin@makemyperfume.in' },
        }),
      });
    });
    await page.route('https://mock-supabase.local/auth/v1/logout**', async (route) => {
      signedIn = false;
      await route.fulfill({ status: 204, body: '' });
    });
    for (const rpc of ['admin_list_products', 'admin_list_orders', 'admin_list_activity_logs', 'admin_list_admins']) {
      await page.route(`**/rest/v1/rpc/${rpc}`, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });
    }
    await page.route('**/rest/v1/rpc/admin_list_taxonomy', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ categories: [], fragrance_types: [], scent_families: [] }),
      });
    });

    await page.goto('/admin');
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Admin Sign In' })).toBeVisible();
    await expect(page.getByLabel('Admin email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in to Admin' })).toBeVisible();
    await page.screenshot({ path: `${LAB}/admin-gate-desktop.png` });

    await page.getByLabel('Admin email').fill('admin@makemyperfume.in');
    await page.getByLabel('Password').fill('admin1234');
    await page.getByRole('button', { name: 'Sign in to Admin' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Admin Panel' })).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);

    // Verify "View Website" link in admin panel top actions
    const viewSiteLink = page.getByRole('link', { name: /View Website/i });
    await expect(viewSiteLink).toBeVisible();
    await expect(viewSiteLink).toHaveAttribute('href', '/');
    await expect(viewSiteLink).toHaveAttribute('target', '_blank');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Confirm sign out' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm sign out' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'You have signed out' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in again' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

// Accessibility and layout on every new page, desktop and phone.
for (const vp of [VIEWPORTS[0], VIEWPORTS[1], VIEWPORTS[2]]) {
  test.describe(`a11y ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const path of ['/collection', '/product/velvet-fig', '/bag', '/profile', '/admin']) {
      test(`${path}: axe, contrast, overflow`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto('/product/velvet-fig');
        await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
        await page.goto(path);
        await settle(page);
        await scrollThrough(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
        const contrast = await measureTextContrast(page);
        expect(contrast.filter((c) => c.ratio < c.min)).toEqual([]);
        await page.screenshot({ path: `${LAB}/${path.replace(/\//g, '_').replace(/^_/, '')}-${vp.name}.png`, fullPage: true });
        expect(errors).toEqual([]);
      });
    }
  });
}
