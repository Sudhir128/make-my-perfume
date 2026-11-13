import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig, type SupabaseRuntimeConfig } from './supabaseConfig';

let clientPromise: Promise<SupabaseClient> | null = null;
let customerClientPromise: Promise<SupabaseClient> | null = null;
let adminClientPromise: Promise<SupabaseClient> | null = null;

/** Throws a clear error when the runtime config is missing or incomplete. */
export function assertConfig(config: SupabaseRuntimeConfig): SupabaseRuntimeConfig {
  const missing = (['projectUrl', 'anonKey'] as const).filter((k) => !config[k]);
  if (missing.length) {
    throw new Error(`Supabase is not configured: missing ${missing.join(' and ')}. Set SUPABASE_PROJECT_URL and SUPABASE_ANON_KEY.`);
  }
  return config;
}

/**
 * The shared public storefront Supabase client (anonymous role).
 */
export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = Promise.all([getSupabaseConfig().then(assertConfig), import('@supabase/supabase-js')])
      .then(([config, { createClient }]) =>
        createClient(config.projectUrl, config.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        }),
      )
      .catch((err) => {
        clientPromise = null;
        throw err;
      });
  }
  return clientPromise;
}

/**
 * Authenticated Supabase client for storefront customers (sign-up, login,
 * checkout, and order history), isolated from /admin sessions.
 */
export function getCustomerSupabase(): Promise<SupabaseClient> {
  if (!customerClientPromise) {
    customerClientPromise = Promise.all([getSupabaseConfig().then(assertConfig), import('@supabase/supabase-js')])
      .then(([config, { createClient }]) =>
        createClient(config.projectUrl, config.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'mmp.customer.auth.v1',
          },
        }),
      )
      .catch((err) => {
        customerClientPromise = null;
        throw err;
      });
  }
  return customerClientPromise;
}

/**
 * Authenticated Supabase client for the /admin portal, keeping session tokens
 * isolated under its own storage key.
 */
export function getAdminSupabase(): Promise<SupabaseClient> {
  if (!adminClientPromise) {
    adminClientPromise = Promise.all([getSupabaseConfig().then(assertConfig), import('@supabase/supabase-js')])
      .then(([config, { createClient }]) =>
        createClient(config.projectUrl, config.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'mmp.admin.auth.v1',
          },
        }),
      )
      .catch((err) => {
        adminClientPromise = null;
        throw err;
      });
  }
  return adminClientPromise;
}

export type ConnectionStatus =
  | { ok: true; latencyMs: number }
  | { ok: false; reason: 'not-configured' | 'rejected-key' | 'unreachable'; detail: string };

/**
 * Read-only check that the project is reachable and accepts the key: the
 * public auth settings endpoint answers 200 only for a valid key. Sends no
 * user data and writes nothing.
 */
export async function checkSupabaseConnection(fetchImpl: typeof fetch = fetch): Promise<ConnectionStatus> {
  let config: SupabaseRuntimeConfig;
  try {
    config = assertConfig(await getSupabaseConfig());
  } catch (err) {
    return { ok: false, reason: 'not-configured', detail: err instanceof Error ? err.message : String(err) };
  }
  const started = performance.now();
  try {
    const res = await fetchImpl(`${config.projectUrl.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: config.anonKey },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'rejected-key', detail: `Supabase answered ${res.status}: the anon key was not accepted.` };
    }
    if (!res.ok) return { ok: false, reason: 'unreachable', detail: `Supabase answered ${res.status} ${res.statusText}` };
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    return { ok: false, reason: 'unreachable', detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Reset the cached client (used in testing). */
export function resetSupabaseForTesting(): void {
  clientPromise = null;
}
