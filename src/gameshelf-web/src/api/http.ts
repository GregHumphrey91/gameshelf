import { getAccessToken } from '@/api/token';
import { getApiBaseUrl } from '@/config';

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

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
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
  let message = defaultMessage(response.status);
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

function defaultMessage(status: number): string {
  switch (status) {
    case 401:
      return 'You need to sign in to do that.';
    case 403:
      return 'Your account is not allowed to do that.';
    default:
      return `Request failed with status ${status}`;
  }
}
