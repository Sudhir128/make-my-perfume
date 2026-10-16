import { useEffect, useRef, useState, type RefObject } from 'react';
import { subscribeScroll } from '../scroll/scheduler';
import { ImageryPending } from '../components/ImageryPending';
import { useSceneSignals } from './signals';
import { sequenceT, stageAt } from './timeline';
import type { SceneController, SceneFailure } from './scene/types';
import styles from './NarrativeStage.module.css';

interface Props {
  /** The element wrapping every stage block of the sequence. */
  sequence: RefObject<HTMLElement | null>;
  onFailure: (reason: SceneFailure) => void;
}

/**
 * The fixed 3D stage for the continuous sequence (Full tier only). A sticky,
 * viewport-sized layer behind the content: the page scrolls natively over it,
 * and the scene follows the stage blocks as they pass. A CSS poster of the
 * flask holds the frame until the first WebGL frame is ready. Decorative only.
 */
export function NarrativeStage({ sequence, onFailure }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    const seq = sequence.current;
    const host = stage.current;
    if (!el || !seq || !host) return;
    let controller: SceneController | null = null;
    let disposed = false;
    const cleanups: Array<() => void> = [];

    const fail = (reason: SceneFailure) => {
      if (disposed) return;
      onFailure(reason);
    };

    import('./scene/createScene')
      .then(({ createScene }) => {
        if (disposed) return;
        controller = createScene({
          canvas: el,
          width: host.clientWidth,
          height: host.clientHeight,
          onReady: () => !disposed && setReady(true),
          onFailure: fail,
        });
        const c = controller;

        // Progress from the real stage blocks, through the shared scheduler.
        const blocks = () => [...seq.querySelectorAll<HTMLElement>('[data-stage]')];
        const progress = () => {
          const rects = blocks().map((b) => {
            const r = b.getBoundingClientRect();
            return { top: r.top, height: r.height };
          });
          const t = sequenceT(rects, window.innerHeight);
          c.setProgress(t);
          // Rendered state for verification (attribute writes only on change).
          const stageName = stageAt(t).stage;
          if (host.dataset.verifyStage !== stageName) host.dataset.verifyStage = stageName;
          host.dataset.verifyT = t.toFixed(1);
        };
        cleanups.push(subscribeScroll(seq, progress));

        c.setTypeTarget(seq.querySelector<HTMLElement>('#signature-title'));

        const ro = new ResizeObserver(() => c.resize(host.clientWidth, host.clientHeight));
        ro.observe(host);
        cleanups.push(() => ro.disconnect());

        // Loop only while the stage is on screen and the tab is visible.
        let onScreen = false;
        const sync = () => c.setActive(onScreen && document.visibilityState === 'visible');
        const io = new IntersectionObserver(([e]) => {
          onScreen = Boolean(e?.isIntersecting);
          sync();
        });
        io.observe(host);
        document.addEventListener('visibilitychange', sync);
        cleanups.push(() => io.disconnect(), () => document.removeEventListener('visibilitychange', sync));

        // Page signals → scene.
        const signals = useSceneSignals.getState();
        c.previewFamily(signals.previewFamily);
        c.setAccentFamily(signals.accentFamily);
        cleanups.push(
          useSceneSignals.subscribe((s) => {
            c.previewFamily(s.previewFamily);
            c.setAccentFamily(s.accentFamily);
          }),
        );
      })
      .catch(() => fail('load-failed'));

    return () => {
      disposed = true;
      cleanups.forEach((f) => f());
      controller?.dispose();
    };
  }, [sequence, onFailure]);

  return (
    <div ref={stage} className={styles.stage} aria-hidden="true" data-ready={ready || undefined} data-testid="narrative-stage">
      <div className={styles.poster}>
        <ImageryPending subject="" family="Warm" shape="flask" ratio="100 / 130" fill="load" />
      </div>
      <canvas ref={canvas} className={styles.canvas} />
    </div>
  );
}
