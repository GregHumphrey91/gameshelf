import { useCallback, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Security, useOktaAuth } from '@okta/okta-react';
import { toRelativeUrl, type OktaAuth } from '@okta/okta-auth-js';
import { toSessionState } from '@/auth/oktaAuth';
import { AuthSessionContext, LOCAL_SESSION, type AuthSession } from '@/auth/session';

/**
 * Supplies the sign-in session to the app.
 *
 * With an OktaAuth instance it wraps the tree in okta-react's <Security>; without one (no identity
 * provider configured) the app runs in local mode. Must sit inside the router: after the redirect
 * round trip the user is sent back to where they were with `navigate`, not a page reload.
 */
export function AuthProvider({ oktaAuth, children }: { oktaAuth: OktaAuth | null; children: ReactNode }) {
  if (!oktaAuth) {
    return <AuthSessionContext.Provider value={LOCAL_SESSION}>{children}</AuthSessionContext.Provider>;
  }
  return <OktaAuthProvider oktaAuth={oktaAuth}>{children}</OktaAuthProvider>;
}

function OktaAuthProvider({ oktaAuth, children }: { oktaAuth: OktaAuth; children: ReactNode }) {
  const navigate = useNavigate();

  const restoreOriginalUri = useCallback(
    async (_oktaAuth: OktaAuth, originalUri?: string) => {
      navigate(toRelativeUrl(originalUri || '/', window.location.origin), { replace: true });
    },
    [navigate],
  );

  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
      <OktaSessionBridge>{children}</OktaSessionBridge>
    </Security>
  );
}

/** Translates okta-react's auth state into the app's own AuthSession, so nothing below imports the SDK. */
function OktaSessionBridge({ children }: { children: ReactNode }) {
  const { oktaAuth, authState } = useOktaAuth();

  const session = useMemo<AuthSession>(
    () => ({
      enabled: true,
      ...toSessionState(authState),
      signIn: async () => {
        await oktaAuth.signInWithRedirect({ originalUri: window.location.pathname + window.location.search });
      },
      signOut: async () => {
        await oktaAuth.signOut({ postLogoutRedirectUri: window.location.origin });
      },
    }),
    [oktaAuth, authState],
  );

  return <AuthSessionContext.Provider value={session}>{children}</AuthSessionContext.Provider>;
}
