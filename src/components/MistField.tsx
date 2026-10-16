import styles from './MistField.module.css';

// A static cone of mist leaving the atomizer toward the left (stage 4, Still
// tier). Deterministic positions so screenshots are stable. Decorative only.
// Seeded generator: organic spread, identical on every render and screenshot.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(7);

// The cone opens from the nozzle (right edge, mid-height) to the left.
const DOTS = Array.from({ length: 90 }, () => {
  const along = Math.sqrt(rand() * 0.94 + 0.06); // denser toward the far end
  const side = (rand() + rand()) - 1; // -1..1, concentrated near the axis
  return {
    x: 100 - along * 98,
    y: 25 + side * along * 21,
    r: 0.4 + along * 1.3 + rand() * 0.5,
    o: 0.6 - along * 0.42,
  };
});

export function MistField({ className }: { className?: string }) {
  return (
    <svg className={[styles.mist, className].filter(Boolean).join(' ')} viewBox="0 0 100 50" aria-hidden="true" focusable="false">
      {DOTS.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} opacity={d.o} />
      ))}
    </svg>
  );
}
