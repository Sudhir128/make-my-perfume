import { describe, expect, it } from 'vitest';
import { BUCKET_NAME, getProductImageUrl, uploadProductImage } from './storage';

describe('Supabase storage', () => {
  it('exposes the configured product-images bucket name', () => {
    expect(BUCKET_NAME).toBe('product-images');
  });

  it('resolves remote http and data URLs directly', async () => {
    const url = 'https://supabase.co/storage/v1/object/public/product-images/test.jpg';
    expect(await getProductImageUrl(url)).toBe(url);
    const dataUrl = 'data:image/png;base64,AAAA';
    expect(await getProductImageUrl(dataUrl)).toBe(dataUrl);
  });

  it('gracefully handles uploading a File in test environment with fallback', async () => {
    const blob = new Blob(['image-content'], { type: 'image/png' });
    const file = new File([blob], 'my-perfume.png', { type: 'image/png' });
    const res = await uploadProductImage(file, 'test-prefix');
    expect(res).toBeDefined();
    expect(res.filename).toBe('my-perfume.png');
    expect(res.url).toMatch(/^(https?:\/\/|data:image\/png)/);
  });
});

