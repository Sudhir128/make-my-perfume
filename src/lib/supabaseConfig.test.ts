import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getSupabaseConfig, resetCachedConfigForTesting } from './supabaseConfig';

describe('supabaseConfig dynamic runtime loader', () => {
  beforeEach(() => {
    resetCachedConfigForTesting();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetCachedConfigForTesting();
    vi.restoreAllMocks();
  });

  it('fetches credentials dynamically at runtime via HTTP', async () => {
    const mockConfig = {
      projectUrl: 'https://example.supabase.co',
      anonKey: 'example-anon-key',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockConfig,
    });
    vi.stubGlobal('fetch', fetchMock);

    const config = await getSupabaseConfig();
    expect(config).toEqual(mockConfig);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached configuration on subsequent calls without re-fetching', async () => {
    const mockConfig = {
      projectUrl: 'https://example.supabase.co',
      anonKey: 'example-anon-key',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockConfig,
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await getSupabaseConfig();
    const second = await getSupabaseConfig();

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws an error if the runtime config endpoint returns an error status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getSupabaseConfig()).rejects.toThrow('Failed to fetch runtime config: 500');
  });
});

