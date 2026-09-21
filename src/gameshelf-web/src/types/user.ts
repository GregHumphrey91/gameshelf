import type { components } from '@/types/generated/api';

export type UserRole = components['schemas']['UserRole'];

/** Response of GET /api/me. `role` is null when the account is signed in but not in the Users table. */
export type CurrentUser = components['schemas']['CurrentUserDto'];
