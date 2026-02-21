/**
 * Gen 2 AI scoring layers — ported from pokecrystal/engine/battle/ai/scoring.asm
 *
 * Lower score = better move. Default score: 20. Disabled/0PP: 80.
 * Each layer modifies scores based on battle state.
 */
import type { Battle, Pokemon, Side } from '@pkmn/sim';
import {
  STALL_MOVES, RESIDUAL_MOVES, USEFUL_MOVES, ENCORE_MOVES,
  RAIN_DANCE_MOVES, SUNNY_DAY_MOVES, RISKY_EFFECT_MOVES,
  RECKLESS_EFFECT_IDS, CONSTANT_DAMAGE_MOVES, STATUS_ONLY_MOVES,
  STAT_UP_MOVES, STAT_DOWN_MOVES, HEAL_MOVES, SLEEP_MOVES,
} from './tables.js';

export type AIFlag =
  | 'AI_BASIC' | 'AI_SETUP' | 'AI_TYPES' | 'AI_OFFENSIVE'
  | 'AI_SMART' | 'AI_OPPORTUNIST' | 'AI_AGGRESSIVE'
  | 'AI_CAUTIOUS' | 'AI_STATUS' | 'AI_RISKY';

const FLAG_ORDER: AIFlag[] = [
  'AI_BASIC', 'AI_SETUP', 'AI_TYPES', 'AI_OFFENSIVE',
  'AI_SMART', 'AI_OPPORTUNIST', 'AI_AGGRESSIVE',
  'AI_CAUTIOUS', 'AI_STATUS', 'AI_RISKY',
];

const LAYER_FNS: Record<AIFlag, (s: number[], b: Battle, ai: Side, pl: Side) => void> = {
  AI_BASIC: aiBasic,
  AI_SETUP: aiSetup,
  AI_TYPES: aiTypes,
  AI_OFFENSIVE: aiOffensive,
  AI_SMART: aiSmart,
  AI_OPPORTUNIST: aiOpportunist,
  AI_AGGRESSIVE: aiAggressive,
  AI_CAUTIOUS: aiCautious,
  AI_STATUS: aiStatus,
  AI_RISKY: aiRisky,
};

// ── Public API ───────────────────────────────────────────────────────

export function scoreMoves(
  battle: Battle,
  aiSide: Side,
  playerSide: Side,
  flags: AIFlag[],
): number[] {
  const active = aiSide.active[0];
  if (!active) return [80, 80, 80, 80];

  const scores = [20, 20, 20, 20];

  // Mark disabled / 0PP as 80
  for (let i = 0; i < 4; i++) {
    const move = active.moveSlots[i];
    if (!move || move.pp <= 0 || move.disabled) {
      scores[i] = 80;
    }
  }

  for (const flag of FLAG_ORDER) {
    if (flags.includes(flag)) {
      LAYER_FNS[flag](scores, battle, aiSide, playerSide);
    }
  }

  return scores;
}

export function pickMoveFromScores(scores: number[]): number {
  const min = Math.min(...scores);
  const candidates = scores
    .map((s, i) => ({ s, i }))
    .filter(x => x.s === min);
  return candidates[Math.floor(Math.random() * candidates.length)].i;
}

// ── Helpers ──────────────────────────────────────────────────────────

function pct(hp: number, maxhp: number): number {
  return maxhp > 0 ? (hp / maxhp) * 100 : 0;
}

function rand(n: number): boolean {
  return Math.random() * 100 < n;
}

function getMoveId(mon: Pokemon, idx: number): string {
  return mon.moveSlots[idx]?.id ?? '';
}

function hasMove(mon: Pokemon, moveId: string): boolean {
  return mon.moveSlots.some(m => m.id === moveId);
}

function getMovePower(mon: Pokemon, idx: number): number {
  const id = getMoveId(mon, idx);
  if (!id) return 0;
  const dexMove = mon.battle.dex.moves.get(id);
  return dexMove?.basePower ?? 0;
}

function getMoveType(mon: Pokemon, idx: number): string {
  const id = getMoveId(mon, idx);
  if (!id) return 'Normal';
  const dexMove = mon.battle.dex.moves.get(id);
  return dexMove?.type ?? 'Normal';
}

