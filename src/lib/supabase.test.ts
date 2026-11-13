import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCachedConfigForTesting } from './supabaseConfig';
import { assertConfig, checkSupabaseConnection, resetSupabaseForTesting } from './supabase';

const CONFIG = { projectUrl: 'https://example.supabase.co/', anonKey: 'anon-key' };

function mockConfigFetch(config: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Server Error', json: async () => config }));
}

beforeEach(() => {
  resetCachedConfigForTesting();
  resetSupabaseForTesting();
});
afterEach(() => vi.unstubAllGlobals());

describe('supabase connection', () => {
  it('rejects an incomplete config with a message naming what is missing', () => {
    expect(() => assertConfig({ projectUrl: '', anonKey: '' })).toThrow('missing projectUrl and anonKey');
    expect(() => assertConfig({ projectUrl: 'https://x.supabase.co', anonKey: '' })).toThrow('missing anonKey');
    expect(assertConfig(CONFIG)).toEqual(CONFIG);
  });

  it('reports not-configured when the runtime config is empty', async () => {
    mockConfigFetch({ projectUrl: '', anonKey: '' });
    const status = await checkSupabaseConnection(vi.fn());
    expect(status).toMatchObject({ ok: false, reason: 'not-configured' });
  });

  it('reports ok when the auth settings endpoint accepts the key, sending only the apikey header', async () => {
    mockConfigFetch(CONFIG);
    const probe = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    const status = await checkSupabaseConnection(probe);
    expect(status.ok).toBe(true);
    expect(probe).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/settings', { headers: { apikey: 'anon-key' } });
  });

  it('reports rejected-key on 401 and unreachable on network failure or server error', async () => {
    mockConfigFetch(CONFIG);
    expect(await checkSupabaseConnection(vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' }))).toMatchObject({ ok: false, reason: 'rejected-key' });
    resetCachedConfigForTesting();
    expect(await checkSupabaseConnection(vi.fn().mockRejectedValue(new Error('offline')))).toMatchObject({ ok: false, reason: 'unreachable', detail: 'offline' });
    resetCachedConfigForTesting();
    expect(await checkSupabaseConnection(vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' }))).toMatchObject({ ok: false, reason: 'unreachable' });
  });
});
