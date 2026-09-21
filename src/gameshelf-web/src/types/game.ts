import type { components } from '@/types/generated/api';

// Aliases over the types generated from infra/openapi.json (`npm run generate:types`), so the rest
// of the app imports domain names and cannot drift from the API contract.

export type GameCondition = components['schemas']['GameCondition'];

/** Response of GET /api/games. `addedDate` is an ISO-8601 UTC timestamp. */
export type Game = components['schemas']['GameDto'];

export type GameInput = components['schemas']['GameWriteRequest'];

/** Display order for the condition picker. The second line fails to compile if the API gains a condition. */
export const GAME_CONDITIONS = ['Mint', 'Good', 'Fair', 'Poor'] as const satisfies readonly GameCondition[];
export type _AllConditionsListed =
  Exclude<GameCondition, (typeof GAME_CONDITIONS)[number]> extends never ? true : never;
