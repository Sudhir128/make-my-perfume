/*
 * "From Nature to Signature": one continuous vertical sequence.
 *
 * The scene is driven by a single continuous value t in [0, 5]:
 *   0..1 ingredients · 1..2 composition · 2..3 bottle · 3..4 ritual · 4..5 signature
 * t is measured from the real stage blocks as they cross the viewport
 * (`sequenceT`), so the scene always stays in step with the content beside it,
 * whatever its height. The Drydown follows the sequence as its own section.
 */

export type StageId = 'ingredients' | 'composition' | 'bottle' | 'ritual' | 'signature';

export const STAGES: readonly StageId[] = ['ingredients', 'composition', 'bottle', 'ritual', 'signature'];
export const STAGE_COUNT = STAGES.length;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Cubic smoothstep: 0 before a, 1 after b. */
export function smooth(a: number, b: number, x: number): number {
  if (b <= a) return x >= b ? 1 : 0;
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export interface StageRect {
  top: number;
  height: number;
}

/**
 * Continuous sequence value from the stage blocks' viewport rects. A stage
 * counts as 0 until its top reaches the reading line (60% down the viewport)
 * and 1 once its bottom has passed it.
 */
export function sequenceT(rects: readonly StageRect[], viewportHeight: number, readingLine = 0.6): number {
  const line = viewportHeight * readingLine;
  return rects.reduce((sum, r) => sum + (r.height > 0 ? clamp01((line - r.top) / r.height) : 0), 0);
}

export function stageAt(t: number): { stage: StageId; index: number; local: number } {
  const x = Math.min(STAGE_COUNT - 1e-9, Math.max(0, t));
  const index = Math.floor(x);
  return { stage: STAGES[index]!, index, local: x - index };
}

export interface SceneParams {
  ingredients: { spread: number; pour: number; visible: number };
  flask: { visible: number; fill: number };
  accord: { visible: number; familyMix: number };
  bottle: { visible: number; build: number; capOn: number; rotation: number; capLift: number };
  camera: { closeUp: number; centre: number };
  mist: { amount: number; drift: number };
  type: { formation: number; handoff: number };
}

// One full turn, so the label faces front again for the ritual.
export const BOTTLE_TURNS = 1;

/** Scene parameters for a sequence value. Continuous everywhere. */
export function sceneParams(t: number): SceneParams {
  const x = Math.min(STAGE_COUNT, Math.max(0, t));
  return {
    ingredients: {
      spread: 1 - smooth(0.15, 1.0, x),
      pour: smooth(0.6, 1.1, x),
      visible: 1 - smooth(0.95, 1.2, x),
    },
    flask: {
      visible: 1 - smooth(1.6, 2.05, x),
      fill: smooth(0.55, 1.15, x),
    },
    accord: {
      visible: smooth(1.0, 1.3, x) * (1 - smooth(1.85, 2.2, x)),
      familyMix: clamp01(x - 1),
    },
    bottle: {
      visible: smooth(1.9, 2.15, x) * (1 - smooth(3.95, 4.2, x)),
      build: smooth(2.0, 2.35, x),
      capOn: smooth(2.25, 2.45, x),
      rotation: smooth(2.4, 3.05, x) * BOTTLE_TURNS * Math.PI * 2,
      capLift: smooth(3.1, 3.4, x),
    },
    camera: {
      closeUp: smooth(3.0, 3.35, x) * (1 - smooth(4.0, 4.4, x)),
      centre: smooth(4.0, 4.4, x),
    },
    mist: {
      amount: smooth(3.4, 3.55, x),
      drift: smooth(3.45, 4.1, x),
    },
    type: {
      formation: smooth(4.1, 4.6, x),
      handoff: smooth(4.6, 4.8, x),
    },
  };
}
