/**
 * Gen 3 AI switching logic — ported from pokeemerald/src/battle_ai_switch_items.c
 *
 * Entry points:
 * - shouldSwitch: Full ShouldSwitch → GetMostSuitableMonToSwitchInto pipeline
 * - getMostSuitableMonToSwitchInto: Best replacement for forced switches
 *
 * All battles are singles — double-battle branches from the C source are omitted.
 */
import type { Battle, Pokemon, Side } from '@pkmn/sim';

// ── Type effectiveness helpers ───────────────────────────────────────
// damageTaken: 0 = normal, 1 = super effective, 2 = not very effective, 3 = immune

function typeEffectiveness(battle: Battle, moveType: string, defender: Pokemon): number {
  let mod = 1;
  for (const defType of defender.types) {
    const typeData = battle.dex.types.get(defType);
    if (!typeData) continue;
    const dt = (typeData as any).damageTaken?.[moveType];
    if (dt === 3) return 0;
    if (dt === 1) mod *= 2;
    if (dt === 2) mod *= 0.5;
  }
  return mod;
}

function typeEffectivenessRaw(
  battle: Battle, atkType: string, defTypes: readonly string[],
): number {
  let mod = 1;
  for (const defType of defTypes) {
    const typeData = battle.dex.types.get(defType);
    if (!typeData) continue;
    const dt = (typeData as any).damageTaken?.[atkType];
    if (dt === 3) return 0;
    if (dt === 1) mod *= 2;
    if (dt === 2) mod *= 0.5;
  }
  return mod;
}

// ── Bench mon utilities ──────────────────────────────────────────────

function getEligibleBench(aiSide: Side, aiMon: Pokemon): Pokemon[] {
  return aiSide.pokemon.filter(
    p => p !== aiMon && !p.fainted && p.hp > 0,
  );
}

function slotOf(side: Side, mon: Pokemon): number {
  return side.pokemon.indexOf(mon) + 1;
}

// ── ShouldSwitchIfPerishSong ─────────────────────────────────────────

function shouldSwitchIfPerishSong(aiMon: Pokemon): boolean {
  const v = aiMon.volatiles['perishsong'];
  return !!(v && v.duration !== undefined && v.duration <= 1);
}

// ── ShouldSwitchIfWonderGuard ────────────────────────────────────────
// If opponent has Wonder Guard and our active has no SE move, look for
// a bench mon that does (2/3 chance per candidate).

function shouldSwitchIfWonderGuard(
  battle: Battle, aiMon: Pokemon, playerMon: Pokemon, bench: Pokemon[],
  aiSide: Side,
): number {
  if (playerMon.ability !== 'wonderguard') return 0;

  for (const ms of aiMon.moveSlots) {
    if (ms.pp === 0) continue;
    const move = battle.dex.moves.get(ms.id);
    if (!move || move.basePower === 0) continue;
    if (typeEffectiveness(battle, move.type, playerMon) > 1) return 0;
  }

  for (const mon of bench) {
    for (const ms of mon.moveSlots) {
      const move = battle.dex.moves.get(ms.id);
      if (!move || move.basePower === 0) continue;
      if (typeEffectiveness(battle, move.type, playerMon) > 1) {
        if (Math.random() < 2 / 3) return slotOf(aiSide, mon);
      }
    }
  }
  return 0;
}

// ── HasSuperEffectiveMoveAgainstOpponents ─────────────────────────────

function hasSuperEffectiveMoveAgainstOpponents(
  battle: Battle, aiMon: Pokemon, playerMon: Pokemon, noRng: boolean,
): boolean {
  for (const ms of aiMon.moveSlots) {
    if (ms.pp === 0) continue;
    const move = battle.dex.moves.get(ms.id);
    if (!move || move.basePower === 0) continue;
    if (typeEffectiveness(battle, move.type, playerMon) > 1) {
      if (noRng) return true;
      if (Math.random() * 10 >= 1) return true; // 90% chance
    }
  }
  return false;
}

// ── FindMonThatAbsorbsOpponentsMove ──────────────────────────────────
// If the last move that hit us was Fire/Water/Electric, find a bench mon
// with Flash Fire / Water Absorb / Volt Absorb.

