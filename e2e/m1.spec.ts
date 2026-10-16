import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { LAB, VIEWPORTS, disablePointerLock, measureFocusRings, measureTextContrast, scrollThrough, settle, watchErrors } from './helpers';

const ROUTES = [
  { path: '/', name: 'home', heading: /Your scent\.\s*Your signature\./ },
  { path: '/foundation', name: 'foundation', heading: /Design\s*foundation/ },
  { path: '/about', name: 'planned', heading: /on its way/ },
  { path: '/no-such-page', name: 'not-found', heading: /does not exist/ },
];

fs.mkdirSync(LAB, { recursive: true });

test.beforeEach(async ({ page }) => {
  await disablePointerLock(page);
});

const bagCount = (page: Page) => page.getByRole('link', { name: /^Bag \d+ items?$/ });

// ── Rendering at every viewport, with and without reduced motion ──────────
for (const vp of VIEWPORTS) {
  for (const reduced of [false, true]) {
    if (reduced && vp.name === 'compact') continue;
    const tag = `${vp.name}${reduced ? '-reduced' : ''}`;
    test.describe(`${tag} ${vp.width}x${vp.height}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      for (const route of ROUTES) {
        test(`${route.name}: renders, no errors, no overflow, fonts`, async ({ page }) => {
          const errors = watchErrors(page);
          await page.goto(route.path);
          await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
          await settle(page);
          expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'horizontal overflow').toBeLessThanOrEqual(0);
          const families = await page.evaluate(() =>
            [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')),
          );
          expect(families).toEqual(expect.arrayContaining(['Cormorant Garamond', 'Jost']));
          expect(families).not.toContain('Cinzel');
          await scrollThrough(page);
          await page.screenshot({ path: `${LAB}/${route.name}-${tag}.png`, fullPage: true, animations: 'disabled' });
          expect(errors).toEqual([]);
        });
      }
    });
  }
}

// ── Accessibility: axe, measured text contrast, focus rings ───────────────
for (const vp of [VIEWPORTS[0], VIEWPORTS[1]]) {
  test.describe(`accessibility ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const route of ROUTES) {
      test(`${route.name}: axe, text contrast, focus rings`, async ({ page }) => {
        await page.goto(route.path);
        await settle(page);
        await scrollThrough(page);
        expect(await page.locator('[data-reveal]:not([data-revealed])').count(), 'entrances left unrevealed').toBe(0);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const contrast = await measureTextContrast(page);
        const focus = await measureFocusRings(page);
        fs.writeFileSync(
          `${LAB}/a11y-${route.name}-${vp.name}.json`,
          JSON.stringify(
            {
              axe: {
                violations: axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.length, help: v.help, targets: v.nodes.map((n) => n.target) })),
                incomplete: axe.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length })),
                passes: axe.passes.length,
              },
              contrast,
              focus,
            },
            null,
            2,
          ),
        );
        expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
        expect(contrast.filter((c) => c.ratio < c.min), 'text below its WCAG minimum').toEqual([]);
        expect(focus.length).toBeGreaterThan(0);
        for (const f of focus) {
          expect(f.style, `${f.name} outline style`).not.toBe('none');
          expect(f.width, `${f.name} outline width`).toBeGreaterThanOrEqual(2);
          expect(f.ratio, `${f.name} ring contrast`).toBeGreaterThanOrEqual(3);
        }
      });
    }
  });
}

