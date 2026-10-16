// localStorage can be missing or throw (private windows, blocked site data).
// Every read and write goes through here so the UI works without it.
import type { StateStorage } from 'zustand/middleware';

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the value lasts for this page view only */
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Zustand persist adapter that never throws. */
export const safeStorage: StateStorage = {
  getItem: readStored,
  setItem: writeStored,
  removeItem: removeStored,
};
