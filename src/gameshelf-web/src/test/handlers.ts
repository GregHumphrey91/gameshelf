import { http, HttpResponse } from 'msw';
import { TEST_API_BASE } from '@/test/api';
import type { Game, GameInput } from '@/types/game';
import type { CurrentUser } from '@/types/user';

const GAMES_URL = `${TEST_API_BASE}/api/games`;
const ME_URL = `${TEST_API_BASE}/api/me`;

let games: Game[] = [];
let nextId = 1;

/** Mirrors what the API reports in local mode (Auth:Enabled=false). */
export const LOCAL_USER: CurrentUser = { subject: 'local-dev', email: 'local-dev@gameshelf.local', role: 'Curator' };

let currentUser: CurrentUser = LOCAL_USER;

/** Decide who GET /api/me says the caller is. Reset after each test. */
export function setCurrentUser(user: Partial<CurrentUser>) {
  currentUser = { ...LOCAL_USER, ...user };
}

export function resetCurrentUser() {
  currentUser = LOCAL_USER;
}

/** Replace the in-memory store. Call from a test to seed data; the store is cleared after each test. */
export function seedGames(seed: Omit<Game, 'id' | 'addedDate'>[] | Game[]) {
  games = seed.map((g, i) => ({
    id: 'id' in g ? g.id : i + 1,
    addedDate: 'addedDate' in g ? g.addedDate : new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
    ...g,
  }));
  nextId = games.reduce((max, g) => Math.max(max, g.id), 0) + 1;
}

export function resetGames() {
  games = [];
  nextId = 1;
}

export function currentGames(): Game[] {
  return [...games];
}

function validationProblem(errors: Record<string, string[]>) {
  return HttpResponse.json(
    { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1', title: 'One or more validation errors occurred.', status: 400, errors },
    { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function validate(input: GameInput) {
  const errors: Record<string, string[]> = {};
  if (!input.title?.trim()) errors.Title = ['The Title field is required.'];
  if (!input.platform?.trim()) errors.Platform = ['The Platform field is required.'];
  return Object.keys(errors).length ? errors : null;
}

export const handlers = [
  http.get(ME_URL, () => HttpResponse.json(currentUser)),

  http.get(GAMES_URL, () =>
    HttpResponse.json([...games].sort((a, b) => b.addedDate.localeCompare(a.addedDate) || b.id - a.id)),
  ),

  http.get(`${GAMES_URL}/:id`, ({ params }) => {
    const game = games.find((g) => g.id === Number(params.id));
    return game ? HttpResponse.json(game) : new HttpResponse(null, { status: 404 });
  }),

  http.post(GAMES_URL, async ({ request }) => {
    const input = (await request.json()) as GameInput;
    const errors = validate(input);
    if (errors) return validationProblem(errors);

    const game: Game = { id: nextId++, addedDate: new Date().toISOString(), ...input };
    games.push(game);
    return HttpResponse.json(game, { status: 201, headers: { Location: `/api/games/${game.id}` } });
  }),

  http.put(`${GAMES_URL}/:id`, async ({ params, request }) => {
    const input = (await request.json()) as GameInput;
    const errors = validate(input);
    if (errors) return validationProblem(errors);

    const index = games.findIndex((g) => g.id === Number(params.id));
    if (index === -1) return new HttpResponse(null, { status: 404 });

    games[index] = { ...games[index], ...input };
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${GAMES_URL}/:id`, ({ params }) => {
    const before = games.length;
    games = games.filter((g) => g.id !== Number(params.id));
    return new HttpResponse(null, { status: games.length < before ? 204 : 404 });
  }),
];
