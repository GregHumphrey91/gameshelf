/**
 * Resolution order for every setting:
 *  1. window.__GAMESHELF_CONFIG__ — written at container start (production images)
 *  2. VITE_* — baked in at build time (local `npm run dev`, .env.development / .env.local)
 *  3. a default
 */

function runtime() {
  return typeof window !== 'undefined' ? window.__GAMESHELF_CONFIG__ : undefined;
}

/** '' means same-origin (useful behind a reverse proxy). */
export function getApiBaseUrl(): string {
  const value = runtime()?.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || '';
  return value.replace(/\/+$/, '');
}

export interface AuthConfig {
  /** OpenID Connect issuer, e.g. https://your-org.okta.com/oauth2/default */
  issuer: string;
  /** Client id of the Single-Page Application registered with the issuer. */
  clientId: string;
}

/**
 * Null when no identity provider is configured. The app then runs in local mode: no sign-in,
 * no bearer tokens, and the API (with Auth:Enabled=false) treats every request as a local Curator.
 */
export function getAuthConfig(): AuthConfig | null {
  const issuer = runtime()?.oktaIssuer || import.meta.env.VITE_OKTA_ISSUER || '';
  const clientId = runtime()?.oktaClientId || import.meta.env.VITE_OKTA_CLIENT_ID || '';
  return issuer && clientId ? { issuer: issuer.replace(/\/+$/, ''), clientId } : null;
}
