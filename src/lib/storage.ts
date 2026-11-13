/*
 * Storage utilities:
 * 1. Safe localStorage adapter for Zustand stores (bag, profile, orders).
 * 2. Supabase Storage client integration for product images in bucket 'product-images'.
 */
import type { StateStorage } from 'zustand/middleware';
import { getSupabase } from './supabase';

// ── 1. LocalStorage Safe Adapter ────────────────────────────────────────────
// localStorage can be missing or throw (private windows, blocked site data).
// Every read and write goes through here so the UI works without it.

export function readStored(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  } catch {
    /* storage unavailable: the value lasts for this page view only */
  }
}

export function removeStored(key: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
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

// ── 2. Supabase Image Bucket Storage ────────────────────────────────────────
export const BUCKET_NAME = 'product-images';

export interface StorageUploadResult {
  url: string;
  path: string;
  filename: string;
}

/**
 * Uploads a perfume image file to the Supabase `product-images` storage bucket.
 * Falls back to an offline Data URL in non-connected or testing environments.
 */
export async function uploadProductImage(
  file: File,
  prefix = 'perfumes',
): Promise<StorageUploadResult> {
  const sanitizedName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '-')
    .replace(/-+/g, '-');
  const path = `${prefix}/${Date.now()}-${sanitizedName}`;

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });

    if (error) {
      console.warn('Supabase storage upload returned error, using local data fallback:', error.message);
      return readAsDataUrl(file, path);
    }

    const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);
    return {
      url: publicData.publicUrl,
      path: data.path,
      filename: file.name,
    };
  } catch (err) {
    if (import.meta.env?.MODE !== 'test') {
      console.warn('Storage upload network failure, using local data fallback:', err instanceof Error ? err.message : err);
    }
    return readAsDataUrl(file, path);
  }
}

/**
 * Resolves the public URL for an image stored in the product-images bucket.
 */
export async function getProductImageUrl(path: string): Promise<string> {
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  try {
    const supabase = await getSupabase();
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return path;
  }
}

/**
 * Fallback to read file as base64 data url when offline or testing without network.
 */
async function readAsDataUrl(file: File, fallbackPath: string): Promise<StorageUploadResult> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          url: reader.result as string,
          path: fallbackPath,
          filename: file.name,
        });
      };
      reader.onerror = () => {
        resolve({
          url: '',
          path: fallbackPath,
          filename: file.name,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Node environment / testing fallback
  try {
    const arrayBuffer = await file.arrayBuffer();
    const nodeBuf = (globalThis as Record<string, unknown>).Buffer as
      | { from: (b: ArrayBuffer) => { toString: (enc: string) => string } }
      | undefined;
    const base64 = nodeBuf
      ? nodeBuf.from(arrayBuffer).toString('base64')
      : typeof btoa === 'function'
        ? btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        : '';
    return {
      url: `data:${file.type || 'image/png'};base64,${base64}`,
      path: fallbackPath,
      filename: file.name,
    };
  } catch {
    return {
      url: '',
      path: fallbackPath,
      filename: file.name,
    };
  }
}
