/**
 * How the API layer obtains a bearer token without depending on React or the identity provider SDK.
 * main.tsx points this at the auth client; tests point it at whatever they need.
 */
export type AccessTokenProvider = () => Promise<string | null>;

let provider: AccessTokenProvider = async () => null;

export function setAccessTokenProvider(next: AccessTokenProvider) {
  provider = next;
}

export function getAccessToken(): Promise<string | null> {
  return provider();
}