/**
 * Returns an actual damage multiplier (0, 0.25, 0.5, 1, 2, 4).
 * Dex.getEffectiveness returns additive log2 modifiers (0=neutral, 1=SE, -1=NVE)
 * but does NOT distinguish immune from neutral. We check damageTaken directly.
 */
function typeEffectiveness(battle: Battle, moveType: string, target: Pokemon): number {
  let totalMod = 0;
  for (const t of target.types) {
    const typeData = battle.dex.types.get(t);
    if (!typeData) continue;
    const dt = (typeData as any).damageTaken?.[moveType];
    if (dt === 3) return 0; // immune
    if (dt === 1) totalMod += 1;  // SE
    if (dt === 2) totalMod -= 1;  // NVE
  }
  return 2 ** totalMod;
}

function hasSideCondition(side: Side, condition: string): boolean {
  return !!side.sideConditions[condition];
}

// ── AI_BASIC ─────────────────────────────────────────────────────────

function aiBasic(scores: number[], battle: Battle, ai: Side, player: Side) {
  const mon = ai.active[0];
  const target = player.active[0];
  if (!mon || !target) return;

  for (let i = 0; i < 4; i++) {
    if (scores[i] >= 80) continue;
    const id = getMoveId(mon, i);
    if (!id) continue;

    // Redundancy: status moves when target already statused
    if (STATUS_ONLY_MOVES.has(id) && target.status) {
      scores[i] += 10;
      continue;
    }
    // Redundancy: status moves vs Safeguard
    if (STATUS_ONLY_MOVES.has(id) && hasSideCondition(player, 'safeguard')) {
      scores[i] += 10;
      continue;
    }

    const dexMove = battle.dex.moves.get(id);
    if (!dexMove) continue;

    // Dream Eater vs non-sleeping target
    if (id === 'dreameater' && target.status !== 'slp') {
      scores[i] += 10;
    }
    // Heal at full HP
    if (HEAL_MOVES.has(id) && mon.hp >= mon.maxhp) {
      scores[i] += 10;
    }
    // Light Screen already up
    if (id === 'lightscreen' && hasSideCondition(ai, 'lightscreen')) {
      scores[i] += 10;
    }
    // Reflect already up
    if (id === 'reflect' && hasSideCondition(ai, 'reflect')) {
      scores[i] += 10;
    }
    // Safeguard already up
    if (id === 'safeguard' && hasSideCondition(ai, 'safeguard')) {
      scores[i] += 10;
    }
    // Mist already active
    if (id === 'mist' && hasSideCondition(ai, 'mist')) {
      scores[i] += 10;
    }
    // Substitute already up
    if (id === 'substitute' && mon.volatiles['substitute']) {
      scores[i] += 10;
    }
    // Leech Seed on already-seeded target
    if (id === 'leechseed' && target.volatiles['leechseed']) {
      scores[i] += 10;
    }
    // Confusion on already-confused target
    if ((dexMove.volatileStatus === 'confusion' || id === 'confuseray' || id === 'supersonic')
        && target.volatiles['confusion']) {
      scores[i] += 10;
    }
    // Snore / Sleep Talk when not asleep
    if ((id === 'snore' || id === 'sleeptalk') && mon.status !== 'slp') {
      scores[i] += 10;
    }
    // Snore / Sleep Talk: strongly encourage when asleep
    if ((id === 'snore' || id === 'sleeptalk') && mon.status === 'slp') {
      scores[i] -= 5;
    }
    // Spikes already up
    if (id === 'spikes' && hasSideCondition(player, 'spikes')) {
      scores[i] += 10;
    }
    // Attract: same gender or genderless
    if (id === 'attract') {
      if (!mon.gender || !target.gender || mon.gender === target.gender) {
        scores[i] += 10;
      }
    }
    // Transform if already transformed
    if (id === 'transform' && mon.volatiles['transform']) {
      scores[i] += 10;
    }
    // Weather moves when weather already matches
    if (id === 'raindance' && battle.field.weather === 'RainDance') scores[i] += 10;
    if (id === 'sunnyday' && battle.field.weather === 'SunnyDay') scores[i] += 10;
    if (id === 'sandstorm' && battle.field.weather === 'Sandstorm') scores[i] += 10;
  }
}

