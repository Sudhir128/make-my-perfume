/*
 * One shared scroll scheduler for every scroll-linked effect on the page.
 * - A single passive window `scroll` + `resize` listener, attached only while
 *   at least one subscriber exists.
 * - Updates are coalesced into one requestAnimationFrame per scroll burst;
 *   there is no idle loop.
 * - Each subscriber runs only while its element is near the viewport
 *   (one shared IntersectionObserver).
 * Native scrolling is never intercepted.
 */

type Update = () => void;

interface Sub {
  el: Element;
  update: Update;
  near: boolean;
}

const subs = new Set<Sub>();
const byEl = new Map<Element, Sub>();
let frame = 0;
let listening = false;
let io: IntersectionObserver | null = null;

function flush() {
  frame = 0;
  for (const s of subs) if (s.near) s.update();
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(flush);
}

function observer() {
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const s = byEl.get(e.target);
          if (!s) continue;
          s.near = e.isIntersecting;
          if (s.near) s.update();
        }
      },
      { rootMargin: '25% 0px 25% 0px' },
    );
  }
  return io;
}

/** Subscribe an element's scroll-linked update. Returns an unsubscribe function. */
export function subscribeScroll(el: Element, update: Update): () => void {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return () => {};
  const sub: Sub = { el, update, near: false };
  subs.add(sub);
  byEl.set(el, sub);
  observer().observe(el);
  if (!listening) {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    listening = true;
  }
  update();
  return () => {
    subs.delete(sub);
    byEl.delete(el);
    io?.unobserve(el);
    if (subs.size === 0 && listening) {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      listening = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}
