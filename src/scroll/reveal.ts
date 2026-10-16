/*
 * Failure-safe entrance reveals.
 *
 * Content is only ever pre-hidden under `html.motion-ok`, which is set when
 * IntersectionObserver exists and reduced motion is off. Without JavaScript,
 * without the observer, or with reduced motion, nothing is hidden at all.
 *
 * One shared observer marks `[data-reveal]` elements with `data-revealed`
 * once and never removes it. Safety nets: keyboard focus inside an element
 * reveals it immediately, and printing reveals everything.
 */
import { useEffect, type RefObject } from 'react';

export const MOTION_CLASS = 'motion-ok';
const STAGGER_MS = 90;
const MAX_STAGGER_STEPS = 3;

let io: IntersectionObserver | null = null;

export function reveal(el: Element) {
  if (!el.hasAttribute('data-revealed')) el.setAttribute('data-revealed', '');
  io?.unobserve(el);
}

function revealAll() {
  document.querySelectorAll('[data-reveal]:not([data-revealed])').forEach(reveal);
}

function observer() {
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        // Anything already above the viewport was jumped past (anchor link,
        // fast fling, scroll restore): reveal it at once, never leave it hidden.
        entries
          .filter((e) => !e.isIntersecting && e.boundingClientRect.bottom <= 0)
          .forEach((e) => reveal(e.target));
        // Elements entering together stagger in reading order, capped short.
        const entering = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
        entering.forEach((e, i) => {
          (e.target as HTMLElement).style.setProperty('--reveal-delay', `${Math.min(i, MAX_STAGGER_STEPS) * STAGGER_MS}ms`);
          reveal(e.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0 },
    );
  }
  return io;
}

/** Decide once, at startup, whether entrances may pre-hide content. */
export function initMotion() {
  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => {
    const ok = 'IntersectionObserver' in window && !mq.matches;
    root.classList.toggle(MOTION_CLASS, ok);
    if (!ok) revealAll();
  };
  apply();
  mq.addEventListener('change', apply);
  // Keyboard users never land on invisible content.
  document.addEventListener('focusin', (e) => {
    const host = (e.target as Element | null)?.closest?.('[data-reveal]:not([data-revealed])');
    if (host) reveal(host);
  });
  window.addEventListener('beforeprint', revealAll);
  // A jump (anchor link, fast fling) can carry an element from below the
  // viewport to above it without ever intersecting, so the observer never
  // fires. When scrolling settles, reveal anything that now sits above.
  window.addEventListener('scrollend', revealPassed, { passive: true });
  window.addEventListener('hashchange', () => requestAnimationFrame(revealPassed));
}

function revealPassed() {
  document.querySelectorAll('[data-reveal]:not([data-revealed])').forEach((el) => {
    if (el.getBoundingClientRect().bottom <= 0) reveal(el);
  });
}

/** Observe one element for a once-only entrance. */
export function useReveal(ref: RefObject<Element | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!document.documentElement.classList.contains(MOTION_CLASS) || !('IntersectionObserver' in window)) {
      reveal(el);
      return;
    }
    observer().observe(el);
    return () => io?.unobserve(el);
  }, [ref]);
}
