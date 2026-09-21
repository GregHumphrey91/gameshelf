import { OktaAuth, type AuthState, type OktaAuthOptions } from '@okta/okta-auth-js';
import type { AuthStatus } from '@/auth/session';
import type { AuthConfig } from '@/config';

/** Must be registered with the identity provider as a sign-in redirect URI for every origin the SPA runs on. */
export const LOGIN_CALLBACK_PATH = '/login/callback';

/**
 * Authorization Code + PKCE: no client secret exists anywhere in this application.
 *
 * Never request the "groups" scope. Roles come from the Users table, not the token, and the stock
 * `default` authorization server does not define it — asking for it fails the whole authorize call.
 */
export function oktaOptions(config: AuthConfig, origin: string): OktaAuthOptions {
  return {
    issuer: config.issuer,
    clientId: config.clientId,
    redirectUri: `${origin}${LOGIN_CALLBACK_PATH}`,
    scopes: ['openid', 'profile', 'email'],
    pkce: true,
  };
}

export function createOktaAuth(config: AuthConfig): OktaAuth {
  return new OktaAuth(oktaOptions(config, window.location.origin));
}

export function toSessionState(state: AuthState | null): {
  status: AuthStatus;
  email: string | null;
  name: string | null;
} {
  if (!state) return { status: 'loading', email: null, name: null };
  if (!state.isAuthenticated) return { status: 'signed-out', email: null, name: null };
  const claims = state.idToken?.claims;
  return { status: 'signed-in', email: claims?.email ?? null, name: claims?.name ?? null };
}
