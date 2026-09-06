import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setAccessTokenProvider } from '@/api/token';
import App from '@/App';
import { AuthProvider, createAuthClient } from '@/auth';
import { getAuthConfig } from '@/config';
import '@/styles.css';

// One auth client for the whole app. With no identity provider configured this is the local-mode client.
const authClient = createAuthClient(getAuthConfig());
setAccessTokenProvider(() => authClient.getAccessToken());
void authClient.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider client={authClient}>
      <App />
    </AuthProvider>
  </StrictMode>,
);
