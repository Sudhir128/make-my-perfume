import { useEffect, useState, type RefObject } from 'react';
import { subscribeScroll } from './scheduler';

export type ProgressMode =
  /** Tall section with a sticky stage: p = (scrollY - top) / (height - viewport). */
  | 'pinned'
  /** Ordinary section leaving through the top: p = 0 at rest, 1 when it has scrolled out. */
  | 'exit';

interface Options {
  mode?: ProgressMode;
  /** Coarse steps returned to React (0..steps-1). 1 means "never re-render". */
  steps?: number;
  enabled?: boolean;
}

/**
 * Publishes `--p` (0..1) on the element through the shared scheduler, so
 * continuous visuals update without re-rendering React. Only the coarse step
 * crosses into React state, a handful of times per pass.
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>, { mode = 'pinned', steps = 1, enabled = true }: Options = {}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!enabled) {
      el.style.removeProperty('--p');
      return;
    }
    let last = -1;
    const update = () => {
      const r = el.getBoundingClientRect();
      let p: number;
      if (mode === 'pinned') {
        const travel = r.height - window.innerHeight;
        p = travel > 0 ? -r.top / travel : 0;
      } else {
        p = r.height > 0 ? -r.top / r.height : 0;
      }
      p = Math.min(1, Math.max(0, p));
      el.style.setProperty('--p', p.toFixed(4));
      const s = Math.min(steps - 1, Math.floor(p * steps));
      if (s !== last) {
        last = s;
        setStep(s);
      }
    };
    const unsubscribe = subscribeScroll(el, update);
    return () => {
      unsubscribe();
      el.style.removeProperty('--p');
    };
  }, [ref, mode, steps, enabled]);

  return step;
}

/** True when the media query matches; follows changes. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}
