import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { disablePointerLock, scrollThrough, settle, watchErrors } from './helpers';

const LAB = process.env.MOTION_LAB ?? 'scrollcraft/lab/motion';
fs.mkdirSync(LAB, { recursive: true });

/** translateY in px and scaleY from a computed transform matrix. */
async function transformOf(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return { ty: 0, sy: 1, none: true };
    const m = new DOMMatrixReadOnly(t);
    return { ty: Math.round(m.m42 * 100) / 100, sy: Math.round(Math.hypot(m.m21, m.m22) * 1000) / 1000, none: false };
  });
}

test.beforeEach(async ({ page }) => {
  await disablePointerLock(page);
  // Count window scroll listeners so duplicates are caught.
  await page.addInitScript(() => {
    const w = window as unknown as { __scrollListeners: number };
    w.__scrollListeners = 0;
    const add = window.addEventListener.bind(window);
    window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) => {
      if (type === 'scroll') w.__scrollListeners++;
      return add(type, fn, opts);
    }) as typeof window.addEventListener;
    // Cumulative layout shift, buffered from the start.
    const cls = { value: 0 };
    (window as unknown as { __cls: typeof cls }).__cls = cls;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!e.hadRecentInput) cls.value += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
});

test.describe('hero decant, desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('headline, lede and actions are readable at once; the decant plays and finishes', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    // Captured as early as possible: copy is never part of the choreography.
    const early = await page.evaluate(() => {
      const els = [...document.querySelectorAll('#hero-title, #hero-title ~ p, #hero-title ~ div a')];
      return els.map((el) => ({ opacity: getComputedStyle(el).opacity, animating: el.getAnimations().length }));
    });
    expect(early.length).toBeGreaterThanOrEqual(3);
    for (const e of early) {
      expect(e.opacity).toBe('1');
      expect(e.animating).toBe(0);
    }
    for (const ms of [0, 400, 900]) {
      if (ms) await page.waitForTimeout(ms === 400 ? 400 : 500);
      await page.screenshot({ path: `${LAB}/hero-desktop-${String(ms).padStart(4, '0')}ms.png`, clip: { x: 0, y: 130, width: 1440, height: 770 } });
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${LAB}/hero-desktop-1900ms.png`, clip: { x: 0, y: 130, width: 1440, height: 770 } });
    const liquid = await page.locator('[class*="fillLoad"] [class*="liquid"]').first().evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(liquid);
    const dash = await page.locator('[class*="sprig"] path').first().evaluate((el) => getComputedStyle(el).strokeDashoffset);
    expect(parseFloat(dash)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('scroll-linked depth: flask and sprig drift at different rates, text stays put', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    const before = { flask: await transformOf(page, '[class*="flaskLayer"]'), sprig: await transformOf(page, '[class*="sprigLayer"]') };
    const titleBefore = await page.locator('#hero-title').evaluate((el) => el.getBoundingClientRect().top + scrollY);
    await page.evaluate(() => window.scrollTo(0, 450));
    await expect.poll(async () => (await transformOf(page, '[class*="flaskLayer"]')).ty).toBeLessThan(-5);
    const after = { flask: await transformOf(page, '[class*="flaskLayer"]'), sprig: await transformOf(page, '[class*="sprigLayer"]') };
    expect(before.flask.ty).toBe(0);
    expect(after.flask.ty).toBeGreaterThanOrEqual(-48);
    expect(after.sprig.ty).toBeLessThan(after.flask.ty * 1.5); // sprig moves further
    expect(after.sprig.ty).toBeGreaterThanOrEqual(-96);
    expect(await page.locator('#hero-title').evaluate((el) => el.getBoundingClientRect().top + scrollY)).toBe(titleBefore);
    await page.screenshot({ path: `${LAB}/hero-desktop-scrolled-450.png` });
  });
});

test.describe('hero, phone and reduced motion', () => {
  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('decant plays; no scroll-linked depth', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${LAB}/hero-phone-0350ms.png` });
      await settle(page);
      await page.waitForTimeout(1600);
      await page.evaluate(() => window.scrollTo(0, 450));
      await page.waitForTimeout(200);
      expect((await transformOf(page, '[class*="flaskLayer"]')).ty).toBe(0);
      expect((await transformOf(page, '[class*="sprigLayer"]')).ty).toBe(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${LAB}/hero-phone-final.png` });
    });
  });
  test.describe('desktop, reduced motion', () => {
    test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    test('final composition at once; no depth; nothing pre-hidden', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForTimeout(60);
      expect(await page.evaluate(() => document.documentElement.classList.contains('motion-ok'))).toBe(false);
      const liquid = await page.locator('[class*="fillLoad"] [class*="liquid"]').first().evaluate((el) => getComputedStyle(el).transform);
      expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(liquid);
      await page.evaluate(() => window.scrollTo(0, 450));
      await page.waitForTimeout(150);
      expect((await transformOf(page, '[class*="flaskLayer"]')).ty).toBe(0);
      // Every entrance target is visible without scrolling to it.
      const hidden = await page.evaluate(() =>
        [...document.querySelectorAll('[data-reveal], [data-reveal] [class*="body"]')].filter((el) => getComputedStyle(el).opacity !== '1').length,
      );
      expect(hidden).toBe(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${LAB}/hero-desktop-reduced.png` });
    });
  });
});

