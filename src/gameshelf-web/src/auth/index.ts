import { createDisabledAuthClient, type AuthClient } from '@/auth/authClient';
import { createOktaAuthClient } from '@/auth/oktaAuthClient';
import type { AuthConfig } from '@/config';

export function createAuthClient(config: AuthConfig | null): AuthClient {
  return config ? createOktaAuthClient(config) : createDisabledAuthClient();
}

export { AuthProvider, useAuthClient } from '@/auth/AuthContext';
export type { AuthClient, AuthSession, AuthStatus } from '@/auth/authClient';
