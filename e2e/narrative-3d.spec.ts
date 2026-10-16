import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import sharp from 'sharp';
import { disablePointerLock, settle, watchErrors } from './helpers';

const LAB = process.env.NARRATIVE_3D_LAB ?? 'scrollcraft/lab/narrative-3d';
fs.mkdirSync(LAB, { recursive: true });

const stage = (page: Page) => page.getByTestId('narrative-stage');

async function sequenceBox(page: Page) {
  return page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('[class*="sequence"]')!;
    return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight };
  });
}

async function scrollToStage(page: Page, name: string, frac = 0.5) {
  await page.locator(`[data-stage="${name}"]`).evaluate((el, f) => {
    const r = el.getBoundingClientRect();
    // Put the reading line (60% of the viewport) at `f` through the block.
    window.scrollTo(0, r.top + scrollY + r.height * f - innerHeight * 0.6);
  }, frac);
}

test.beforeEach(async ({ page }) => {
  await disablePointerLock(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __scrollListeners: number; __cls: { value: number } };
    w.__scrollListeners = 0;
    const add = window.addEventListener.bind(window);
    window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) => {
      if (type === 'scroll') w.__scrollListeners++;
      return add(type, fn, opts);
    }) as typeof window.addEventListener;
    w.__cls = { value: 0 };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) w.__cls.value += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
});

test.describe('full tier, desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('one continuous scene follows every stage in order, on native scroll', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await settle(page);
    await expect(page.locator('[data-tier]')).toHaveAttribute('data-tier', 'full');
    await expect(stage(page)).toHaveAttribute('data-ready', 'true', { timeout: 15000 });

    const seen: string[] = [];
    for (const name of ['ingredients', 'composition', 'bottle', 'ritual', 'signature']) {
      await scrollToStage(page, name);
      await expect(stage(page)).toHaveAttribute('data-verify-stage', name);
      seen.push(name);
    }
    expect(seen).toHaveLength(5);

    // The stage stays fixed in the viewport for the whole sequence (sticky), then leaves with it.
    const box = await sequenceBox(page);
    for (const f of [0.1, 0.5, 0.9]) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(box.top + (box.h - 900) * f));
      await page.waitForTimeout(150);
      expect(Math.round(await stage(page).evaluate((el) => el.getBoundingClientRect().top))).toBe(0);
    }
    expect(await page.evaluate(() => (window as unknown as { __scrollListeners: number }).__scrollListeners)).toBe(1);
    expect(errors).toEqual([]);
  });

  test('frames: the rendered pixels change through the sequence; contact sheet', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await expect(stage(page)).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
    const box = await sequenceBox(page);
    const frames: string[] = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(box.top + (box.h - 900) * (i / (n - 1))));
      await page.waitForTimeout(450);
      const file = `${LAB}/sequence-${String(i).padStart(2, '0')}.png`;
      await page.screenshot({ path: file });
      frames.push(file);
    }
    // The scene half (right of the content column) must differ between neighbouring frames.
    const sig = async (f: string) =>
      (await sharp(f).extract({ left: 880, top: 120, width: 520, height: 700 }).resize(26, 35).greyscale().raw().toBuffer()) as Buffer;
    let changed = 0;
    for (let i = 1; i < frames.length; i++) {
      const [a, b] = [await sig(frames[i - 1]!), await sig(frames[i]!)];
      let diff = 0;
      for (let k = 0; k < a.length; k++) diff += Math.abs(a[k]! - b[k]!);
      if (diff / a.length > 1.5) changed++;
    }
    expect(changed, 'neighbouring frames whose scene changed').toBeGreaterThanOrEqual(frames.length - 2);
  });

  test('the bookend: particles hand over to the real HTML heading', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await expect(stage(page)).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
    const heading = page.locator('#signature-title');
    await scrollToStage(page, 'signature', 0.2);
    await page.waitForTimeout(400);
    expect(Number(await heading.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(0.5);
    await page.screenshot({ path: `${LAB}/bookend-forming.png` });
    await scrollToStage(page, 'signature', 0.95);
    await expect.poll(() => heading.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.99);
    await page.screenshot({ path: `${LAB}/bookend-handed-over.png` });
    await expect(heading).toHaveText(/your scent\.\s*your signature\./i);
  });

  test('family hover recolours the 3D accord; shopping stays reachable early', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await expect(stage(page)).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
    await scrollToStage(page, 'composition', 0.55);
    await page.getByRole('link', { name: 'Floral Saffron Neroli' }).hover();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${LAB}/accord-floral.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('link', { name: 'Shop the collection' }).first().click();
    await expect(page.getByRole('heading', { name: /Six scents/ })).toBeInViewport();
  });

  test('no layout shift through load and a full pass', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await expect(stage(page)).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
    const box = await sequenceBox(page);
    for (let y = 0; y < box.top + box.h; y += 600) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(60);
    }
    const cls = await page.evaluate(() => (window as unknown as { __cls: { value: number } }).__cls.value);
    expect(cls).toBeLessThan(0.02);
  });
});

test.describe('fallbacks to the complete Still composition', () => {
  test('no WebGL2: Still tier, no stage, static art visible', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === 'webgl2') return null;
        return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof orig;
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('[data-tier]')).toHaveAttribute('data-tier', 'still');
    await expect(stage(page)).toHaveCount(0);
    await expect(page.locator('[data-scene-slot="vessel"]')).toBeVisible();
  });

  test('GPU context lost: drops to Still and keeps everything usable', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(stage(page)).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
    await page.evaluate(() => {
      const c = document.querySelector('[data-testid="narrative-stage"] canvas') as HTMLCanvasElement;
      (c.getContext('webgl2') as WebGL2RenderingContext).getExtension('WEBGL_lose_context')!.loseContext();
    });
    await expect(page.locator('[data-tier]')).toHaveAttribute('data-tier', 'still');
    await expect(stage(page)).toHaveCount(0);
    await expect(page.locator('#signature-title')).toHaveCSS('opacity', '1');
    await expect(page.getByRole('link', { name: 'Shop the collection' }).first()).toBeVisible();
    expect(errors.filter((e) => !/context lost/i.test(e))).toEqual([]);
  });

  test('reduced motion: Still tier', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('[data-tier]')).toHaveAttribute('data-tier', 'still');
    await expect(stage(page)).toHaveCount(0);
  });

  test('phones: Still tier', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('[data-tier]')).toHaveAttribute('data-tier', 'still');
    await expect(stage(page)).toHaveCount(0);
  });
});