// ── AI_SETUP ─────────────────────────────────────────────────────────

function aiSetup(scores: number[], battle: Battle, ai: Side, player: Side) {
  const mon = ai.active[0];
  if (!mon) return;
  const earlyTurn = battle.turn <= 1;

  for (let i = 0; i < 4; i++) {
    if (scores[i] >= 80) continue;
    const id = getMoveId(mon, i);

    if (STAT_UP_MOVES.has(id) || STAT_DOWN_MOVES.has(id)) {
      if (earlyTurn) {
        if (rand(50)) scores[i] -= 2;
      } else {
        if (rand(90)) scores[i] += 2;
      }
    }
  }
}

// ── AI_TYPES ─────────────────────────────────────────────────────────

function aiTypes(scores: number[], battle: Battle, ai: Side, player: Side) {
  const mon = ai.active[0];
  const target = player.active[0];
  if (!mon || !target) return;

  // Check if mon has multiple damaging move types
  const damageTypes = new Set<string>();
  for (let i = 0; i < 4; i++) {
    if (scores[i] >= 80) continue;
    if (getMovePower(mon, i) > 0) {
      damageTypes.add(getMoveType(mon, i));
    }
  }

  for (let i = 0; i < 4; i++) {
    if (scores[i] >= 80) continue;
    const power = getMovePower(mon, i);
    if (power <= 0) continue;

    const moveType = getMoveType(mon, i);
    const eff = typeEffectiveness(battle, moveType, target);

    if (eff === 0) {
      scores[i] += 10;
    } else if (eff > 1) {
      scores[i] -= 1;
    } else if (eff < 1 && damageTypes.size > 1) {
      scores[i] += 1;
    }
  }
}

// ── AI_OFFENSIVE ─────────────────────────────────────────────────────

function aiOffensive(scores: number[], battle: Battle, ai: Side, _player: Side) {
  const mon = ai.active[0];
  if (!mon) return;

  for (let i = 0; i < 4; i++) {
    if (scores[i] >= 80) continue;
    if (getMovePower(mon, i) <= 0) {
      scores[i] += 2;
    }
  }
}

// ── AI_SMART ─────────────────────────────────────────────────────────

