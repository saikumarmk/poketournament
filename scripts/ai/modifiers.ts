import type { Gen1 } from '@pkmn/engine';
import type { Player } from '@pkmn/engine';

interface MoveInfo {
  power: number;
  type: string;
  accuracy: number;
}

export const typeEffectivenessChart: Record<string, number> = {
  'Water,Fire': 2.0, 'Fire,Grass': 2.0, 'Fire,Ice': 2.0, 'Grass,Water': 2.0,
  'Electric,Water': 2.0, 'Water,Rock': 2.0, 'Ground,Flying': 0.0,
  'Water,Water': 0.5, 'Fire,Fire': 0.5, 'Electric,Electric': 0.5,
  'Ice,Ice': 0.5, 'Grass,Grass': 0.5, 'Psychic,Psychic': 0.5,
  'Fire,Water': 0.5, 'Grass,Fire': 0.5, 'Water,Grass': 0.5,
  'Electric,Grass': 0.5, 'Normal,Rock': 0.5, 'Normal,Ghost': 0.0,
  'Ghost,Ghost': 2.0, 'Fire,Bug': 2.0, 'Fire,Rock': 0.5,
  'Water,Ground': 2.0, 'Electric,Ground': 0.0, 'Electric,Flying': 2.0,
  'Grass,Ground': 2.0, 'Grass,Bug': 0.5, 'Grass,Poison': 0.5,
  'Grass,Rock': 2.0, 'Grass,Flying': 0.5, 'Ice,Water': 0.5,
  'Ice,Grass': 2.0, 'Ice,Ground': 2.0, 'Ice,Flying': 2.0,
  'Fighting,Normal': 2.0, 'Fighting,Poison': 0.5, 'Fighting,Flying': 0.5,
  'Fighting,Psychic': 0.5, 'Fighting,Bug': 0.5, 'Fighting,Rock': 2.0,
  'Fighting,Ice': 2.0, 'Fighting,Ghost': 0.0, 'Poison,Grass': 2.0,
  'Poison,Poison': 0.5, 'Poison,Ground': 0.5, 'Poison,Bug': 2.0,
  'Poison,Rock': 0.5, 'Poison,Ghost': 0.5, 'Ground,Fire': 2.0,
  'Ground,Electric': 2.0, 'Ground,Grass': 0.5, 'Ground,Bug': 0.5,
  'Ground,Rock': 2.0, 'Ground,Poison': 2.0, 'Flying,Electric': 0.5,
  'Flying,Fighting': 2.0, 'Flying,Bug': 2.0, 'Flying,Grass': 2.0,
  'Flying,Rock': 0.5, 'Psychic,Fighting': 2.0, 'Psychic,Poison': 2.0,
  'Bug,Fire': 0.5, 'Bug,Grass': 2.0, 'Bug,Fighting': 0.5,
  'Bug,Flying': 0.5, 'Bug,Psychic': 2.0, 'Bug,Ghost': 0.5,
  'Bug,Poison': 2.0, 'Rock,Fire': 2.0, 'Rock,Fighting': 0.5,
  'Rock,Ground': 0.5, 'Rock,Flying': 2.0, 'Rock,Bug': 2.0,
  'Rock,Ice': 2.0, 'Ghost,Normal': 0.0, 'Ghost,Psychic': 0.0,
  'Fire,Dragon': 0.5, 'Water,Dragon': 0.5, 'Electric,Dragon': 0.5,
  'Grass,Dragon': 0.5, 'Ice,Dragon': 2.0, 'Dragon,Dragon': 2.0,
};

const NON_DAMAGE_STATUS_MOVES = new Set([
  'Thunder Wave', 'Glare', 'Stun Spore', 'Toxic', 'Poison Powder',
  'Poison Gas', 'Spore', 'Sleep Powder', 'Sing', 'Hypnosis', 'Lovely Kiss',
]);

const BUFF_STATUS_MOVES = new Set([
  'Meditate', 'Sharpen', 'Defense Curl', 'Harden', 'Withdraw', 'Growth',
  'Double Team', 'Minimize', 'Pay Day', 'Swift', 'Growl', 'Leer',
  'Tail Whip', 'String Shot', 'Flash', 'Kinesis', 'Sand Attack',
  'Smokescreen', 'Conversion', 'Haze', 'Swords Dance', 'Acid Armor',
  'Barrier', 'Agility', 'Amnesia', 'Recover', 'Rest', 'Softboiled',
  'Transform', 'Screech', 'Light Screen', 'Reflect',
]);

