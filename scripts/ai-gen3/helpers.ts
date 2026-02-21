/**
 * Shared helpers for Gen 3 AI scoring scripts.
 * Maps ASM opcode semantics to @pkmn/sim API calls.
 */
import type { Battle, Pokemon, Side } from '@pkmn/sim';
import { E, getEffect } from './effect-map.js';

// ── AI Context ───────────────────────────────────────────────────────

export interface AIContext {
  scores: number[];
  moveIdx: number;
  battle: Battle;
  aiMon: Pokemon;
  targetMon: Pokemon;
  aiSide: Side;
  playerSide: Side;
}

// ── Score adjustment ─────────────────────────────────────────────────

export function adj(ctx: AIContext, n: number): void {
  ctx.scores[ctx.moveIdx] += n;
}

// ── Move info ────────────────────────────────────────────────────────

export function getMoveId(ctx: AIContext): string {
  return ctx.aiMon.moveSlots[ctx.moveIdx]?.id ?? '';
}

export function getMoveType(ctx: AIContext): string {
  const id = getMoveId(ctx);
  if (!id) return 'Normal';
  return ctx.battle.dex.moves.get(id).type;
}

export function getMovePower(ctx: AIContext): number {
  const id = getMoveId(ctx);
  if (!id) return 0;
  return ctx.battle.dex.moves.get(id).basePower;
}

export function getMoveEffect(ctx: AIContext): E {
  return getEffect(getMoveId(ctx));
}

// ── HP percentage (0-100) ────────────────────────────────────────────

export function hpPct(mon: Pokemon): number {
  return mon.maxhp > 0 ? Math.floor((mon.hp / mon.maxhp) * 100) : 0;
}

// ── Type effectiveness multiplier (0, 0.25, 0.5, 1, 2, 4) ──────────

export function typeEffMult(battle: Battle, moveId: string, target: Pokemon): number {
  const move = battle.dex.moves.get(moveId);
  if (!move.exists) return 1;
  let mod = 0;
  for (const defType of target.types) {
    const typeData = battle.dex.types.get(defType);
    if (!typeData) continue;
    const dt = (typeData as any).damageTaken?.[move.type];
    if (dt === 3) return 0;
    if (dt === 1) mod += 1;
    if (dt === 2) mod -= 1;
  }
  return 2 ** mod;
}

export function ctxTypeEff(ctx: AIContext): number {
  const id = getMoveId(ctx);
  if (!id) return 1;
  return typeEffMult(ctx.battle, id, ctx.targetMon);
}

// ── Random check: threshold out of 256 ──────────────────────────────

export function rng(threshold: number): boolean {
  return Math.random() * 256 < threshold;
}

// ── Stat boost stage (game: 0-12, @pkmn/sim: -6 to +6) ─────────────

type BoostName = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion';

const STAT_MAP: Record<string, BoostName> = {
  atk: 'atk', def: 'def', spe: 'spe',
  spatk: 'spa', spdef: 'spd',
  acc: 'accuracy', evasion: 'evasion',
};

/**
 * Returns the stat stage in game format (0-12, 6 = default).
 */
export function statStage(mon: Pokemon, stat: string): number {
  const key = STAT_MAP[stat] ?? stat;
  const boost = mon.boosts[key as BoostName] ?? 0;
  return boost + 6;
}

// Game constants
export const MIN_STAT_STAGE = 0;
export const DEFAULT_STAT_STAGE = 6;
export const MAX_STAT_STAGE = 12;

// ── Speed comparison ─────────────────────────────────────────────────

export function targetFaster(ctx: AIContext): boolean {
  return ctx.targetMon.getStat('spe', false, false) > ctx.aiMon.getStat('spe', false, false);
}

export function userFaster(ctx: AIContext): boolean {
  return ctx.aiMon.getStat('spe', false, false) > ctx.targetMon.getStat('spe', false, false);
}

// ── Status checks ────────────────────────────────────────────────────

export function hasStatus(mon: Pokemon): boolean {
  return !!mon.status;
}

export function hasStatusCond(mon: Pokemon, status: string): boolean {
  if (status === 'any') return !!mon.status;
  return mon.status === status;
}

export function hasVolatile(mon: Pokemon, vol: string): boolean {
  return !!mon.volatiles[vol];
}

// ── Side condition checks ────────────────────────────────────────────

export function hasSideCond(side: Side, cond: string): boolean {
  return !!side.sideConditions[cond];
}

// ── Weather ──────────────────────────────────────────────────────────

export const enum Weather {
  SUN = 0,
  RAIN = 1,
  SANDSTORM = 2,
  HAIL = 3,
  NONE = -1,
}

export function getWeather(battle: Battle): Weather {
  const w = battle.field.weather;
  if (w === 'sunnyday' || w === 'SunnyDay' || w === 'desolateland') return Weather.SUN;
  if (w === 'raindance' || w === 'RainDance' || w === 'primordialsea') return Weather.RAIN;
  if (w === 'sandstorm' || w === 'Sandstorm') return Weather.SANDSTORM;
  if (w === 'hail' || w === 'Hail') return Weather.HAIL;
  return Weather.NONE;
}

// ── Party mon counting ───────────────────────────────────────────────