function findMonThatAbsorbsOpponentsMove(
  battle: Battle, aiMon: Pokemon, playerMon: Pokemon, bench: Pokemon[],
  aiSide: Side,
): number {
  if (hasSuperEffectiveMoveAgainstOpponents(battle, aiMon, playerMon, true)
      && Math.random() * 3 >= 1) {
    return 0;
  }

  const lastMove = playerMon.lastMove;
  if (!lastMove) return 0;
  const moveData = battle.dex.moves.get(lastMove.id);
  if (!moveData || moveData.basePower === 0) return 0;

  let absorbAbility: string;
  if (moveData.type === 'Fire') absorbAbility = 'flashfire';
  else if (moveData.type === 'Water') absorbAbility = 'waterabsorb';
  else if (moveData.type === 'Electric') absorbAbility = 'voltabsorb';
  else return 0;

  if (aiMon.ability === absorbAbility) return 0;

  for (const mon of bench) {
    if (mon.ability === absorbAbility && Math.random() < 0.5) {
      return slotOf(aiSide, mon);
    }
  }
  return 0;
}

// ── ShouldSwitchIfNaturalCure ────────────────────────────────────────

function shouldSwitchIfNaturalCure(
  battle: Battle, aiMon: Pokemon, playerMon: Pokemon, bench: Pokemon[],
  aiSide: Side,
): number {
  if (aiMon.status !== 'slp') return 0;
  if (aiMon.ability !== 'naturalcure') return 0;
  if (aiMon.hp < aiMon.maxhp / 2) return 0;

  const lastMove = playerMon.lastMove;
  const lastMoveData = lastMove ? battle.dex.moves.get(lastMove.id) : null;

  if (!lastMoveData && Math.random() < 0.5) return -1; // pick any
  if (lastMoveData && lastMoveData.basePower === 0 && Math.random() < 0.5) return -1;

  const found = findMonWithFlagsAndSuperEffective(
    battle, aiMon, playerMon, bench, aiSide, 'immune', 1,
  );
  if (found > 0) return found;

  const found2 = findMonWithFlagsAndSuperEffective(
    battle, aiMon, playerMon, bench, aiSide, 'resist', 1,
  );
  if (found2 > 0) return found2;

  if (Math.random() < 0.5) return -1;
  return 0;
}

// ── AreStatsRaised ───────────────────────────────────────────────────

function areStatsRaised(aiMon: Pokemon): boolean {
  let buffedValue = 0;
  const boosts = aiMon.boosts;
  for (const stat of ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'] as const) {
    const val = (boosts as any)[stat] ?? 0;
    if (val > 0) buffedValue += val;
  }
  return buffedValue > 3;
}

// ── FindMonWithFlagsAndSuperEffective ────────────────────────────────
// Find a bench mon that resists/is-immune-to the last move AND has a
// super-effective move against the opponent.

function findMonWithFlagsAndSuperEffective(
  battle: Battle, _aiMon: Pokemon, playerMon: Pokemon, bench: Pokemon[],
  aiSide: Side, flag: 'immune' | 'resist', moduloPercent: number,
): number {
  const lastMove = playerMon.lastMove;
  if (!lastMove) return 0;
  const lastMoveData = battle.dex.moves.get(lastMove.id);
  if (!lastMoveData || lastMoveData.basePower === 0) return 0;

  for (const mon of bench) {
    const eff = typeEffectiveness(battle, lastMoveData.type, mon);
    const matchesFlag =
      (flag === 'immune' && eff === 0) ||
      (flag === 'resist' && eff < 1 && eff > 0);

    if (!matchesFlag) continue;

    for (const ms of mon.moveSlots) {
      const move = battle.dex.moves.get(ms.id);
      if (!move || move.basePower === 0) continue;
      if (typeEffectiveness(battle, move.type, playerMon) > 1) {
        if (moduloPercent === 1 || Math.random() * moduloPercent < 1) {
          return slotOf(aiSide, mon);
        }
      }
    }
  }
  return 0;
}

// ── ShouldSwitch (main orchestrator) ─────────────────────────────────

