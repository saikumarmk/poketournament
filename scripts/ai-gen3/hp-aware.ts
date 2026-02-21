/**
 * AI_HPAware — transpiled from pokeemerald/data/battle_ai_scripts.s lines 2935-3195
 *
 * Discourages moves based on HP thresholds for both user and target.
 * Uses effect lookup tables for each HP tier.
 */
import { getEffect } from './effect-map.js';
import {
  HP_AWARE_DISCOURAGED_USER_HIGH,
  HP_AWARE_DISCOURAGED_USER_MED,
  HP_AWARE_DISCOURAGED_USER_LOW,
  HP_AWARE_DISCOURAGED_TARGET_HIGH,
  HP_AWARE_DISCOURAGED_TARGET_MED,
  HP_AWARE_DISCOURAGED_TARGET_LOW,
} from './tables.js';
import {
  type AIContext, adj, getMoveEffect, hpPct, rng,
} from './helpers.js';

export function aiHPAware(ctx: AIContext): void {
  const effect = getMoveEffect(ctx);

  // User HP check
  const userHp = hpPct(ctx.aiMon);
  let discouragedByUser = false;
  if (userHp > 70) {
    discouragedByUser = HP_AWARE_DISCOURAGED_USER_HIGH.has(effect);
  } else if (userHp > 30) {
    discouragedByUser = HP_AWARE_DISCOURAGED_USER_MED.has(effect);
  } else {
    discouragedByUser = HP_AWARE_DISCOURAGED_USER_LOW.has(effect);
  }
  if (discouragedByUser && !rng(50)) adj(ctx, -2);

  // Target HP check
  const targetHp = hpPct(ctx.targetMon);
  let discouragedByTarget = false;
  if (targetHp > 70) {
    discouragedByTarget = HP_AWARE_DISCOURAGED_TARGET_HIGH.has(effect);
  } else if (targetHp > 30) {
    discouragedByTarget = HP_AWARE_DISCOURAGED_TARGET_MED.has(effect);
  } else {
    discouragedByTarget = HP_AWARE_DISCOURAGED_TARGET_LOW.has(effect);
  }
  if (discouragedByTarget && !rng(50)) adj(ctx, -2);
}
