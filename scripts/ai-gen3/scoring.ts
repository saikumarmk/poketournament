/**
 * Gen 3 AI scoring — transpiled from pokeemerald/data/battle_ai_scripts.s
 *
 * Higher score = better move. Default score: 100. Disabled/0PP: 0.
 * Each AI flag maps to a scoring function that adjusts scores.
 *
 * Smaller scripts (TryToFaint, SetupFirstTurn, Risky, PreferPowerExtremes,
 * PreferBatonPass, HPAware) live here. Large scripts are imported.
 */
import type { Battle, Pokemon, Side } from '@pkmn/sim';
import { E, getEffect } from './effect-map.js';
import {
  SETUP_FIRST_TURN_EFFECTS, RISKY_EFFECTS, BATON_PASS_SETUP_MOVES,
} from './tables.js';
import {
  type AIContext, adj, getMoveId, getMoveEffect,
  hpPct, ctxTypeEff, canFaint, rng, statStage,
  getHowPowerful, POWER_MOST, POWER_OTHER, DEFAULT_STAT_STAGE,
  countUsablePartyMons, monHasMoveWithEffect,
} from './helpers.js';
import { aiCheckBadMove } from './check-bad-move.js';
import { aiCheckViability } from './check-viability.js';
import { aiHPAware } from './hp-aware.js';

// ── AI Flags ─────────────────────────────────────────────────────────

export type AIFlag =
  | 'AI_SCRIPT_CHECK_BAD_MOVE'
  | 'AI_SCRIPT_TRY_TO_FAINT'
  | 'AI_SCRIPT_CHECK_VIABILITY'
  | 'AI_SCRIPT_SETUP_FIRST_TURN'
  | 'AI_SCRIPT_RISKY'
  | 'AI_SCRIPT_PREFER_POWER_EXTREMES'
  | 'AI_SCRIPT_PREFER_BATON_PASS'
  | 'AI_SCRIPT_HP_AWARE'
  | 'AI_SCRIPT_TRY_SUNNY_DAY_START';

const FLAG_ORDER: AIFlag[] = [
  'AI_SCRIPT_CHECK_BAD_MOVE',
  'AI_SCRIPT_TRY_TO_FAINT',
  'AI_SCRIPT_CHECK_VIABILITY',
  'AI_SCRIPT_SETUP_FIRST_TURN',
  'AI_SCRIPT_RISKY',
  'AI_SCRIPT_PREFER_POWER_EXTREMES',
  'AI_SCRIPT_PREFER_BATON_PASS',
  'AI_SCRIPT_HP_AWARE',
  'AI_SCRIPT_TRY_SUNNY_DAY_START',
];

type ScoringFn = (ctx: AIContext) => void;

const LAYER_FNS: Record<AIFlag, ScoringFn> = {
  AI_SCRIPT_CHECK_BAD_MOVE: aiCheckBadMove,
  AI_SCRIPT_TRY_TO_FAINT: aiTryToFaint,
  AI_SCRIPT_CHECK_VIABILITY: aiCheckViability,
  AI_SCRIPT_SETUP_FIRST_TURN: aiSetupFirstTurn,
  AI_SCRIPT_RISKY: aiRisky,
  AI_SCRIPT_PREFER_POWER_EXTREMES: aiPreferPowerExtremes,
  AI_SCRIPT_PREFER_BATON_PASS: aiPreferBatonPass,
  AI_SCRIPT_HP_AWARE: aiHPAware,
  AI_SCRIPT_TRY_SUNNY_DAY_START: aiTrySunnyDayStart,
};

// ── Public API ───────────────────────────────────────────────────────

export function scoreMoves(
  battle: Battle,
  aiSide: Side,
  playerSide: Side,
  flags: AIFlag[],
): number[] {
  const active = aiSide.active[0];
  if (!active) return [0, 0, 0, 0];

  const scores = [100, 100, 100, 100];

  for (let i = 0; i < 4; i++) {
    const move = active.moveSlots[i];
    if (!move || move.pp <= 0 || move.disabled) {
      scores[i] = 0;
    }
  }

  const target = playerSide.active[0];
  if (!target) return scores;

  for (const flag of FLAG_ORDER) {
    if (!flags.includes(flag)) continue;

    for (let i = 0; i < 4; i++) {
      if (scores[i] === 0) continue;

      const ctx: AIContext = {
        scores,
        moveIdx: i,
        battle,
        aiMon: active,
        targetMon: target,
        aiSide,
        playerSide,
      };

      LAYER_FNS[flag](ctx);

      if (scores[i] < 0) scores[i] = 0;
    }
  }

  return scores;
}

