import { createContext, useContext, type ReactNode } from 'react';
import type { AuthClient } from '@/auth/authClient';

const AuthClientContext = createContext<AuthClient | null>(null);

export function AuthProvider({ client, children }: { client: AuthClient; children: ReactNode }) {
  return <AuthClientContext.Provider value={client}>{children}</AuthClientContext.Provider>;
}

export function useAuthClient(): AuthClient {
  const client = useContext(AuthClientContext);
  if (!client) throw new Error('useAuthClient must be used inside <AuthProvider>');
  return client;
}
