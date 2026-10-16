// Original line glyphs, one per scent family. Hand-built paths, 24px grid.

export const GLYPH_PATHS: Record<string, string> = {
  // Citrus slice
  Fresh: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Zm0 2.5v13M5.5 12h13M7.4 7.4l9.2 9.2M16.6 7.4l-9.2 9.2',
  // Amber drop with a warm halo
  Warm: 'M12 4c3 4 5 6.6 5 9.2a5 5 0 0 1-10 0C7 10.6 9 8 12 4Zm-7.5 2.5l1.6 1.2M19.5 6.5l-1.6 1.2M12 1.5v1.2',
  // Wood rings
  Woody: 'M12 3.5c4.7 0 8.5 3.8 8.5 8.5S16.7 20.5 12 20.5 3.5 16.7 3.5 12 7.3 3.5 12 3.5Zm0 3.5a5 5 0 1 0 0 10a5 5 0 1 0 0-10Zm0 3.2a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0-3.6Z',
  // Two waves
  Aquatic: 'M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0',
  // Fig with stem and leaf
  Sweet: 'M12 7c3.6 0 6 3.4 6 7.2 0 3.6-2.7 6.3-6 6.3s-6-2.7-6-6.3C6 10.4 8.4 7 12 7Zm0 0V4m0 0c1.5-1.4 3.4-1.6 5-1-1 1.6-2.9 2.3-5 1Z',
  // Five-petal blossom
  Floral: 'M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5ZM12 9.5c-1.6-2.6-1-5.5 0-6.5 1 1 1.6 3.9 0 6.5Zm2.4 1.7c2.9-.9 5.4.6 5.9 1.9-1.3.5-4.2.8-5.9-1.9Zm-.9 2.8c1.9 2.4 1.6 5.3.8 6.4-1.2-.8-2.4-3.5-.8-6.4Zm-3 0c-1.6 2.9-.4 5.6-.8 6.4-.8-1.1-1.1-4 .8-6.4Zm-.9-2.8c-1.7 2.7-4.6 2.4-5.9 1.9.5-1.3 3-2.8 5.9-1.9Z',
};

interface NoteGlyphProps {
  family: string;
  size?: number;
  className?: string;
}

export function NoteGlyph({ family, size = 22, className }: NoteGlyphProps) {
  const d = GLYPH_PATHS[family] ?? GLYPH_PATHS.Floral!;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}
