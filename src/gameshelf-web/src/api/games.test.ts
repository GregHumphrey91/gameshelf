import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, gamesApi } from '@/api/games';
import { TEST_API_BASE } from '@/test/api';
import { currentGames, seedGames } from '@/test/handlers';
import { server } from '@/test/server';

describe('gamesApi', () => {
  it('lists games', async () => {
    seedGames([{ title: 'Tetris', platform: 'Game Boy', condition: 'Good', estimatedValue: 15 }]);

    const games = await gamesApi.list();

    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ id: 1, title: 'Tetris', condition: 'Good' });
  });

  it('creates a game and returns the created record', async () => {
    const created = await gamesApi.create({ title: 'Portal', platform: 'PC', condition: 'Mint', estimatedValue: 9.99 });

    expect(created.id).toBe(1);
    expect(created.addedDate).toEqual(expect.any(String));
    expect(currentGames()).toHaveLength(1);
  });

  it('resolves to undefined for 204 responses', async () => {
    seedGames([{ title: 'X', platform: 'Y', condition: 'Fair', estimatedValue: 1 }]);

    await expect(gamesApi.remove(1)).resolves.toBeUndefined();
    expect(currentGames()).toHaveLength(0);
  });

  it('turns a validation problem into an ApiError with field errors', async () => {
    const promise = gamesApi.create({ title: '', platform: 'PC', condition: 'Good', estimatedValue: 0 });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await promise.catch((err: ApiError) => {
      expect(err.status).toBe(400);
      expect(err.message).toBe('One or more validation errors occurred.');
      expect(err.errors).toHaveProperty('Title');
    });
  });

  it('produces a generic message when the error body is not JSON', async () => {
    server.use(http.get(`${TEST_API_BASE}/api/games`, () => new HttpResponse('boom', { status: 502 })));

    await expect(gamesApi.list()).rejects.toMatchObject({ status: 502, message: 'Request failed with status 502' });
  });
});
