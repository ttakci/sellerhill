/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** 'sandbox' | 'production' — must match the API's EBAY_ENVIRONMENT. */
  readonly VITE_EBAY_ENVIRONMENT?: string;
  // Add other VITE_* env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