export function countUsablePartyMons(side: Side): number {
  let count = 0;
  for (const mon of side.pokemon) {
    if (mon.hp > 0 && !mon.isActive) count++;
  }
  return count;
}

// ── Move power classification (get_how_powerful_move_is) ─────────────

const IGNORED_POWER_EFFECTS = new Set<E>([
  E.EXPLOSION, E.DREAM_EATER, E.OHKO, E.LEVEL_DAMAGE,
  E.PSYWAVE, E.COUNTER, E.MIRROR_COAT, E.SUPER_FANG,
  E.SONICBOOM, E.DRAGON_RAGE, E.FLAIL, E.RETURN,
  E.PRESENT, E.FRUSTRATION, E.MAGNITUDE, E.BIDE,
  E.FOCUS_PUNCH, E.ENDEAVOR, E.ERUPTION, E.LOW_KICK,
]);

export const POWER_OTHER = 0;
export const POWER_NOT_MOST = 1;
export const POWER_MOST = 2;

export function getHowPowerful(ctx: AIContext): number {
  const moveId = getMoveId(ctx);
  const dex = ctx.battle.dex;
  const move = dex.moves.get(moveId);
  if (!move.exists || move.basePower === 0) return POWER_OTHER;
  if (IGNORED_POWER_EFFECTS.has(getEffect(moveId))) return POWER_OTHER;

  const currentScore = estimatePower(ctx.battle, ctx.aiMon, ctx.targetMon, moveId);
  let maxOtherScore = 0;
  for (let i = 0; i < 4; i++) {
    if (i === ctx.moveIdx) continue;
    const otherId = ctx.aiMon.moveSlots[i]?.id;
    if (!otherId) continue;
    const otherMove = dex.moves.get(otherId);
    if (!otherMove.exists || otherMove.basePower === 0) continue;
    if (IGNORED_POWER_EFFECTS.has(getEffect(otherId))) continue;
    const score = estimatePower(ctx.battle, ctx.aiMon, ctx.targetMon, otherId);
    if (score > maxOtherScore) maxOtherScore = score;
  }
  return currentScore >= maxOtherScore ? POWER_MOST : POWER_NOT_MOST;
}

function estimatePower(
  battle: Battle, attacker: Pokemon, defender: Pokemon, moveId: string,
): number {
  const move = battle.dex.moves.get(moveId);
  const eff = typeEffMult(battle, moveId, defender);
  const stab = attacker.hasType(move.type) ? 1.5 : 1;
  return move.basePower * eff * stab;
}

// ── KO estimation (if_can_faint) ─────────────────────────────────────

export function canFaint(ctx: AIContext): boolean {
  const moveId = getMoveId(ctx);
  const dex = ctx.battle.dex;
  const move = dex.moves.get(moveId);
  if (!move.exists || move.basePower === 0) return false;

  const eff = typeEffMult(ctx.battle, moveId, ctx.targetMon);
  if (eff === 0) return false;
  const stab = ctx.aiMon.hasType(move.type) ? 1.5 : 1;
  const level = ctx.aiMon.level;
  const atk = move.category === 'Special'
    ? ctx.aiMon.getStat('spa', false, false)
    : ctx.aiMon.getStat('atk', false, false);
  const def = move.category === 'Special'
    ? ctx.targetMon.getStat('spd', false, false)
    : ctx.targetMon.getStat('def', false, false);

  const dmg = Math.floor(
    ((2 * level / 5 + 2) * move.basePower * atk / def / 50 + 2) * stab * eff,
  );
  return dmg >= ctx.targetMon.hp;
}

// ── Move/effect queries on a battler's moveset ──────────────────────

export function monHasMove(mon: Pokemon, moveId: string): boolean {
  return mon.moveSlots.some(m => m.id === moveId);
}

export function monHasMoveWithEffect(mon: Pokemon, effect: E): boolean {
  return mon.moveSlots.some(m => getEffect(m.id) === effect);
}

// ── Last used move queries ───────────────────────────────────────────

export function getLastMoveId(mon: Pokemon): string {
  return mon.lastMove?.id ?? '';
}

export function getLastMovePower(mon: Pokemon, battle: Battle): number {
  const id = getLastMoveId(mon);
  if (!id) return 0;
  return battle.dex.moves.get(id).basePower;
}

export function getLastMoveType(mon: Pokemon, battle: Battle): string {
  const id = getLastMoveId(mon);
  if (!id) return 'Normal';
  return battle.dex.moves.get(id).type;
}

export function getLastMoveEffect(mon: Pokemon): E {
  return getEffect(getLastMoveId(mon));
}

// ── First turn check ─────────────────────────────────────────────────

export function isFirstTurnFor(mon: Pokemon): boolean {
  return (mon.activeTurns ?? 0) <= 1;
}

// ── Status in party ──────────────────────────────────────────────────

export function partyHasStatus(side: Side): boolean {
  return side.pokemon.some(p => p.hp > 0 && !!p.status);
}

// ── Gender ───────────────────────────────────────────────────────────

export function getGender(mon: Pokemon): 'M' | 'F' | 'N' {
  if (mon.gender === 'M') return 'M';
  if (mon.gender === 'F') return 'F';
  return 'N';
}

// ── Hold effect / item checks ────────────────────────────────────────

export function getHeldItem(mon: Pokemon): string {
  return mon.item ?? '';
}
