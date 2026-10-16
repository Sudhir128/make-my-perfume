import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { contrastRatio, luminance, parseColor, type RGB } from '../src/lib/contrast';

export const LAB = process.env.LAB_DIR ?? 'scrollcraft/lab/m1';

export const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'compact', width: 360, height: 640 },
] as const;

/** Headless Chrome can reach desktop cursor APIs on Windows; keep them virtual. */
export async function disablePointerLock(page: Page) {
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      return Promise.reject(new Error('Native pointer lock disabled during verification'));
    } as typeof Element.prototype.requestPointerLock;
    Element.prototype.setPointerCapture = function () {};
    Element.prototype.releasePointerCapture = function () {};
    Document.prototype.exitPointerLock = function () {};
  });
}

export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()} ${r.failure()?.errorText}`));
  return errors;
}

export async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}

interface TextSample {
  text: string;
  fg: string;
  bg: string | null;
  large: boolean;
  rect: { x: number; y: number; w: number; h: number };
}

export interface ContrastResult {
  text: string;
  ratio: number;
  min: number;
  method: 'computed' | 'pixels';
}

/**
 * Measures every visible text run on the page against what is really behind it.
 * Solid grounds come from computed styles. Gradient or image grounds are
 * sampled from a screenshot taken with all text made transparent, using the
 * worst pixel (95th percentile toward the text's own luminance).
 */
export async function measureTextContrast(page: Page): Promise<ContrastResult[]> {
  const samples: TextSample[] = await page.evaluate(() => {
    const parse = (c: string) => {
      const m = /rgba?\(([^)]+)\)/.exec(c);
      if (!m) return null;
      const p = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
      return { rgb: p.slice(0, 3), a: p[3] ?? 1 };
    };
    const groundOf = (start: Element | null): string | null => {
      for (let n: Element | null = start; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage !== 'none') return null;
        const bg = parse(cs.backgroundColor);
        if (bg && bg.a >= 0.99) return `rgb(${bg.rgb.join(',')})`;
        if (bg && bg.a > 0) return null;
      }
      return 'rgb(11,10,9)';
    };
    const out: TextSample[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const el = t.parentElement;
      if (!el || seen.has(el) || !t.textContent?.trim()) continue;
      seen.add(el);
      if (el.closest('.visually-hidden, [aria-hidden="true"] svg, script, style')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || Number(cs.opacity) === 0) continue;
      // WCAG exempts disabled controls.
      if (el.closest('button:disabled, [aria-disabled="true"]')) continue;
      let o = 1;
      for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
      if (o < 0.99) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const size = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight);
      out.push({
        text: t.textContent.trim().slice(0, 60),
        fg: cs.color,
        bg: groundOf(el),
        large: size >= 24 || (size >= 18.66 && weight >= 700),
        rect: { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height },
      });
    }
    return out;
  });

  const needPixels = samples.some((s) => s.bg === null);
  let shot: { data: Buffer; width: number; height: number } | null = null;
  if (needPixels) {
    const style = await page.addStyleTag({ content: '*{color:transparent!important;text-shadow:none!important}' });
    const png = await page.screenshot({ fullPage: true, animations: 'disabled' });
    await style.evaluate((n) => (n as Element).remove());
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    shot = { data, width: info.width, height: info.height };
  }

  return samples.map((s) => {
    const fg = parseColor(s.fg)!;
    const min = s.large ? 3 : 4.5;
    if (s.bg) return { text: s.text, ratio: contrastRatio(fg, parseColor(s.bg)!), min, method: 'computed' as const };
    const bg = worstPixel(shot!, s.rect, luminance(fg));
    return { text: s.text, ratio: contrastRatio(fg, bg), min, method: 'pixels' as const };
  });
}

/** The pixel in a box whose luminance is closest to `towards` (95th percentile). */
function worstPixel(img: { data: Buffer; width: number; height: number }, r: TextSample['rect'], towards: number): RGB {
  const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(img.width, Math.ceil(r.x + r.w)), y1 = Math.min(img.height, Math.ceil(r.y + r.h));
  const px: Array<{ c: RGB; d: number }> = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 3;
      const c: RGB = [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!];
      px.push({ c, d: Math.abs(luminance(c) - towards) });
    }
  }
  px.sort((a, b) => a.d - b.d);
  return px[Math.floor(px.length * 0.05)]?.c ?? [11, 10, 9];
}

export interface FocusResult {
  name: string;
  style: string;
  width: number;
  ratio: number;
}

/**
 * Tabs through the page and checks each focus ring: visible style, at least
 * 2px, and at least 3:1 against the worst pixel in the band it is drawn on
 * (sampled from an unfocused, text-hidden screenshot).
 */
export async function measureFocusRings(page: Page, maxTabs = 60): Promise<FocusResult[]> {
  const style = await page.addStyleTag({ content: '*{color:transparent!important}' });
  const png = await page.screenshot({ fullPage: true, animations: 'disabled' });
  await style.evaluate((n) => (n as Element).remove());
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = { data, width: info.width, height: info.height };

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.click(1, 1);
  const results: FocusResult[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        key: el.outerHTML.slice(0, 120) + r.top,
        name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40),
        style: cs.outlineStyle,
        width: parseFloat(cs.outlineWidth),
        offset: parseFloat(cs.outlineOffset),
        color: cs.outlineColor,
        rect: { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height },
      };
    });
    if (!f || seen.has(f.key)) break;
    seen.add(f.key);
    const ring = parseColor(f.color) ?? [0, 0, 0];
    const o = f.offset + f.width;
    // Top band where the ring is drawn.
    const band = { x: f.rect.x - o, y: f.rect.y - o, w: f.rect.w + 2 * o, h: Math.max(1, f.width) };
    const bg = worstPixel(img, band, luminance(ring));
    results.push({ name: f.name, style: f.style, width: f.width, ratio: contrastRatio(ring, bg) });
  }
  return results;
}

/**
 * Scroll the whole page in viewport steps (native scrolling), then return to
 * the top, so every once-only entrance has fired before measuring or taking a
 * full-page screenshot. Waits for the longest entrance to finish.
 */
export async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.7);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1400);
}
