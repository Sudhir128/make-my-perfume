/** Material palettes per scent family: glow, mid, deep. Abstract colour only. */
export const PALETTES: Record<string, [glow: string, mid: string, deep: string]> = {
  Fresh: ['#FBF4D6', '#C9CF9A', '#6F8B7E'],
  Warm: ['#FFE3A8', '#D9963F', '#5A2E14'],
  Woody: ['#E3C9A0', '#8C6A4B', '#241A13'],
  Aquatic: ['#EEF6F6', '#8FA9B3', '#2F4856'],
  Sweet: ['#F6E1D0', '#B98576', '#4D2E32'],
  Floral: ['#FFF0E6', '#DDA894', '#7E4C46'],
};

export const paletteFor = (family: string) => PALETTES[family] ?? PALETTES.Warm!;
