import { describe, expect, it } from 'vitest';
import { createDisabledAuthClient } from '@/auth/authClient';
import { createAuthClient } from '@/auth';

describe('createDisabledAuthClient', () => {
  it('is always signed in and never produces a token', async () => {
    const client = createDisabledAuthClient();

    expect(client.enabled).toBe(false);
    expect(client.getSession()).toEqual({ status: 'signed-in', email: null, name: null });
    await expect(client.getAccessToken()).resolves.toBeNull();
    await expect(client.start()).resolves.toBeUndefined();
    await expect(client.signIn()).resolves.toBeUndefined();
    await expect(client.signOut()).resolves.toBeUndefined();
    expect(client.subscribe(() => {})).toBeTypeOf('function');
  });
});

describe('createAuthClient', () => {
  it('picks local mode when there is no configuration', () => {
    expect(createAuthClient(null).enabled).toBe(false);
  });

  it('picks the identity-provider client when configured', () => {
    expect(createAuthClient({ issuer: 'https://idp.example/oauth2/default', clientId: 'client-123' }).enabled).toBe(true);
  });
});