test.describe('entrances', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a card below the fold is pre-hidden, reveals once on entry and never re-hides', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    expect(await page.evaluate(() => document.documentElement.classList.contains('motion-ok'))).toBe(true);
    const card = page.getByRole('article', { name: 'Velvet Fig' });
    await expect(card).not.toHaveAttribute('data-revealed', '');
    expect(await card.locator('[class*="body"]').evaluate((el) => getComputedStyle(el).opacity)).toBe('0');
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${LAB}/cards-mid-reveal.png` });
    await expect(card).toHaveAttribute('data-revealed', '');
    await expect.poll(() => card.locator('[class*="body"]').evaluate((el) => getComputedStyle(el).opacity), { timeout: 1500 }).toBe('1');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${LAB}/cards-revealed.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await expect(card).toHaveAttribute('data-revealed', '');
  });

  test('after a full scroll every entrance has fired; no layout shift; one scroll listener', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await settle(page);
    await scrollThrough(page);
    expect(await page.locator('[data-reveal]:not([data-revealed])').count()).toBe(0);
    const opaque = await page.evaluate(() =>
      [...document.querySelectorAll('[data-reveal]')].every((el) => getComputedStyle(el).opacity === '1'),
    );
    expect(opaque).toBe(true);
    const cls = await page.evaluate(() => (window as unknown as { __cls: { value: number } }).__cls.value);
    expect(cls, 'cumulative layout shift').toBeLessThan(0.02);
    expect(await page.evaluate(() => (window as unknown as { __scrollListeners: number }).__scrollListeners)).toBe(1);
    expect(errors).toEqual([]);
  });

  test('content jumped past (anchor link) is revealed, never left hidden', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await page.getByRole('link', { name: 'Shop the collection' }).first().click();
    await expect(page).toHaveURL(/#collection$/);
    await page.waitForTimeout(900);
    const story = page.locator('[data-stage="composition"] [data-reveal]').first();
    await expect(story).toHaveAttribute('data-revealed', '');
  });

  test('keyboard focus reveals hidden content immediately', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    const card = page.getByRole('article', { name: 'Saffron Neroli' });
    await expect(card).not.toHaveAttribute('data-revealed', '');
    await card.getByRole('link', { name: 'Saffron Neroli' }).focus();
    await expect(card).toHaveAttribute('data-revealed', '');
  });

  test('without IntersectionObserver nothing is ever hidden', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
    });
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.classList.contains('motion-ok'))).toBe(false);
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll('[data-reveal], [data-reveal] [class*="body"]')].filter((el) => getComputedStyle(el).opacity !== '1').length,
    );
    expect(hidden).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe('family band', () => {
  test('desktop: six filter links, each with its catalogue fragrance', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const band = page.getByRole('navigation', { name: 'Six scent families' });
    const expected = [
      ['Fresh', 'Citrus Noir'],
      ['Warm', 'Amber Veil'],
      ['Woody', 'Nocturne'],
      ['Aquatic', 'Azure Skin'],
      ['Sweet', 'Velvet Fig'],
      ['Floral', 'Saffron Neroli'],
    ];
    for (const [family, scent] of expected) {
      const link = band.getByRole('link', { name: `${family} ${scent}` });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', `/collection?family=${family}`);
    }
    await band.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await band.screenshot({ path: `${LAB}/band-desktop.png` });
  });

  test('phone: all six families visible in a grid, no sideways scroll needed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await settle(page);
    const band = page.getByRole('navigation', { name: 'Six scent families' });
    await band.scrollIntoViewIfNeeded();
    const links = band.getByRole('link');
    await expect(links).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      const box = await links.nth(i).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    }
    await band.screenshot({ path: `${LAB}/band-phone.png` });
  });
});

test.describe('drydown', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('rail and stains follow scroll at 5%, 50% and 92%', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    const section = page.locator('section[data-mode]');
    await expect(section).toHaveAttribute('data-mode', 'linked');
    const box = await section.evaluate((el) => ({ top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight }));
    const rows: Array<{ f: number; fill: number; top: number; base: number; states: string }> = [];
    for (const [f, states] of [
      [0.05, 'active,future,future'],
      [0.5, 'past,active,future'],
      [0.92, 'past,past,active'],
    ] as const) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(box.top + (box.h - 900) * f));
      await expect
        .poll(() => section.evaluate((el) => [...el.querySelectorAll('[data-state]')].map((e) => (e as HTMLElement).dataset.state).join(',')))
        .toBe(states);
      await page.waitForTimeout(300);
      const fill = (await transformOf(page, '[class*="railFill"]')).sy;
      const top = (await transformOf(page, '[class*="stainTop"]')).ty;
      const base = (await transformOf(page, '[class*="stainBase"]')).ty;
      rows.push({ f, fill, top, base, states });
      expect(fill).toBeGreaterThan(f - 0.06);
      expect(fill).toBeLessThan(f + 0.06);
      await page.screenshot({ path: `${LAB}/drydown-${f}.png` });
    }
    // Top lifts upward over the pass; base settles from above to its place.
    expect(rows[2]!.top).toBeLessThan(rows[0]!.top);
    expect(rows[0]!.base).toBeLessThan(rows[2]!.base);
    expect(rows[2]!.base).toBeGreaterThan(-1);
    fs.writeFileSync(`${LAB}/drydown-measurements.json`, JSON.stringify(rows, null, 2));
  });

  test('switching scent cross-fades the colours and swaps the notes', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    const section = page.locator('section[data-mode]');
    const box = await section.evaluate((el) => ({ top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight }));
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(box.top + (box.h - 900) * 0.6));
    await page.waitForTimeout(300);
    const mid = () => section.locator('[class*="visual"]').evaluate((el) => getComputedStyle(el).getPropertyValue('--mid').trim());
    const start = await mid();
    // Click and sample inside the page, so no scroll-into-view eats the window.
    const during = await page.evaluate(async () => {
      const radio = [...document.querySelectorAll<HTMLInputElement>('section[data-mode] input[type=radio]')].find((r) => r.value === 'nocturne')!;
      radio.click();
      await new Promise((r) => setTimeout(r, 150));
      return getComputedStyle(document.querySelector('section[data-mode] [class*="visual"]')!).getPropertyValue('--mid').trim();
    });
    await page.screenshot({ path: `${LAB}/drydown-switch-150ms.png` });
    await page.waitForTimeout(800);
    const end = await mid();
    expect(end).toMatch(/rgb\(140, 106, 75\)|#8c6a4b/i);
    expect(during).not.toBe(start);
    expect(during).not.toBe(end);
    await expect(section.getByText('Iris, Suede, Incense')).toBeVisible();
    await page.screenshot({ path: `${LAB}/drydown-switch-done.png` });
  });
});

test.describe('drydown, static versions', () => {
  test('phone: static, rail full, all three layers', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await settle(page);
    const section = page.locator('section[data-mode]');
    await expect(section).toHaveAttribute('data-mode', 'static');
    await expect(section.locator('[data-state="shown"]')).toHaveCount(3);
    expect((await transformOf(page, '[class*="railFill"]')).none).toBe(true);
    await section.screenshot({ path: `${LAB}/drydown-phone.png` });
  });
  test('reduced motion: static, instant scent switch', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await settle(page);
    const section = page.locator('section[data-mode]');
    await expect(section).toHaveAttribute('data-mode', 'static');
    await page.getByRole('radio', { name: 'Nocturne' }).check({ force: true });
    await expect(section.getByText('Black tea, Cardamom, Bergamot')).toBeVisible();
    await section.screenshot({ path: `${LAB}/drydown-reduced.png` });
  });
});
