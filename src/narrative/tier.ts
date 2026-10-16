/*
 * Which narrative experience a device gets.
 *   full  : WebGL scene, desktop-class device, motion allowed
 *   lite  : simplified scene for smaller GPUs (disabled until profiling supports it)
 *   still : the complete static composition (always available)
 *
 * Full needs a desktop-width viewport (>= 1024px), WebGL2, >= 4 GB memory when
 * reported, no data saver and motion allowed. Everything else gets `still`.
 */

export type Tier = 'full' | 'lite' | 'still';

/** The Three.js scene ships with the continuous sequence. */
export const RENDERER_3D_AVAILABLE = true;
/** Owner decision: Lite only if profiling demonstrates acceptable performance. */
export const LITE_ENABLED = false;

export interface Capabilities {
  webgl2: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  /** navigator.deviceMemory in GB when the browser exposes it. */
  deviceMemory?: number;
  viewportWidth: number;
}

export interface TierChoice {
  tier: Tier;
  reasons: string[];
}

export function chooseTier(
  c: Capabilities,
  { override, renderer = RENDERER_3D_AVAILABLE, lite = LITE_ENABLED }: { override?: string | null; renderer?: boolean; lite?: boolean } = {},
): TierChoice {
  const reasons: string[] = [];
  if (override === 'still') return { tier: 'still', reasons: ['override'] };
  if (!renderer) reasons.push('no-3d-renderer');
  if (c.reducedMotion) reasons.push('reduced-motion');
  if (!c.webgl2) reasons.push('no-webgl2');
  if (c.saveData) reasons.push('save-data');
  if (c.deviceMemory !== undefined && c.deviceMemory < 4) reasons.push('low-memory');
  if (reasons.length) return { tier: 'still', reasons };
  const small = c.viewportWidth < 1024;
  if (override === 'lite' || (small && lite)) return lite || override === 'lite' ? { tier: 'lite', reasons: [small ? 'small-viewport' : 'override'] } : { tier: 'still', reasons: ['lite-disabled'] };
  if (small) return { tier: 'still', reasons: ['small-viewport', 'lite-disabled'] };
  return { tier: 'full', reasons: override === 'full' ? ['override'] : [] };
}

export function detectCapabilities(): Capabilities {
  let webgl2 = false;
  try {
    webgl2 = Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    webgl2 = false;
  }
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    webgl2,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: Boolean(nav.connection?.saveData),
    deviceMemory: nav.deviceMemory,
    viewportWidth: window.innerWidth,
  };
}

/** `?tier=still|lite|full` for verification; ignored unless valid. */
export function tierOverride(search: string): string | null {
  const t = new URLSearchParams(search).get('tier');
  return t === 'still' || t === 'lite' || t === 'full' ? t : null;
}
