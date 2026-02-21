import type { Gen1 } from '@pkmn/engine';
import { Choice } from '@pkmn/engine';
import type { Player, Result } from '@pkmn/engine';
import type { ModifierFn } from './modifiers.js';

interface TrainerRef {
  modifiers: number[];
}

export function decideAction(
  battle: Gen1.Battle,
  player: Player,
  result: Result,
  modFns: ModifierFn[],
): Choice {
  const priorities = [100, 100, 100, 100];
  let movesAvailable = false;
  const allChoices = battle.choices(player, result);
  const moveChoices: Record<number, Choice> = {};

  if (allChoices.length === 1) return allChoices[0];

  for (const choice of allChoices) {
    if (choice.type === 'move') {
      if (choice.data === 0) return choice; // Struggle
      priorities[choice.data - 1] = 10;
      moveChoices[choice.data - 1] = choice;
      movesAvailable = true;
    }
  }

  if (!movesAvailable) return allChoices[0];

  for (const modFn of modFns) {
    modFn(battle, player, priorities);
  }

  const maxPrio = Math.min(...priorities);
  const candidates = priorities
    .map((p, idx) => ({ p, idx }))
    .filter(({ p, idx }) => p === maxPrio && moveChoices[idx] !== undefined);

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  return moveChoices[chosen.idx];
}

export function advanceBattle(
  battle: Gen1.Battle,
  result: Result,
  trainer1: TrainerRef,
  trainer2: TrainerRef,
  modifierMap: Record<number, ModifierFn>,
): Result {
  const p1Mods = trainer1.modifiers
    .filter(m => modifierMap[m])
    .map(m => modifierMap[m]);
  const p2Mods = trainer2.modifiers
    .filter(m => modifierMap[m])
    .map(m => modifierMap[m]);

  const c1 = decideAction(battle, 'p1', result, p1Mods);
  const c2 = decideAction(battle, 'p2', result, p2Mods);

  return battle.update(c1, c2);
}
