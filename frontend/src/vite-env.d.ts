/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_PORTAL_BASE_URL: string;
  readonly VITE_AUTH_SERVICE_URL: string;
  readonly VITE_CATALOG_SERVICE_URL: string;
  readonly VITE_QUOTATION_SERVICE_URL: string;
  readonly VITE_FULFILLMENT_SERVICE_URL: string;
  readonly VITE_BILLING_SERVICE_URL: string;
  readonly VITE_ANALYTICS_SERVICE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
