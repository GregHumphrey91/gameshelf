/**
 * Resolution order for the API base URL:
 *  1. window.__GAMESHELF_CONFIG__.apiBaseUrl — written at container start (production images)
 *  2. VITE_API_BASE_URL — baked in at build time (local `npm run dev`)
 *  3. '' — same-origin (useful behind a reverse proxy)
 */
export function getApiBaseUrl(): string {
  const runtime = typeof window !== 'undefined' ? window.__GAMESHELF_CONFIG__?.apiBaseUrl : undefined;
  const value = runtime || import.meta.env.VITE_API_BASE_URL || '';
  return value.replace(/\/+$/, '');
}
