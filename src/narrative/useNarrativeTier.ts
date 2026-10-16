import { useCallback, useEffect, useState } from 'react';
import { chooseTier, detectCapabilities, tierOverride, type TierChoice } from './tier';

const decide = (): TierChoice =>
  typeof window === 'undefined'
    ? { tier: 'still', reasons: ['no-window'] }
    : chooseTier(detectCapabilities(), { override: tierOverride(window.location.search) });

/**
 * The tier is decided synchronously on first render (so the layout never swaps
 * after paint), again when reduced motion or the viewport class changes, and
 * drops to `still` for good if the scene reports a failure.
 */
export function useNarrativeTier(): TierChoice & { fail: (reason: string) => void } {
  const [choice, setChoice] = useState<TierChoice>(decide);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    const again = () => setChoice((prev) => {
      const next = decide();
      return next.tier === prev.tier ? prev : next;
    });
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', again);
    window.addEventListener('resize', again, { passive: true });
    return () => {
      mq.removeEventListener('change', again);
      window.removeEventListener('resize', again);
    };
  }, []);
  const fail = useCallback((reason: string) => setFailed(reason), []);
  if (failed) return { tier: 'still', reasons: [failed], fail };
  return { ...choice, fail };
}
