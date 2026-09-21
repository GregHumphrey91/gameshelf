import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export const gamesKey = ['games'] as const;

const NO_GAMES: Game[] = [];

/** Loads the collection once `enabled` is true (i.e. the caller is allowed to read it). */
export function useGames(enabled = true): UseGamesResult {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: gamesKey, queryFn: gamesApi.list, enabled });

  // Every write is followed by a refetch rather than a cache patch: the server owns ordering and
  // addedDate, and the collection is small. The mutation resolves only once the list is fresh.
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: gamesKey });

  const create = useMutation({ mutationFn: (input: GameInput) => gamesApi.create(input), onSuccess });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: GameInput }) => gamesApi.update(id, input),
    onSuccess,
  });
  const remove = useMutation({ mutationFn: (id: number) => gamesApi.remove(id), onSuccess });

  // The most recent failure wins; starting another write clears the previous write's error.
  const failure = [create, update, remove]
    .filter((m) => m.error)
    .sort((a, b) => b.submittedAt - a.submittedAt)[0]?.error;
  const writing = create.isPending || update.isPending || remove.isPending;
  const error = writing ? null : (failure ?? query.error);

  return {
    games: enabled ? (query.data ?? NO_GAMES) : NO_GAMES,
    loading: enabled && query.isPending,
    error: error ? error.message : null,
    refresh: async () => {
      await query.refetch();
    },
    create: async (input) => {
      await create.mutateAsync(input);
    },
    update: async (id, input) => {
      await update.mutateAsync({ id, input });
    },
    remove: async (id) => {
      await remove.mutateAsync(id);
    },
  };
}
