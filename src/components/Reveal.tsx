import { useRef, type ReactNode } from 'react';
import { useReveal } from '../scroll/reveal';

interface RevealProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'header' | 'section';
}

/**
 * The light entrance: the whole block rises 14px and fades in, once, when it
 * is 12% inside the viewport. Never hides content without html.motion-ok.
 */
export function Reveal({ children, className, as: Tag = 'div' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref);
  return (
    <Tag ref={ref} className={className} data-reveal="rise">
      {children}
    </Tag>
  );
}
