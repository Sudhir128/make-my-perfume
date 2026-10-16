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
      ['Home', /\/$/],
      ['Signature Perfume', /\/collection$/],
      ['Personalized Perfume', /\/make$/],
      ['Cosmopolitan', /collection=cosmopolitan$/],
      ['Fusion', /collection=fusion$/],
      ['Combo Deals', /collection=combo$/],
      ['Accessories', /collection=accessories$/],
      ['Others', /collection=others$/],
    ];
    for (const [name, href] of expected) await expect(cats.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    await expect(cats.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: 'Profile' }).first()).toHaveAttribute('href', '/profile');
    await expect(page.getByRole('searchbox', { name: 'Search fragrances' }).first()).toBeVisible();
    await page.getByRole('navigation', { name: 'Categories' }).getByRole('link', { name: 'Fusion' }).click();
    await expect(page.getByRole('navigation', { name: 'Categories' }).getByRole('link', { name: 'Fusion' })).toHaveAttribute('aria-current', 'page');
  });

  test('footer carries the previous site contents', async ({ page }) => {
    await page.goto('/collection');
    const footer = page.locator('footer');
    for (const name of ['Shop All', 'Fresh', 'Woody', 'About Us', 'Careers', 'Blogs', 'FAQs', 'Track Order', 'Store Locator']) {
      await expect(footer.getByRole('link', { name, exact: true })).toBeVisible();
    }
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
    await expect(page.getByRole('heading', { level: 1, name: /Find your\s*signature/ })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /fragrances?/ })).toHaveText('6 fragrances');
    await page.getByRole('group', { name: 'Filter by scent family' }).getByRole('button', { name: 'Woody' }).click();
    await expect(page).toHaveURL(/family=Woody/);
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('group', { name: 'Filter by scent family' }).getByRole('button', { name: 'All' }).click();
    await page.getByRole('searchbox', { name: 'Search fragrances, notes or moods' }).fill('musk');
    await expect(page.getByRole('article')).toHaveCount(4);
    await page.getByRole('searchbox', { name: 'Search fragrances, notes or moods' }).fill('');
    await page.getByLabel('Sort by').selectOption('price-asc');
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(page.getByRole('article').first()).toHaveAccessibleName('Azure Skin');
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
    await expect(page.getByText('₹3,240', { exact: true })).toBeVisible();
    await page.getByRole('group', { name: 'Quantity, Nocturne' }).getByRole('button', { name: /Increase/ }).click();
    await expect(page.getByText('₹4,990', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Remove Amber Veil' }).click();
    await expect(page.getByRole('heading', { name: 'Amber Veil' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('heading', { name: 'Amber Veil' })).toBeVisible();
    await page.getByRole('button', { name: 'Checkout' }).click();
    const dialog = page.getByRole('dialog', { name: /Checkout is\s*coming soon/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('no order has been placed and nothing has been charged');
    await page.screenshot({ path: `${LAB}/bag-checkout-desktop.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
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
    await page.getByLabel('Email').fill('meera@example.com');
    await page.getByLabel('Mobile number').fill('98400 12345');
    await page.getByLabel('PIN code').fill('0123');
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.getByText('Enter a 6-digit PIN code.')).toBeVisible();
    await page.getByLabel('PIN code').fill('600001');
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Your details are saved.' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Hello, Meera.' })).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue('meera@example.com');
    await expect(page.getByText('No orders yet.')).toBeVisible();
    await page.screenshot({ path: `${LAB}/profile-desktop.png` });
  });
});

test.describe('home additions', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('explore scents tiles filter the collection; best sellers link to products', async ({ page }) => {
    await page.goto('/?tier=still');
    const explore = page.locator('section[aria-labelledby="explore-title"]');
    await expect(explore.getByRole('link')).toHaveCount(6);
    await expect(explore.getByRole('link', { name: /Floral/ })).toHaveAttribute('href', '/collection?family=Floral');
    const best = page.locator('section[aria-labelledby="best-title"]');
    await expect(best.getByRole('article')).toHaveCount(4);
    await expect(best.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/collection');
    await scrollThrough(page);
    await explore.screenshot({ path: `${LAB}/home-explore-desktop.png` });
    await best.screenshot({ path: `${LAB}/home-best-desktop.png` });
  });
});

// Accessibility and layout on every new page, desktop and phone.
for (const vp of [VIEWPORTS[0], VIEWPORTS[1], VIEWPORTS[2]]) {
  test.describe(`a11y ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const path of ['/collection', '/product/velvet-fig', '/bag', '/profile']) {
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
