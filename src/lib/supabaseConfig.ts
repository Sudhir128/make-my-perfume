export interface SupabaseRuntimeConfig {
  projectUrl: string;
  anonKey: string;
  merchantUpiId?: string;
  merchantName?: string;
}

let cachedConfig: SupabaseRuntimeConfig | null = null;
let configPromise: Promise<SupabaseRuntimeConfig> | null = null;

/**
 * Fetches Supabase credentials dynamically at runtime.
 *
 * This ensures that credentials are never hardcoded or visible in the
 * client-side JavaScript script bundle, and do not appear in the static .env file.
 */
export async function getSupabaseConfig(): Promise<SupabaseRuntimeConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!configPromise) {
    const endpoint = import.meta.env.VITE_CONFIG_ENDPOINT || '/api/config';
    configPromise = fetch(endpoint)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch runtime config: ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<SupabaseRuntimeConfig>;
      })
      .then((config) => {
        cachedConfig = config;
        return config;
      })
      .catch((err) => {
        configPromise = null;
        throw err;
      });
  }

  return configPromise;
}

/**
 * Reset config cache (used in testing).
 */
export function resetCachedConfigForTesting(): void {
  cachedConfig = null;
  configPromise = null;
}