export function shouldSwitch(
  battle: Battle, aiSide: Side, playerSide: Side,
): { doSwitch: boolean; switchTo: number } {
  const aiMon = aiSide.active[0];
  const playerMon = playerSide.active[0];
  if (!aiMon || !playerMon || aiMon.fainted) {
    return { doSwitch: false, switchTo: 0 };
  }

  // Trapping checks
  if (aiMon.volatiles['partiallytrapped'] || aiMon.volatiles['trapped']) {
    return { doSwitch: false, switchTo: 0 };
  }
  if (aiMon.volatiles['ingrain']) {
    return { doSwitch: false, switchTo: 0 };
  }
  if (aiMon.trapped) {
    return { doSwitch: false, switchTo: 0 };
  }

  // Shadow Tag / Arena Trap / Magnet Pull checked via aiMon.trapped above
  // (@pkmn/sim sets trapped automatically for these abilities)

  const bench = getEligibleBench(aiSide, aiMon);
  if (bench.length === 0) return { doSwitch: false, switchTo: 0 };

  // Check 1: Perish Song
  if (shouldSwitchIfPerishSong(aiMon)) {
    return { doSwitch: true, switchTo: 0 };
  }

  // Check 2: Wonder Guard
  const wgSlot = shouldSwitchIfWonderGuard(battle, aiMon, playerMon, bench, aiSide);
  if (wgSlot > 0) return { doSwitch: true, switchTo: wgSlot };

  // Check 3: Absorb opponent's move
  const absorbSlot = findMonThatAbsorbsOpponentsMove(
    battle, aiMon, playerMon, bench, aiSide,
  );
  if (absorbSlot > 0) return { doSwitch: true, switchTo: absorbSlot };

  // Check 4: Natural Cure
  const ncSlot = shouldSwitchIfNaturalCure(
    battle, aiMon, playerMon, bench, aiSide,
  );
  if (ncSlot !== 0) return { doSwitch: true, switchTo: ncSlot > 0 ? ncSlot : 0 };

  // Check 5: If we already have SE moves, stay
  if (hasSuperEffectiveMoveAgainstOpponents(battle, aiMon, playerMon, false)) {
    return { doSwitch: false, switchTo: 0 };
  }

  // Check 6: If stats are raised, stay
  if (areStatsRaised(aiMon)) {
    return { doSwitch: false, switchTo: 0 };
  }

  // Check 7: Find mon immune to last move with SE move (50% chance)
  const immuneSlot = findMonWithFlagsAndSuperEffective(
    battle, aiMon, playerMon, bench, aiSide, 'immune', 2,
  );
  if (immuneSlot > 0) return { doSwitch: true, switchTo: immuneSlot };

  // Check 8: Find mon resisting last move with SE move (33% chance)
  const resistSlot = findMonWithFlagsAndSuperEffective(
    battle, aiMon, playerMon, bench, aiSide, 'resist', 3,
  );
  if (resistSlot > 0) return { doSwitch: true, switchTo: resistSlot };

  return { doSwitch: false, switchTo: 0 };
}

// ── GetMostSuitableMonToSwitchInto ───────────────────────────────────
// Two-pass approach from the C source:
// 1) Find mon with best defensive typing that also has a SE move
// 2) Fallback: find mon that deals the most damage
//
// NOTE: The original C code has a known bug where it picks the mon that
// TAKES THE MOST damage (worst defensive typing) rather than the least.
// We faithfully reproduce this bug.

export function getMostSuitableMonToSwitchInto(
  battle: Battle, aiSide: Side, playerSide: Side,
): number {
  const aiMon = aiSide.active[0];
  const playerMon = playerSide.active[0];
  if (!aiMon || !playerMon) return 0;

  const bench = getEligibleBench(aiSide, aiMon);
  if (bench.length === 0) return 0;

  const oppTypes = playerMon.types;

  // Pass 1: Find mon whose typing takes the most damage from opponent
  // (this IS the Emerald bug — it selects worst defensive typing)
  // AND that mon must also have a SE move against the opponent.
  let invalidSet = new Set<Pokemon>();
  while (invalidSet.size < bench.length) {
    let bestDmgMod = 0; // TYPE_MUL_NO_EFFECT — any non-immune mon beats this
    let bestMon: Pokemon | null = null;

    for (const mon of bench) {
      if (invalidSet.has(mon)) continue;
      const monTypes = mon.types;

      let typeDmg = 1;
      for (const atkType of oppTypes) {
        typeDmg *= typeEffectivenessRaw(battle, atkType, monTypes);
      }

      if (typeDmg > bestDmgMod) {
        bestDmgMod = typeDmg;
        bestMon = mon;
      }
    }

    if (!bestMon) break;

    let hasSEMove = false;
    for (const ms of bestMon.moveSlots) {
      const move = battle.dex.moves.get(ms.id);
      if (!move || move.basePower === 0) continue;
      if (typeEffectiveness(battle, move.type, playerMon) > 1) {
        hasSEMove = true;
        break;
      }
    }

    if (hasSEMove) return slotOf(aiSide, bestMon);
    invalidSet.add(bestMon);
  }

  // Pass 2: Fallback — pick mon with highest estimated damage output
  let bestDmg = 0;
  let bestMon: Pokemon | null = null;

  for (const mon of bench) {
    for (const ms of mon.moveSlots) {
      const move = battle.dex.moves.get(ms.id);
      if (!move || move.basePower <= 1) continue;

      const eff = typeEffectiveness(battle, move.type, playerMon);
      const estimatedDmg = move.basePower * eff;
      if (estimatedDmg > bestDmg) {
        bestDmg = estimatedDmg;
        bestMon = mon;
      }
    }
  }

  if (bestMon) return slotOf(aiSide, bestMon);

  // Last resort: pick first alive bench mon
  return bench.length > 0 ? slotOf(aiSide, bench[0]) : 0;
}