function aiSmart(scores: number[], battle: Battle, ai: Side, player: Side) {
  const mon = ai.active[0];
  const target = player.active[0];
  if (!mon || !target) return;

  const monHpPct = pct(mon.hp, mon.maxhp);
  const targetHpPct = pct(target.hp, target.maxhp);

  for (let i = 0; i < 4; i++) {
    if (scores[i] >= 80) continue;
    const id = getMoveId(mon, i);
    if (!id) continue;

    // Sleep moves
    if (SLEEP_MOVES.has(id)) {
      if (hasMove(mon, 'dreameater') || hasMove(mon, 'nightmare')) {
        scores[i] -= 1;
      } else if (rand(50)) {
        scores[i] -= 1;
      }
      continue;
    }

    // Dream Eater
    if (id === 'dreameater' && target.status === 'slp') {
      if (rand(90)) scores[i] -= 5;
      continue;
    }

    // Self-destruct / Explosion
    if (id === 'selfdestruct' || id === 'explosion') {
      const aiAlive = ai.pokemon.filter(p => p.hp > 0).length;
      const plAlive = player.pokemon.filter(p => p.hp > 0).length;
      if (aiAlive > 1 || plAlive > 1 || monHpPct >= 50) {
        scores[i] += 10;
      }
      continue;
    }

    // Heal moves
    if (HEAL_MOVES.has(id)) {
      if (monHpPct < 25 && rand(90)) scores[i] -= 1;
      else if (monHpPct > 50) scores[i] += 1;
      continue;
    }

    // Toxic / Leech Seed
    if (id === 'toxic' || id === 'leechseed') {
      if (targetHpPct < 50) scores[i] += 1;
      continue;
    }

    // OHKO moves
    if (id === 'guillotine' || id === 'horndrill' || id === 'fissure') {
      if (target.level > mon.level) {
        scores[i] += 10;
      } else if (targetHpPct < 50) {
        scores[i] += 1;
      }
      continue;
    }

    // Substitute
    if (id === 'substitute') {
      if (monHpPct < 50) scores[i] += 10;
      continue;
    }

    // Hyper Beam
    if (id === 'hyperbeam') {
      if (monHpPct > 50) scores[i] += 1;
      else if (monHpPct < 25 && rand(50)) scores[i] -= 1;
      continue;
    }

    // Counter / Mirror Coat
    if (id === 'counter' || id === 'mirrorcoat') {
      if (rand(50)) scores[i] -= 1;
      continue;
    }

    // Encore
    if (id === 'encore') {
      const lastMove = target.lastMove?.id;
      if (lastMove && ENCORE_MOVES.has(lastMove)) {
        scores[i] -= 5;
      } else {
        scores[i] += 10;
      }
      continue;
    }

    // Protect / Detect
    if (id === 'protect' || id === 'detect') {
      if (target.volatiles['lockedmove'] || target.volatiles['furycutter']) {
        scores[i] -= 1;
      }
      if (mon.volatiles['protect']) {
        scores[i] += 1;
      }
      continue;
    }

    // Snore / Sleep Talk
    if (id === 'snore' || id === 'sleeptalk') {
      if (mon.status === 'slp') scores[i] -= 5;
      else scores[i] += 10;
      continue;
    }

    // Pursuit
    if (id === 'pursuit') {
      if (targetHpPct < 25 && rand(50)) scores[i] -= 5;
      else if (rand(80)) scores[i] += 1;
      continue;
    }

    // Rain Dance
    if (id === 'raindance') {
      if (mon.moveSlots.some(m => RAIN_DANCE_MOVES.has(m.id))) scores[i] -= 1;
      if (target.moveSlots.some(m => RAIN_DANCE_MOVES.has(m.id))) scores[i] += 1;
      continue;
    }

    // Sunny Day
    if (id === 'sunnyday') {
      if (mon.moveSlots.some(m => SUNNY_DAY_MOVES.has(m.id))) scores[i] -= 1;
      if (target.moveSlots.some(m => SUNNY_DAY_MOVES.has(m.id))) scores[i] += 1;
      continue;
    }

    // Solar Beam
    if (id === 'solarbeam') {
      if (battle.field.weather === 'SunnyDay') scores[i] -= 1;
      if (battle.field.weather === 'RainDance') scores[i] += 1;
      continue;
    }

    // Thunder
    if (id === 'thunder') {
      if (battle.field.weather === 'SunnyDay') scores[i] += 1;
      continue;
    }

    // Flame Wheel / Sacred Fire vs frozen target
    if ((id === 'flamewheel' || id === 'sacredfire') && target.status === 'frz') {
      scores[i] -= 10;
      continue;
    }

    // Curse (different for Ghost vs non-Ghost)
    if (id === 'curse') {
      if (mon.hasType('Ghost')) {
        if (monHpPct < 50) scores[i] += 1;
      }
      continue;
    }

    // Thief — heavily penalized
    if (id === 'thief') {
      scores[i] += 30;
      continue;
    }

    // Destiny Bond / Reversal / Flail
    if (id === 'destinybond' || id === 'reversal' || id === 'flail') {
      if (monHpPct > 25) scores[i] += 1;
      continue;
    }

    // Mirror Move
    if (id === 'mirrormove') {
      const lastMove = target.lastMove?.id;
      if (lastMove && USEFUL_MOVES.has(lastMove)) {
        scores[i] -= 1;
      } else {
        scores[i] += 1;
      }
      continue;
    }

    // Evasion up (Double Team, Minimize)
    if (id === 'doubleteam' || id === 'minimize') {
      if (monHpPct > 70 && rand(70)) scores[i] -= 1;
      else if (monHpPct < 40) scores[i] += 1;
      continue;
    }
  }
}

// ── AI_OPPORTUNIST ───────────────────────────────────────────────────

