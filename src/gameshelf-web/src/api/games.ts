import { request } from '@/api/http';
import type { Game, GameInput } from '@/types/game';

export { ApiError } from '@/api/http';

export const gamesApi = {
  list: () => request<Game[]>('/api/games'),
  get: (id: number) => request<Game>(`/api/games/${id}`),
  create: (input: GameInput) => request<Game>('/api/games', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: number, input: GameInput) =>
    request<void>(`/api/games/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: number) => request<void>(`/api/games/${id}`, { method: 'DELETE' }),
};
