import { OktaAuth, toRelativeUrl, type AuthState, type OktaAuthOptions } from '@okta/okta-auth-js';
import type { AuthClient, AuthSession } from '@/auth/authClient';
import type { AuthConfig } from '@/config';

/** Must be registered with the identity provider as a sign-in redirect URI for every origin the SPA runs on. */
export const LOGIN_CALLBACK_PATH = '/login/callback';

/** The slice of the SDK this module uses; tests substitute a fake for it. */
export type OktaLike = Pick<
  OktaAuth,
  'isLoginRedirect' | 'handleLoginRedirect' | 'start' | 'authStateManager' | 'getOrRenewAccessToken' | 'signInWithRedirect' | 'signOut'
>;

/** Authorization Code + PKCE: no client secret exists anywhere in this application. */
export function oktaOptions(config: AuthConfig, origin: string): OktaAuthOptions {
  return {
    issuer: config.issuer,
    clientId: config.clientId,
    redirectUri: `${origin}${LOGIN_CALLBACK_PATH}`,
    scopes: ['openid', 'profile', 'email'],
    pkce: true,
    // After the callback, return to where the user was without a full page reload.
    restoreOriginalUri: async (_okta, originalUri) => {
      window.history.replaceState(null, '', toRelativeUrl(originalUri || '/', origin));
    },
  };
}

export function toSession(state: AuthState | null): AuthSession {
  if (!state) return { status: 'loading', email: null, name: null };
  if (!state.isAuthenticated) return { status: 'signed-out', email: null, name: null };
  const claims = state.idToken?.claims;
  return { status: 'signed-in', email: claims?.email ?? null, name: claims?.name ?? null };
}

export function createOktaAuthClient(
  config: AuthConfig,
  okta: OktaLike = new OktaAuth(oktaOptions(config, window.location.origin)),
): AuthClient {
  let session = toSession(null);
  const listeners = new Set<(session: AuthSession) => void>();

  okta.authStateManager.subscribe((state: AuthState) => {
    session = toSession(state);
    listeners.forEach((listener) => listener(session));
  });

  return {
    enabled: true,

    async start() {
      if (okta.isLoginRedirect()) {
        try {
          await okta.handleLoginRedirect();
        } catch (err) {
          // A stale or tampered callback URL. Fall through: the user simply is not signed in.
          console.error('Sign-in callback failed', err);
        }
      }
      await okta.start();
    },

    getSession: () => session,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async getAccessToken() {
      return (await okta.getOrRenewAccessToken()) ?? null;
    },

    signIn: () => okta.signInWithRedirect({ originalUri: window.location.pathname + window.location.search }),

    async signOut() {
      await okta.signOut({ postLogoutRedirectUri: window.location.origin });
    },
  };
}
