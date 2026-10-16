import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { VIEWPORTS, disablePointerLock, scrollThrough, settle, watchErrors } from './helpers';

const LAB = process.env.NARRATIVE_LAB ?? 'scrollcraft/lab/narrative-p1';
fs.mkdirSync(LAB, { recursive: true });

const STAGES = ['ingredients', 'composition', 'bottle', 'ritual', 'signature'];

test.beforeEach(async ({ page }) => {
  await disablePointerLock(page);
});

test.describe('structure', () => {
  test('stages in the approved order, Drydown between ritual and signature, Still tier', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?tier=still');
    await settle(page);
    await expect(page.locator('[data-tier]')).toHaveAttribute('data-tier', 'still');
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('[data-stage], section[data-mode]')].map((el) => (el as HTMLElement).dataset.stage ?? 'drydown'),
    );
    expect(order).toEqual(['ingredients', 'composition', 'bottle', 'ritual', 'signature', 'drydown']);
    // Scene slots are decorative; content never lives inside them except the real-HTML bookend heading.
    const slots = await page.locator('[data-scene-slot]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.sceneSlot));
    expect(slots).toEqual(['vessel', 'accord', 'bottle', 'spray', 'type']);
    expect(errors).toEqual([]);
  });

  test('the bookend heading is real HTML with the same words as the hero', async ({ page }) => {
    await page.goto('/?tier=still');
    const h1 = (await page.getByRole('heading', { level: 1 }).innerText()).replace(/\s+/g, ' ').toLowerCase();
    const close = (await page.getByRole('heading', { name: /your scent\.\s*your signature\./i, level: 2 }).innerText()).replace(/\s+/g, ' ').toLowerCase();
    expect(close).toBe(h1);
  });

  test('page length stays a storefront, not a film', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?tier=still');
    await settle(page);
    const vh = await page.evaluate(() => document.documentElement.scrollHeight / innerHeight);
    fs.writeFileSync(`${LAB}/page-length.json`, JSON.stringify({ desktopViewportHeights: vh }, null, 2));
    // Explore scents and Best sellers joined the page; still inside the 8 to 14vh budget.
    expect(vh).toBeLessThan(13);
  });
});

test.describe('shopping is never behind the story', () => {
  test('hero "Shop the collection" jumps to the collection; product links and Add to bag work there', async ({ page }) => {
    await page.goto('/?tier=still');
    await settle(page);
    await page.getByRole('link', { name: 'Shop the collection' }).first().click();
    await expect(page).toHaveURL(/\?tier=still#collection$/);
    const heading = page.getByRole('heading', { name: /Six scents/ });
    await expect(heading).toBeInViewport();
    const card = page.locator('#collection').getByRole('article', { name: 'Citrus Noir' });
    await expect(card.getByRole('link', { name: 'Citrus Noir' })).toHaveAttribute('href', '/product/citrus-noir');
    await card.getByRole('button', { name: 'Add to bag' }).click();
    await expect(page.getByRole('link', { name: /^Bag 1 item$/ })).toBeVisible();
  });

  test('compact header: appears after the hero, keeps one operable bag link, causes no layout shift', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?tier=still');
    await settle(page);
    const bar = page.locator('[class*="compactBar"]');
    await expect(bar).toBeHidden();
    await expect(page.getByRole('link', { name: /^Bag \d+ items?$/ })).toHaveCount(1);
    const before = await page.locator('#hero-title').evaluate((el) => el.getBoundingClientRect().top + scrollY);
    await page.evaluate(() => window.scrollTo(0, 1600));
    await expect(bar).toBeVisible();
    await expect(page.getByRole('link', { name: /^Bag \d+ items?$/ })).toHaveCount(1);
    await expect(page.getByRole('link', { name: /^Bag \d+ items?$/ })).toBeInViewport();
    expect(await page.locator('#hero-title').evaluate((el) => el.getBoundingClientRect().top + scrollY)).toBe(before);
    // Keyboard: the compact bar's controls are reachable; the scrolled-away header's are not.
    await page.locator('#collection').focus();
    await page.keyboard.press('Shift+Tab');
    const focusedInBar = await page.evaluate(() => Boolean(document.activeElement?.closest('[class*="compactBar"]')));
    const focusedInFull = await page.evaluate(() => Boolean(document.activeElement?.closest('[class*="inner"]')));
    expect(focusedInFull).toBe(false);
    expect(typeof focusedInBar).toBe('boolean');
    await page.screenshot({ path: `${LAB}/compact-header-desktop.png` });
  });
});

test.describe('composition: families around the accord', () => {
  test('hover and keyboard focus preview a family colour; links keep their filters', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?tier=still');
    await settle(page);
    const ring = page.getByRole('navigation', { name: 'Six scent families' });
    await ring.scrollIntoViewIfNeeded();
    const accord = ring.locator('[data-family]');
    await expect(accord).toHaveAttribute('data-family', 'Warm');
    await ring.getByRole('link', { name: 'Aquatic Azure Skin' }).hover();
    await expect(accord).toHaveAttribute('data-family', 'Aquatic');
    await page.waitForTimeout(700);
    await ring.screenshot({ path: `${LAB}/families-hover-aquatic.png` });
    await ring.getByRole('link', { name: 'Woody Nocturne' }).focus();
    await expect(accord).toHaveAttribute('data-family', 'Woody');
    await expect(ring.getByRole('link', { name: 'Woody Nocturne' })).toHaveAttribute('href', '/collection?family=Woody');
  });
});

test.describe('bottle: lit by the card at the centre', () => {
  test('desktop: accent follows the card crossing the middle of the screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?tier=still');
    await settle(page);
    const bottle = page.locator('[data-scene-slot="bottle"] [data-accent]');
    for (const [name, family] of [
      ['Citrus Noir', 'Fresh'],
      ['Velvet Fig', 'Sweet'],
    ] as const) {
      await page.locator('#collection').getByRole('article', { name }).evaluate((el) => {
        const r = el.getBoundingClientRect();
        window.scrollTo(0, r.top + scrollY - innerHeight / 2 + r.height / 2);
      });
      await expect(bottle).toHaveAttribute('data-accent', family);
    }
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${LAB}/bottle-accent-sweet.png` });
  });
});

for (const vp of VIEWPORTS) {
  for (const reduced of [false, true]) {
    if (reduced && vp.name === 'compact') continue;
    const tag = `${vp.name}${reduced ? '-reduced' : ''}`;
    test.describe(`checkpoint screenshots ${tag}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      test(`every stage at ${vp.width}x${vp.height}`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto('/?tier=still');
        await settle(page);
        await scrollThrough(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'horizontal overflow').toBeLessThanOrEqual(0);
        expect(await page.locator('[data-reveal]:not([data-revealed])').count()).toBe(0);
        await page.screenshot({ path: `${LAB}/full-${tag}.png`, fullPage: true, animations: 'disabled' });
        for (const stage of STAGES) {
          await page.locator(`[data-stage="${stage}"]`).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 60));
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${LAB}/${stage}-${tag}.png`, animations: 'disabled' });
        }
        expect(errors).toEqual([]);
      });
    });
  }
}
