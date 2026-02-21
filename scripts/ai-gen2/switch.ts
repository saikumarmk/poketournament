/**
 * Gen 2 AI switching logic — ported from pokecrystal/engine/battle/ai/switch.asm
 *
 * Two entry points:
 * - evaluateVoluntarySwitch: Should the AI switch before choosing a move?
 * - pickBestSwitch: Given available mons, pick the best replacement (forced or voluntary).
 */
import type { Battle, Pokemon, Side } from '@pkmn/sim';

export type SwitchFlag = 'SWITCH_OFTEN' | 'SWITCH_SOMETIMES' | 'SWITCH_RARELY' | null;

const BASE_SWITCH_SCORE = 10;

// ── Type effectiveness helper ────────────────────────────────────────

function typeEffectiveness(battle: Battle, moveType: string, target: Pokemon): number {
  let totalMod = 0;
  for (const t of target.types) {
    const typeData = battle.dex.types.get(t);
    if (!typeData) continue;
    const dt = (typeData as any).damageTaken?.[moveType];
    if (dt === 3) return 0;
    if (dt === 1) totalMod += 1;
    if (dt === 2) totalMod -= 1;
  }
  return 2 ** totalMod;
}

// ── Score the current matchup ────────────────────────────────────────
// Mirrors CheckPlayerMoveTypeMatchups from the ASM.
// Returns a score where lower = AI is more threatened (should switch).

function scoreCurrentMatchup(battle: Battle, aiMon: Pokemon, playerMon: Pokemon): number {
  let score = BASE_SWITCH_SCORE;

  // Part 1: How well do the player's moves hit our mon?
  // In the ASM, this checks wPlayerUsedMoves (moves the player has revealed).
  // We check all of the player's active mon's known moves.
  const playerMoves = playerMon.moveSlots;
  let bestPlayerMatchup = 0; // 0=no damaging, 1=NVE, 2=neutral, 3=SE

  for (const ms of playerMoves) {
    const moveData = battle.dex.moves.get(ms.id);
    if (!moveData || moveData.basePower === 0) continue;

    const eff = typeEffectiveness(battle, moveData.type, aiMon);
    if (eff > 1) {
      bestPlayerMatchup = 3;
      break;
    } else if (eff === 1) {
      bestPlayerMatchup = Math.max(bestPlayerMatchup, 2);
    } else if (eff > 0) {
      bestPlayerMatchup = Math.max(bestPlayerMatchup, 1);
    }
    // eff === 0 (immune) doesn't improve matchup
  }

  if (bestPlayerMatchup === 3) {
    score--; // Player has SE move → we're threatened
  } else if (bestPlayerMatchup <= 1) {
    score++; // Player only has NVE/immune moves → we're safe
    if (bestPlayerMatchup === 0) score++; // No damaging moves at all
  }

  // Part 2: How well do our moves hit the player?
  const aiMoves = aiMon.moveSlots;
  let bestAiMatchup = 0;

  for (const ms of aiMoves) {
    const moveData = battle.dex.moves.get(ms.id);
    if (!moveData || moveData.basePower === 0) continue;

    const eff = typeEffectiveness(battle, moveData.type, playerMon);
    if (eff > 1) {
      bestAiMatchup = 3;
      break;
    } else if (eff === 1) {
      bestAiMatchup = Math.max(bestAiMatchup, 2);
    } else if (eff > 0) {
      bestAiMatchup = Math.max(bestAiMatchup, 1);
    }
  }

  if (bestAiMatchup === 3) {
    score++; // We have SE moves → good position
  } else if (bestAiMatchup === 0) {
    score -= 2; // We can't hit them well → bad
  } else if (bestAiMatchup === 1) {
    score--; // Only NVE → not great
  }

  return score;
}

// ── Switch probabilities ─────────────────────────────────────────────
// Based on the switch param value and flag.
// Param values: 0x10 (low urgency), 0x20 (medium), 0x30 (high/perish)

const SWITCH_PROBS: Record<string, Record<number, number>> = {
  SWITCH_OFTEN:     { 0x10: 0.50, 0x20: 0.79, 0x30: 0.96 },
  SWITCH_SOMETIMES: { 0x10: 0.20, 0x20: 0.50, 0x30: 0.20 },
  SWITCH_RARELY:    { 0x10: 0.08, 0x20: 0.12, 0x30: 0.21 },
};

