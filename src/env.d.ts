/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_BASE_PATH?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_FEATURE_GAMES?: string;
  readonly PUBLIC_FEATURE_PROGRESSION?: string;
  readonly PUBLIC_FEATURE_SHOP?: string;
  readonly PUBLIC_FEATURE_FEEDBACK?: string;
  readonly PUBLIC_FEATURE_CHAT?: string;
  readonly PUBLIC_FEATURE_ADMIN?: string;
  readonly PUBLIC_FEATURE_DONATIONS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
