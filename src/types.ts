export interface PokemonData {
  species: string;
  level: number;
  moves: string[];
  item?: string | null;
}

export interface RankedTrainer {
  name: string;
  location: string;
  id: string;
  elo: number;
  win: number;
  loss: number;
  draw: number;
  bestWin: { id: string; elo: number } | null;
  worstLoss: { id: string; elo: number } | null;
  pokemon: PokemonData[];
  modifiers?: number[];
  trainerClass?: string;
  aiFlags?: string[];
  switchFlag?: string | null;
  trainerItems?: [string | null, string | null];
  itemUseFlag?: string | null;
}

export type TournamentMode = '' | '-lv50';
export type Generation = 1 | 2;
