import { getApiBaseUrl } from '@/config';
import type { Game, GameInput } from '@/types/game';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let errors: Record<string, string[]> | undefined;

  try {
    const problem = (await response.json()) as { title?: string; errors?: Record<string, string[]> };
    if (problem.title) message = problem.title;
    errors = problem.errors;
  } catch {
    // Non-JSON body; keep the generic message.
  }

  return new ApiError(response.status, message, errors);
}

export const gamesApi = {
  list: () => request<Game[]>('/api/games'),
  get: (id: number) => request<Game>(`/api/games/${id}`),
  create: (input: GameInput) => request<Game>('/api/games', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: number, input: GameInput) =>
    request<void>(`/api/games/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: number) => request<void>(`/api/games/${id}`, { method: 'DELETE' }),
};
