import { request } from '@/api/http';
import type { CurrentUser } from '@/types/user';

export const meApi = {
  get: () => request<CurrentUser>('/api/me'),
};