// ── Journeys ──────────────────────────────────────────────────────────────
test.describe('journeys', () => {
  test('add to bag updates the header count, announces it, and persists', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await expect(bagCount(page)).toHaveAccessibleName('Bag 0 items');
    // Scoped: the homepage shows the product in the collection and again in Best sellers.
    const card = page.locator('#collection').getByRole('article', { name: 'Amber Veil' });
    await card.getByRole('button', { name: 'Add to bag' }).click();
    await card.getByRole('button', { name: 'Add to bag' }).click();
    await expect(bagCount(page)).toHaveAccessibleName('Bag 2 items');
    await expect(page.getByRole('status').filter({ hasText: 'Amber Veil added to your bag.' })).toBeVisible();
    await page.reload();
    await expect(bagCount(page)).toHaveAccessibleName('Bag 2 items');
  });

  test('header search goes to the collection with the query', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search fragrances' }).first().fill('vetiver');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/collection\?q=vetiver$/);
  });

  test('scent family links carry the family filter', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Six scent families' }).getByRole('link', { name: /^Woody Nocturne$/ }).click();
    await expect(page).toHaveURL(/\/collection\?family=Woody$/);
  });

  test('label preview follows the name and the builder link carries it', async ({ page }) => {
    await page.goto('/');
    const input = page.getByRole('textbox', { name: 'Name on the label' });
    await input.fill('Meera');
    await expect(page.locator('[aria-hidden="true"]').getByText('Meera', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start your blend' })).toHaveAttribute('href', '/make?name=Meera');
    await expect(input).toHaveAttribute('maxlength', '18');
  });

  test('no prototype notice or placeholder tags anywhere on the homepage', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await expect(page.getByRole('complementary', { name: 'Prototype notice' })).toHaveCount(0);
    const text = (await page.locator('body').innerText()).toLowerCase();
    for (const gone of ['prototype', 'imagery pending', 'carried over', 'provisional price', 'stock photograph', 'illustration of']) {
      expect(text, gone).not.toContain(gone);
    }
  });

  test('skip link moves focus to main content', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('invented figures never render on the homepage', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    const text = await page.locator('body').innerText();
    // Contact email and "Made in India" are now owner-approved footer content.
    for (const banned of [/\bratings?\b/i, /\breviews?\b/i, /★/, /98765/, /\bbengaluru\b/i, /\bvegan\b/i, /free shipping/i, /\bgst\b/i, /\b\d+\+/, /\b\d{2}%/]) {
      expect(text, String(banned)).not.toMatch(banned);
    }
  });
});

test.describe('mobile menu', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('opens as a modal, traps focus, closes on Esc and returns focus', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    const open = page.getByRole('button', { name: 'Open menu' });
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Menu' });
    await expect(dialog).toBeVisible();
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Close menu' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
    await open.click();
    await dialog.getByRole('link', { name: 'Signature Perfume' }).click();
    await expect(page).toHaveURL(/\/collection$/);
    await expect(dialog).toBeHidden();
  });
});

// ── The drydown: linked on roomy screens, static elsewhere ────────────────
test.describe('drydown', () => {
  test.describe('desktop, motion allowed', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    test('scroll moves through top, heart and base; switching scent swaps the notes', async ({ page }) => {
      await page.goto('/');
      await settle(page);
      const section = page.locator('section[data-mode]');
      await expect(section).toHaveAttribute('data-mode', 'linked');
      const box = await section.evaluate((el) => ({ top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight }));
      const expected = [
        [0.05, 'active,future,future'],
        [0.5, 'past,active,future'],
        [0.92, 'past,past,active'],
      ] as const;
      for (const [f, states] of expected) {
        await page.evaluate((y) => window.scrollTo(0, y), Math.round(box.top + (box.h - 900) * f));
        await expect
          .poll(() => section.evaluate((el) => [...el.querySelectorAll('[data-state]')].map((e) => (e as HTMLElement).dataset.state).join(',')))
          .toBe(states);
        await page.screenshot({ path: `${LAB}/drydown-desktop-${f}.png`, animations: 'disabled' });
      }
      await page.getByRole('radio', { name: 'Nocturne' }).check({ force: true });
      await expect(section.getByText('Black tea, Cardamom, Bergamot')).toBeVisible();
      await expect(section.getByRole('link', { name: 'About Nocturne' })).toHaveAttribute('href', '/product/nocturne');
    });
  });

  test.describe('desktop, reduced motion', () => {
    test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    test('shows all three layers at once with no scroll travel', async ({ page }) => {
      await page.goto('/');
      await settle(page);
      const section = page.locator('section[data-mode]');
      await expect(section).toHaveAttribute('data-mode', 'static');
      await expect(section.locator('[data-state="shown"]')).toHaveCount(3);
      expect(await section.evaluate((el) => el.offsetHeight)).toBeLessThan(1400);
      await section.screenshot({ path: `${LAB}/drydown-desktop-reduced.png`, animations: 'disabled' });
    });
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('is static and fully readable', async ({ page }) => {
      await page.goto('/');
      await settle(page);
      const section = page.locator('section[data-mode]');
      await expect(section).toHaveAttribute('data-mode', 'static');
      await expect(section.locator('[data-state="shown"]')).toHaveCount(3);
      await section.screenshot({ path: `${LAB}/drydown-phone.png`, animations: 'disabled' });
    });
  });
});
