/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_OKTA_ISSUER?: string;
  readonly VITE_OKTA_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  /** Written by docker-entrypoint.sh at container start (runtime-config.js). */
  __GAMESHELF_CONFIG__?: {
    apiBaseUrl?: string;
    oktaIssuer?: string;
    oktaClientId?: string;
  };
}
