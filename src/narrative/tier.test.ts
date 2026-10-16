import { describe, expect, it } from 'vitest';
import { chooseTier, tierOverride, type Capabilities } from './tier';

const desktop: Capabilities = { webgl2: true, reducedMotion: false, saveData: false, deviceMemory: 8, viewportWidth: 1440 };

describe('chooseTier', () => {
  it('resolves to still when no 3D renderer exists', () => {
    expect(chooseTier(desktop, { renderer: false })).toEqual({ tier: 'still', reasons: ['no-3d-renderer'] });
    expect(chooseTier(desktop, { renderer: false, override: 'full' }).tier).toBe('still');
  });

  it('gives capable desktops the full scene by default', () => {
    expect(chooseTier(desktop).tier).toBe('full');
  });

  it('gives full only to capable desktops once the renderer exists', () => {
    expect(chooseTier(desktop, { renderer: true }).tier).toBe('full');
  });

  it('falls back to still for every failing capability', () => {
    const r = { renderer: true };
    expect(chooseTier({ ...desktop, reducedMotion: true }, r)).toEqual({ tier: 'still', reasons: ['reduced-motion'] });
    expect(chooseTier({ ...desktop, webgl2: false }, r).reasons).toContain('no-webgl2');
    expect(chooseTier({ ...desktop, saveData: true }, r).reasons).toContain('save-data');
    expect(chooseTier({ ...desktop, deviceMemory: 2 }, r).reasons).toContain('low-memory');
  });

  it('keeps phones on still while Lite is disabled', () => {
    expect(chooseTier({ ...desktop, viewportWidth: 390 }, { renderer: true }).tier).toBe('still');
    expect(chooseTier({ ...desktop, viewportWidth: 390 }, { renderer: true, lite: true }).tier).toBe('lite');
  });

  it('always honours a still override', () => {
    expect(chooseTier(desktop, { renderer: true, override: 'still' }).tier).toBe('still');
  });
});

describe('tierOverride', () => {
  it('accepts only known tiers', () => {
    expect(tierOverride('?tier=still')).toBe('still');
    expect(tierOverride('?tier=ultra')).toBeNull();
    expect(tierOverride('')).toBeNull();
  });
});
