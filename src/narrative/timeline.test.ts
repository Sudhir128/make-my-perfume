import { describe, expect, it } from 'vitest';
import { BOTTLE_TURNS, STAGES, sceneParams, sequenceT, smooth, stageAt, type SceneParams } from './timeline';

const samples = Array.from({ length: 501 }, (_, i) => (i / 500) * 5);
const flat = (s: SceneParams) => [
  s.ingredients.spread,
  s.ingredients.pour,
  s.ingredients.visible,
  s.flask.visible,
  s.flask.fill,
  s.accord.visible,
  s.accord.familyMix,
  s.bottle.visible,
  s.bottle.build,
  s.bottle.capOn,
  s.bottle.capLift,
  s.camera.closeUp,
  s.camera.centre,
  s.mist.amount,
  s.mist.drift,
  s.type.formation,
  s.type.handoff,
];

describe('sequenceT', () => {
  const vh = 1000;
  it('is 0 before the first stage reaches the reading line and 5 after the last passes it', () => {
    const below = STAGES.map((_, i) => ({ top: 700 + i * 1000, height: 1000 }));
    expect(sequenceT(below, vh)).toBe(0);
    const above = STAGES.map((_, i) => ({ top: -6000 + i * 1000, height: 1000 }));
    expect(sequenceT(above, vh)).toBe(5);
  });

  it('is continuous across a stage boundary', () => {
    const at = (scroll: number) => sequenceT(STAGES.map((_, i) => ({ top: i * 1000 - scroll, height: 1000 })), vh);
    expect(at(400 - 1)).toBeCloseTo(at(400 + 1), 2);
    expect(at(400)).toBeCloseTo(1, 5); // reading line 600px: t = (scroll + 600) / 1000
    expect(at(1900)).toBeCloseTo(2.5, 5);
  });
});

describe('stageAt', () => {
  it('maps t to the approved order', () => {
    expect(stageAt(0).stage).toBe('ingredients');
    expect(stageAt(1.5).stage).toBe('composition');
    expect(stageAt(2.5).stage).toBe('bottle');
    expect(stageAt(3.5)).toMatchObject({ stage: 'ritual', local: 0.5 });
    expect(stageAt(5).stage).toBe('signature');
    expect(stageAt(-2).stage).toBe('ingredients');
  });
});

describe('sceneParams', () => {
  it('keeps every normalised parameter in [0, 1]', () => {
    for (const t of samples) {
      const s = sceneParams(t);
      for (const v of flat(s)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(s.bottle.rotation).toBeLessThanOrEqual(BOTTLE_TURNS * 2 * Math.PI + 1e-9);
    }
  });

  it('is continuous: no large jump between neighbouring samples', () => {
    for (let i = 1; i < samples.length; i++) {
      const a = flat(sceneParams(samples[i - 1]!));
      const b = flat(sceneParams(samples[i]!));
      a.forEach((v, k) => expect(Math.abs(b[k]! - v)).toBeLessThan(0.12));
    }
  });

  it('moves one way where the story does', () => {
    for (let i = 1; i < samples.length; i++) {
      const a = sceneParams(samples[i - 1]!);
      const b = sceneParams(samples[i]!);
      expect(b.ingredients.spread).toBeLessThanOrEqual(a.ingredients.spread + 1e-12);
      expect(b.bottle.build).toBeGreaterThanOrEqual(a.bottle.build - 1e-12);
      expect(b.bottle.rotation).toBeGreaterThanOrEqual(a.bottle.rotation - 1e-12);
      expect(b.type.formation).toBeGreaterThanOrEqual(a.type.formation - 1e-12);
    }
  });

  it('tells the story in order, with the scene never empty', () => {
    expect(sceneParams(0)).toMatchObject({ ingredients: { spread: 1, visible: 1 }, flask: { visible: 1 } });
    expect(sceneParams(1.5).accord.visible).toBe(1);
    expect(sceneParams(2.6)).toMatchObject({ bottle: { visible: 1, build: 1, capOn: 1 }, accord: { visible: 0 } });
    expect(sceneParams(3.8)).toMatchObject({ bottle: { capLift: 1 }, mist: { amount: 1 } });
    expect(sceneParams(5).type).toEqual({ formation: 1, handoff: 1 });
    // Something is always on stage.
    for (const t of samples) {
      const s = sceneParams(t);
      const presence = Math.max(s.ingredients.visible, s.flask.visible, s.accord.visible, s.bottle.visible, s.mist.amount);
      expect(presence).toBeGreaterThan(0.2);
    }
  });

  it('smooth() is a clamped smoothstep', () => {
    expect(smooth(0, 1, -1)).toBe(0);
    expect(smooth(0, 1, 0.5)).toBeCloseTo(0.5, 10);
    expect(smooth(0, 1, 2)).toBe(1);
  });
});
