import { create } from 'zustand';

/** Page → scene signals: which family is previewed, which card is centred. */
interface SceneSignals {
  previewFamily: string | null;
  accentFamily: string;
  setPreview: (f: string | null) => void;
  setAccent: (f: string) => void;
}

export const useSceneSignals = create<SceneSignals>()((set) => ({
  previewFamily: null,
  accentFamily: 'Warm',
  setPreview: (previewFamily) => set({ previewFamily }),
  setAccent: (accentFamily) => set({ accentFamily }),
}));
