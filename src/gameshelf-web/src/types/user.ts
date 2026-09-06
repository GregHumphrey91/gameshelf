export type UserRole = 'Reader' | 'Curator';

/** Response of GET /api/me. `role` is null when the account is signed in but not in the Users table. */
export interface CurrentUser {
  subject: string;
  email: string | null;
  role: UserRole | null;
}
