/*
 * The contract the Three.js scene implements. The page only talks to this
 * interface, so the Still composition and the scene stay decoupled, and the
 * scene can be skipped (Still tier) or lost (context loss, slow frames) safely.
 */

export interface SceneController {
  /** Continuous sequence value t in [0, 5] from native scroll (see timeline.ts). */
  setProgress(t: number): void;
  /** Hover/focus preview of a scent family (null = scroll-driven colour). */
  previewFamily(family: string | null): void;
  /** Family of the product card at the centre of the screen. */
  setAccentFamily(family: string): void;
  /** The real HTML bookend heading; particles form its letters, then hand over. */
  setTypeTarget(heading: HTMLElement | null): void;
  resize(width: number, height: number): void;
  /** Run the render loop only while the stage is on screen and the tab visible. */
  setActive(active: boolean): void;
  dispose(): void;
}

/** Raised by the scene when it cannot continue; the page falls back to Still. */
export type SceneFailure = 'context-lost' | 'load-failed' | 'too-slow';

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  onReady: () => void;
  onFailure: (reason: SceneFailure) => void;
}