const BETTER_MOVES = new Set([
  'Super Fang', 'Dragon Rage', 'Psywave', 'Night Shade',
  'Seismic Toss', 'Sonic Boom', 'Fly',
]);

function getMoveNames(battle: Gen1.Battle, player: Player): string[] {
  const side = battle.side(player);
  const active = side.active;
  if (!active) return [];
  const moveNames: string[] = [];
  for (const slot of active.moves) {
    moveNames.push(slot.id);
  }
  return moveNames;
}

function getOpponentStatus(battle: Gen1.Battle, player: Player): string | undefined {
  const opponent = player === 'p1' ? 'p2' : 'p1';
  return battle.side(opponent).active?.status;
}

function getOpponentType(battle: Gen1.Battle, player: Player): string {
  const opponent = player === 'p1' ? 'p2' : 'p1';
  const active = battle.side(opponent).active;
  if (!active) return 'Normal';
  return active.types[0];
}

export type ModifierFn = (
  battle: Gen1.Battle,
  player: Player,
  priorities: number[],
) => void;

/**
 * Mod1: Penalise non-damaging status moves if opponent is already statused.
 */
export function mod1(
  battle: Gen1.Battle,
  player: Player,
  priorities: number[],
): void {
  const oppStatus = getOpponentStatus(battle, player);
  if (oppStatus) {
    const moveNames = getMoveNames(battle, player);
    for (let i = 0; i < moveNames.length; i++) {
      const moveName = gen1IdToName(moveNames[i]);
      if (NON_DAMAGE_STATUS_MOVES.has(moveName)) {
        priorities[i] += 5;
      }
    }
  }
}

/**
 * Mod2: On turn 2, prefer buff/status moves (buggy off-by-one from the game).
 */
export function mod2(
  battle: Gen1.Battle,
  player: Player,
  priorities: number[],
): void {
  if (battle.turn === 2) {
    const moveNames = getMoveNames(battle, player);
    for (let i = 0; i < moveNames.length; i++) {
      const moveName = gen1IdToName(moveNames[i]);
      if (BUFF_STATUS_MOVES.has(moveName)) {
        priorities[i] -= 1;
      }
    }
  }
}

/**
 * Mod3: Favour super-effective moves, penalise not-very-effective if better moves exist.
 */
export function mod3(
  battle: Gen1.Battle,
  player: Player,
  priorities: number[],
  movesData: Record<string, MoveInfo>,
): void {
  const moveNames = getMoveNames(battle, player);
  const betterMoveFound = moveNames.some(id => BETTER_MOVES.has(gen1IdToName(id)));
  const defenderType = getOpponentType(battle, player);

  for (let i = 0; i < moveNames.length; i++) {
    const moveName = gen1IdToName(moveNames[i]);
    const moveInfo = movesData[moveName];
    if (!moveInfo) continue;

    const key = `${moveInfo.type},${defenderType}`;
    const effectiveness = typeEffectivenessChart[key] ?? 1.0;

    if (effectiveness > 1.0) {
      priorities[i] -= 1;
    } else if (effectiveness < 1.0 && betterMoveFound) {
      priorities[i] += 1;
    }
  }
}

// @pkmn IDs are lowercased, no spaces/punctuation — map back to display names
const ID_TO_NAME_CACHE = new Map<string, string>();

import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';

const _gens = new Generations(Dex);
const _gen = _gens.get(1);

for (const move of _gen.moves) {
  ID_TO_NAME_CACHE.set(move.id, move.name);
}

function gen1IdToName(id: string): string {
  return ID_TO_NAME_CACHE.get(id) ?? id;
}

export const modifierMap: Record<number, (
  battle: Gen1.Battle,
  player: Player,
  priorities: number[],
) => void> = {};

export function buildModifierMap(movesData: Record<string, MoveInfo>) {
  modifierMap[1] = mod1;
  modifierMap[2] = mod2;
  modifierMap[3] = (battle, player, priorities) => mod3(battle, player, priorities, movesData);
}
