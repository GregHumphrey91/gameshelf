export const GAME_CONDITIONS = ['Mint', 'Good', 'Fair', 'Poor'] as const;
export type GameCondition = (typeof GAME_CONDITIONS)[number];

export interface Game {
  id: number;
  title: string;
  platform: string;
  condition: GameCondition;
  estimatedValue: number;
  /** ISO-8601 UTC timestamp from the API. */
  addedDate: string;
}

export interface GameInput {
  title: string;
  platform: string;
  condition: GameCondition;
  estimatedValue: number;
}
