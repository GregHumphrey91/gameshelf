import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { setAccessTokenProvider } from '@/api/token';
import App from '@/App';
import { AuthProvider } from '@/auth/AuthProvider';
import { createOktaAuth } from '@/auth/oktaAuth';
import { getAuthConfig } from '@/config';
import { createQueryClient } from '@/queryClient';
import '@/styles.css';

// One identity-provider client for the whole app, created outside React so nothing about it depends on
// render order or on StrictMode's simulated remount. With no provider configured the app runs in local mode.
const authConfig = getAuthConfig();
const oktaAuth = authConfig ? createOktaAuth(authConfig) : null;

// The access token, not the ID token: the ID token describes the user to this SPA, while the access
// token is the one minted for the API's audience.
if (oktaAuth) setAccessTokenProvider(async () => (await oktaAuth.getOrRenewAccessToken()) ?? null);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <BrowserRouter>
        <AuthProvider oktaAuth={oktaAuth}>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