function switchProbability(flag: SwitchFlag, param: number): number {
  if (!flag) return 0;
  const probs = SWITCH_PROBS[flag];
  if (!probs) return 0;
  return probs[param] ?? 0;
}

// ── Score a candidate replacement mon ────────────────────────────────

function scoreSwitchCandidate(
  battle: Battle, candidate: Pokemon, playerMon: Pokemon,
): number {
  let score = 0;

  // Prefer mons with more HP
  const hpPct = candidate.hp / candidate.maxhp;
  if (hpPct >= 0.25) score += 2;
  if (hpPct >= 0.50) score += 1;

  // Prefer mons that resist the player's last move
  if (playerMon.lastMove) {
    const lastMoveData = battle.dex.moves.get(playerMon.lastMove.id);
    if (lastMoveData && lastMoveData.basePower > 0) {
      const eff = typeEffectiveness(battle, lastMoveData.type, candidate);
      if (eff === 0) score += 5; // immune
      else if (eff < 1) score += 3; // resistant
      else if (eff > 1) score -= 3; // weak to it
    }
  }

  // Prefer mons with a super-effective move against the player
  for (const ms of candidate.moveSlots) {
    const moveData = battle.dex.moves.get(ms.id);
    if (!moveData || moveData.basePower === 0) continue;
    const eff = typeEffectiveness(battle, moveData.type, playerMon);
    if (eff > 1) {
      score += 4;
      break;
    }
  }

  return score;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Decide whether the AI should voluntarily switch before choosing a move.
 * Returns the 1-based slot to switch to, or 0 if no switch.
 */
export function evaluateVoluntarySwitch(
  battle: Battle,
  aiSide: Side,
  playerSide: Side,
  switchFlag: SwitchFlag,
): number {
  if (!switchFlag) return 0;

  const aiMon = aiSide.active[0];
  const playerMon = playerSide.active[0];
  if (!aiMon || !playerMon || aiMon.fainted) return 0;

  // Need at least 2 alive mons to consider switching
  const alive = aiSide.pokemon.filter(p => !p.fainted && p !== aiMon);
  if (alive.length === 0) return 0;

  // Can't switch if trapped
  if (aiMon.trapped) return 0;

  // Priority 1: Perish Song with 1 turn left → definitely switch
  if (aiMon.volatiles['perishsong'] && aiMon.volatiles['perishsong'].duration === 1) {
    const best = pickBestSwitchMon(battle, aiSide, playerSide);
    return best;
  }

  // Evaluate current matchup
  const matchupScore = scoreCurrentMatchup(battle, aiMon, playerMon);

  // If we're not disadvantaged, don't switch
  if (matchupScore >= BASE_SWITCH_SCORE) return 0;

  // Determine urgency param based on how bad the matchup is
  let param: number;
  if (matchupScore <= BASE_SWITCH_SCORE - 4) {
    param = 0x30; // Very bad matchup
  } else if (matchupScore <= BASE_SWITCH_SCORE - 2) {
    param = 0x20; // Bad matchup
  } else {
    param = 0x10; // Slightly bad
  }

  // Roll probability
  const prob = switchProbability(switchFlag, param);
  if (Math.random() >= prob) return 0;

  return pickBestSwitchMon(battle, aiSide, playerSide);
}

/**
 * Pick the best replacement mon from the team.
 * Returns 1-based slot number, or 0 if no valid candidate.
 */
export function pickBestSwitchMon(
  battle: Battle,
  aiSide: Side,
  playerSide: Side,
): number {
  const aiMon = aiSide.active[0];
  const playerMon = playerSide.active[0];

  let bestScore = -Infinity;
  let bestSlot = 0;

  for (let i = 0; i < aiSide.pokemon.length; i++) {
    const mon = aiSide.pokemon[i];
    if (mon.fainted || mon === aiMon) continue;

    const score = playerMon
      ? scoreSwitchCandidate(battle, mon, playerMon)
      : 0;

    if (score > bestScore) {
      bestScore = score;
      bestSlot = i + 1; // 1-based
    }
  }

  return bestSlot;
}
