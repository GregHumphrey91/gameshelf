import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { createOktaAuth } from '@/auth/oktaAuth';
import { useAuth } from '@/hooks/useAuth';

function Probe() {
  const auth = useAuth();
  return (
    <>
      <span data-testid="enabled">{String(auth.enabled)}</span>
      <span data-testid="status">{auth.status}</span>
      <button type="button" onClick={() => void auth.signIn()}>
        sign in
      </button>
      <button type="button" onClick={() => void auth.signOut()}>
        sign out
      </button>
    </>
  );
}

// StrictMode on purpose: development double-mounts every component, and the session has to survive that.
function renderProvider(oktaAuth: ReturnType<typeof createOktaAuth> | null) {
  return render(
    <StrictMode>
      <MemoryRouter>
        <AuthProvider oktaAuth={oktaAuth}>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    </StrictMode>,
  );
}

describe('AuthProvider', () => {
  it('runs in local mode without an identity provider', () => {
    renderProvider(null);

    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
    expect(screen.getByTestId('status')).toHaveTextContent('signed-in');
  });

  it('reports signed-out once the SDK finds no tokens, and starts the redirect on sign-in', async () => {
    // A real client against an issuer that is never contacted: with no stored tokens the SDK
    // settles on "unauthenticated" without touching the network.
    const oktaAuth = createOktaAuth({ issuer: 'https://idp.test/oauth2/default', clientId: 'spa-client' });
    const signIn = vi.spyOn(oktaAuth, 'signInWithRedirect').mockResolvedValue();
    const signOut = vi.spyOn(oktaAuth, 'signOut').mockResolvedValue(true);

    renderProvider(oktaAuth);

    expect(screen.getByTestId('enabled')).toHaveTextContent('true');
    expect(await screen.findByText('signed-out')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'sign in' }));
    expect(signIn).toHaveBeenCalledWith({ originalUri: '/' });

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }));
    expect(signOut).toHaveBeenCalledWith({ postLogoutRedirectUri: window.location.origin });
  });
});
