import { useCallback, useEffect, useState } from 'react';
import { gamesApi } from '@/api/games';
import type { Game, GameInput } from '@/types/game';

export interface UseGamesResult {
  games: Game[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: GameInput) => Promise<void>;
  update: (id: number, input: GameInput) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

/** Loads the collection once `enabled` is true (i.e. the caller is allowed to read it). */
export function useGames(enabled = true): UseGamesResult {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGames(await gamesApi.list());
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void refresh();
    } else {
      setGames([]);
      setLoading(false);
    }
  }, [enabled, refresh]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setError(null);
      try {
        await action();
        await refresh();
      } catch (err) {
        setError(describe(err));
        throw err;
      }
    },
    [refresh],
  );

  return {
    games,
    loading,
    error,
    refresh,
    create: (input) => run(() => gamesApi.create(input)),
    update: (id, input) => run(() => gamesApi.update(id, input)),
    remove: (id) => run(() => gamesApi.remove(id)),
  };
}