export function pickMoveFromScores(scores: number[]): number {
  const max = Math.max(...scores);
  if (max === 0) return 0;
  const candidates = scores
    .map((s, i) => ({ s, i }))
    .filter(x => x.s === max);
  return candidates[Math.floor(Math.random() * candidates.length)].i;
}

// ── AI_TryToFaint ────────────────────────────────────────────────────

function aiTryToFaint(ctx: AIContext): void {
  if (canFaint(ctx)) {
    const effect = getMoveEffect(ctx);
    if (effect === E.EXPLOSION) return;
    if (effect === E.QUICK_ATTACK) adj(ctx, +2);
    adj(ctx, +4);
    return;
  }
  if (getHowPowerful(ctx) !== POWER_MOST) { adj(ctx, -1); return; }
  if (ctxTypeEff(ctx) >= 4) {
    if (rng(80)) return;
    adj(ctx, +2);
  }
}

// ── AI_SetupFirstTurn ────────────────────────────────────────────────

function aiSetupFirstTurn(ctx: AIContext): void {
  if ((ctx.battle.turn ?? 0) !== 0) return;
  const effect = getMoveEffect(ctx);
  if (!SETUP_FIRST_TURN_EFFECTS.has(effect)) return;
  if (rng(80)) return;
  adj(ctx, +2);
}

// ── AI_Risky ─────────────────────────────────────────────────────────

function aiRisky(ctx: AIContext): void {
  const effect = getMoveEffect(ctx);
  if (!RISKY_EFFECTS.has(effect)) return;
  if (rng(128)) return;
  adj(ctx, +2);
}

// ── AI_PreferPowerExtremes ───────────────────────────────────────────
// Encourages moves classified as MOVE_POWER_OTHER (status/special damage)

function aiPreferPowerExtremes(ctx: AIContext): void {
  if (getHowPowerful(ctx) !== POWER_OTHER) return;
  if (rng(100)) return;
  adj(ctx, +2);
}

// ── AI_PreferBatonPass ───────────────────────────────────────────────

function aiPreferBatonPass(ctx: AIContext): void {
  if (countUsablePartyMons(ctx.aiSide) === 0) return;
  if (getHowPowerful(ctx) !== POWER_OTHER) return;

  const moveId = getMoveId(ctx);
  const effect = getMoveEffect(ctx);
  const hasBatonPass = monHasMoveWithEffect(ctx.aiMon, E.BATON_PASS);

  if (!hasBatonPass && rng(80)) return;

  if (BATON_PASS_SETUP_MOVES.has(moveId)) {
    // Swords Dance / Dragon Dance / Calm Mind → BatonPass2
    if ((ctx.battle.turn ?? 0) === 0) { adj(ctx, +5); return; }
    if (hpPct(ctx.aiMon) < 60) { adj(ctx, -10); return; }
    adj(ctx, +1);
    return;
  }

  if (effect === E.PROTECT) {
    // PreferBatonPass_End path
    const lastId = ctx.aiMon.lastMove?.id ?? '';
    if (lastId === 'protect' || lastId === 'detect') { adj(ctx, -2); return; }
    adj(ctx, +2);
    return;
  }

  if (moveId === 'batonpass') {
    // EncourageIfHighStats
    if ((ctx.battle.turn ?? 0) === 0) { adj(ctx, -2); return; }
    const atkStage = statStage(ctx.aiMon, 'atk');
    if (atkStage > DEFAULT_STAT_STAGE + 2) { adj(ctx, +3); return; }
    if (atkStage > DEFAULT_STAT_STAGE + 1) { adj(ctx, +2); return; }
    if (atkStage > DEFAULT_STAT_STAGE) { adj(ctx, +1); return; }
    const spatkStage = statStage(ctx.aiMon, 'spatk');
    if (spatkStage > DEFAULT_STAT_STAGE + 2) { adj(ctx, +3); return; }
    if (spatkStage > DEFAULT_STAT_STAGE + 1) { adj(ctx, +2); return; }
    if (spatkStage > DEFAULT_STAT_STAGE) { adj(ctx, +1); return; }
    return;
  }

  // Other non-attacking moves
  if (rng(20)) return;
  adj(ctx, +3);

  // Fall through to BatonPass2 path for non-setup non-attacking moves
  if ((ctx.battle.turn ?? 0) === 0) { adj(ctx, +5); return; }
  if (hpPct(ctx.aiMon) < 60) { adj(ctx, -10); return; }
  adj(ctx, +1);
}

// ── AI_TrySunnyDayStart ──────────────────────────────────────────────

function aiTrySunnyDayStart(ctx: AIContext): void {
  const moveId = getMoveId(ctx);
  if (moveId !== 'sunnyday') return;
  if ((ctx.aiMon.activeTurns ?? 0) > 1) return;
  adj(ctx, +5);
}