function aiOpportunist(scores: number[], battle: Battle, ai: Side, _player: Side) {
  const mon = ai.active[0];
  if (!mon) return;
  const hpPct = pct(mon.hp, mon.maxhp);
  if (hpPct > 50) return;

  for (let i = 0; i < 4; i++) {
    if (scores[i] >= 80) continue;
    const id = getMoveId(mon, i);
    if (STALL_MOVES.has(id)) {
      if (hpPct <= 25) {
        scores[i] += 1;
      } else if (rand(50)) {
        scores[i] += 1;
      }
    }
  }
}

// ── AI_AGGRESSIVE ────────────────────────────────────────────────────

function aiAggressive(scores: number[], battle: Battle, ai: Side, player: Side) {
  const mon = ai.active[0];
  const target = player.active[0];
  if (!mon || !target) return;

  // Estimate damage for each move, find the best
  const damages: number[] = [];
  let bestDmg = 0;
  let bestIdx = -1;

  for (let i = 0; i < 4; i++) {
    if (scores[i] >= 80) {
      damages.push(0);
      continue;
    }
    const id = getMoveId(mon, i);
    const power = getMovePower(mon, i);

    if (power <= 0 || CONSTANT_DAMAGE_MOVES.has(id)) {
      damages.push(0);
      continue;
    }

    const moveType = getMoveType(mon, i);
    const eff = typeEffectiveness(battle, moveType, target);
    const stab = mon.hasType(moveType) ? 1.5 : 1;
    const dmg = power * eff * stab;
    damages.push(dmg);

    if (dmg > bestDmg) {
      bestDmg = dmg;
      bestIdx = i;
    }
  }

  for (let i = 0; i < 4; i++) {
    if (scores[i] >= 80 || i === bestIdx) continue;
    if (damages[i] <= 0) continue;

    const id = getMoveId(mon, i);
    if (RECKLESS_EFFECT_IDS.has(id)) continue;

    scores[i] += 1;
  }
}

// ── AI_CAUTIOUS ──────────────────────────────────────────────────────

function aiCautious(scores: number[], battle: Battle, ai: Side, _player: Side) {
  if (battle.turn <= 1) return;
  const mon = ai.active[0];
  if (!mon) return;

  for (let i = 0; i < 4; i++) {
    if (scores[i] >= 80) continue;
    const id = getMoveId(mon, i);
    if (RESIDUAL_MOVES.has(id)) {
      if (rand(90)) scores[i] += 1;
    }
  }
}

// ── AI_STATUS ────────────────────────────────────────────────────────

function aiStatus(scores: number[], battle: Battle, ai: Side, player: Side) {
  const mon = ai.active[0];
  const target = player.active[0];
  if (!mon || !target) return;

  for (let i = 0; i < 4; i++) {
    if (scores[i] >= 80) continue;
    const id = getMoveId(mon, i);

    // Toxic / Poison vs Poison-type
    if ((id === 'toxic' || id === 'poisonpowder' || id === 'poisongas') &&
        target.hasType('Poison')) {
      scores[i] += 10;
      continue;
    }

    // Status moves: check type immunity
    if (STATUS_ONLY_MOVES.has(id)) {
      const moveType = getMoveType(mon, i);
      const eff = typeEffectiveness(battle, moveType, target);
      if (eff === 0) {
        scores[i] += 10;
      }
    }
  }
}

// ── AI_RISKY ─────────────────────────────────────────────────────────

function aiRisky(scores: number[], battle: Battle, ai: Side, player: Side) {
  const mon = ai.active[0];
  const target = player.active[0];
  if (!mon || !target) return;

  const monHpPct = pct(mon.hp, mon.maxhp);

  for (let i = 0; i < 4; i++) {
    if (scores[i] >= 80) continue;
    const id = getMoveId(mon, i);
    const power = getMovePower(mon, i);
    if (power <= 0) continue;

    if (RISKY_EFFECT_MOVES.has(id)) {
      if (monHpPct >= 100) continue;
      if (rand(80)) continue;
    }

    // Rough KO check: would this move KO the target?
    const moveType = getMoveType(mon, i);
    const eff = typeEffectiveness(battle, moveType, target);
    const stab = mon.hasType(moveType) ? 1.5 : 1;
    const estimatedDmg = power * eff * stab * (mon.level / 50);

    if (estimatedDmg >= target.hp) {
      scores[i] -= 5;
    }
  }
}
