/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONFIG_ENDPOINT?: string;
  /** 'local' forces the bundled demo catalogue; anything else reads Supabase. */
  readonly VITE_CATALOGUE_SOURCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
