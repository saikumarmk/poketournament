/**
 * AI_CheckViability — transpiled from pokeemerald/data/battle_ai_scripts.s lines 652-2614
 *
 * The "smart" evaluator: ~120 effect-specific handlers that encourage or
 * discourage moves based on detailed battle state analysis.
 * Score adjustments can be positive (encourage) or negative (discourage).
 *
 * Bug-compatible with original Emerald (BUGFIX sections use #else branch).
 */
import { E, getEffect } from './effect-map.js';
import {
  PHYSICAL_TYPES, SPECIAL_TYPES, SANDSTORM_RESISTANT_TYPES,
  ATTACK_DOWN_PHYSICAL_TYPES, MIRROR_MOVE_ENCOURAGED, PROTECT_MOVES,
  ENCORE_ENCOURAGED_EFFECTS, THIEF_ENCOURAGED_ITEMS,
  ROLE_PLAY_ENCOURAGED_ABILITIES, TRICK_CHOICE_ITEMS,
  TRICK_CONFUSE_ITEMS, RECYCLE_ENCOURAGED_ITEMS,
  BATON_PASS_SETUP_MOVES,
} from './tables.js';
import {
  type AIContext, adj, getMoveId, getMoveEffect, getMoveType,
  ctxTypeEff, hpPct, statStage, rng, targetFaster, userFaster,
  hasStatus, hasStatusCond, hasVolatile, hasSideCond,
  getWeather, Weather, countUsablePartyMons, isFirstTurnFor,
  monHasMove, monHasMoveWithEffect, getHeldItem,
  getLastMoveId, getLastMovePower, getLastMoveType, getLastMoveEffect,
  DEFAULT_STAT_STAGE,
} from './helpers.js';

export function aiCheckViability(ctx: AIContext): void {
  const effect = getMoveEffect(ctx);

  switch (effect) {
    case E.SLEEP: return cvSleep(ctx);
    case E.ABSORB: return cvAbsorb(ctx);
    case E.EXPLOSION: case E.MEMENTO: return cvSelfKO(ctx);
    case E.DREAM_EATER: return cvDreamEater(ctx);
    case E.MIRROR_MOVE: return cvMirrorMove(ctx);
    case E.ATTACK_UP: case E.ATTACK_UP_2: return cvAttackUp(ctx);
    case E.DEFENSE_UP: case E.DEFENSE_UP_2: case E.BULK_UP:
      return cvDefenseUp(ctx);
    case E.SPEED_UP: case E.SPEED_UP_2: return cvSpeedUp(ctx);
    case E.SPECIAL_ATTACK_UP: case E.SPECIAL_ATTACK_UP_2:
      return cvSpAtkUp(ctx);
    case E.SPECIAL_DEFENSE_UP: case E.SPECIAL_DEFENSE_UP_2:
    case E.COSMIC_POWER: case E.CALM_MIND:
      return cvSpDefUp(ctx);
    case E.ACCURACY_UP: case E.ACCURACY_UP_2: return cvAccuracyUp(ctx);
    case E.EVASION_UP: case E.EVASION_UP_2: case E.MINIMIZE:
      return cvEvasionUp(ctx);
    case E.ALWAYS_HIT: return cvAlwaysHit(ctx);
    case E.ATTACK_DOWN: case E.ATTACK_DOWN_2: return cvAttackDown(ctx);
    case E.DEFENSE_DOWN: case E.DEFENSE_DOWN_2: case E.TICKLE:
      return cvDefenseDown(ctx);
    case E.SPEED_DOWN: case E.SPEED_DOWN_2: return cvSpeedDown(ctx);
    case E.SPEED_DOWN_HIT: return cvSpeedDownHit(ctx);
    case E.SPECIAL_ATTACK_DOWN: case E.SPECIAL_ATTACK_DOWN_2:
      return cvSpAtkDown(ctx);
    case E.SPECIAL_DEFENSE_DOWN: case E.SPECIAL_DEFENSE_DOWN_2:
      return cvSpDefDown(ctx);
    case E.ACCURACY_DOWN: case E.ACCURACY_DOWN_2:
      return cvAccuracyDown(ctx);
    case E.EVASION_DOWN: case E.EVASION_DOWN_2: return cvEvasionDown(ctx);
    case E.HAZE: return cvHaze(ctx);
    case E.BIDE: return cvBide(ctx);
    case E.ROAR: return cvRoar(ctx);
    case E.CONVERSION: return cvConversion(ctx);
    case E.RESTORE_HP: case E.SOFTBOILED: case E.SWALLOW:
      return cvHeal(ctx);
    case E.TOXIC: case E.LEECH_SEED: return cvToxic(ctx);
    case E.LIGHT_SCREEN: return cvLightScreen(ctx);
    case E.REST: return cvRest(ctx);
    case E.OHKO: return; // no additional scoring
    case E.RAZOR_WIND: case E.SKY_ATTACK: case E.SKULL_BASH:
    case E.SOLAR_BEAM:
      return cvChargeUpMove(ctx);
    case E.SUPER_FANG: return cvSuperFang(ctx);
    case E.TRAP: case E.MEAN_LOOK: return cvTrap(ctx);
    case E.HIGH_CRITICAL: case E.BLAZE_KICK: case E.POISON_TAIL:
      return cvHighCrit(ctx);
    case E.CONFUSE: return cvConfuse(ctx);
    case E.SWAGGER: return cvSwagger(ctx);
    case E.FLATTER: return cvFlatter(ctx);
    case E.REFLECT: return cvReflect(ctx);
    case E.POISON: return cvPoison(ctx);
    case E.PARALYZE: return cvParalyze(ctx);
    case E.VITAL_THROW: return cvVitalThrow(ctx);
    case E.SUBSTITUTE: return cvSubstitute(ctx);
    case E.RECHARGE: return cvRecharge(ctx);
    case E.DISABLE: return cvDisable(ctx);
    case E.COUNTER: return cvCounter(ctx);
    case E.ENCORE: return cvEncore(ctx);
    case E.PAIN_SPLIT: return cvPainSplit(ctx);
    case E.SNORE: adj(ctx, +2); return;
    case E.LOCK_ON: return cvLockOn(ctx);
    case E.SLEEP_TALK: return cvSleepTalk(ctx);
    case E.DESTINY_BOND: return cvDestinyBond(ctx);
    case E.FLAIL: return cvFlail(ctx);
    case E.HEAL_BELL: return cvHealBell(ctx);
    case E.THIEF: return cvThief(ctx);
    case E.CURSE: return cvCurse(ctx);
    case E.PROTECT: return cvProtect(ctx);
    case E.FORESIGHT: return cvForesight(ctx);
    case E.ENDURE: return cvEndure(ctx);
    case E.BATON_PASS: return cvBatonPass(ctx);
    case E.PURSUIT: return cvPursuit(ctx);
    case E.MORNING_SUN: case E.SYNTHESIS: case E.MOONLIGHT:
      return cvHealWeather(ctx);
    case E.RAIN_DANCE: return cvRainDance(ctx);
    case E.SUNNY_DAY: return cvSunnyDay(ctx);
    case E.BELLY_DRUM: return cvBellyDrum(ctx);
    case E.PSYCH_UP: return cvPsychUp(ctx);
    case E.MIRROR_COAT: return cvMirrorCoat(ctx);
    case E.SEMI_INVULNERABLE: return cvSemiInvulnerable(ctx);
    case E.FAKE_OUT: adj(ctx, +2); return;
    case E.SPIT_UP: return cvSpitUp(ctx);
    case E.HAIL: return cvHail(ctx);
    case E.FACADE: return cvFacade(ctx);
    case E.FOCUS_PUNCH: return cvFocusPunch(ctx);
    case E.SMELLINGSALT: return cvSmellingSalt(ctx);
    case E.TRICK: return cvTrick(ctx);
    case E.ROLE_PLAY: case E.SKILL_SWAP: return cvChangeSelfAbility(ctx);
    case E.SUPERPOWER: return cvSuperpower(ctx);
    case E.MAGIC_COAT: return cvMagicCoat(ctx);
    case E.RECYCLE: return cvRecycle(ctx);
    case E.REVENGE: return cvRevenge(ctx);
    case E.BRICK_BREAK: return cvBrickBreak(ctx);
    case E.KNOCK_OFF: return cvKnockOff(ctx);
    case E.ENDEAVOR: return cvEndeavor(ctx);
    case E.ERUPTION: return cvEruption(ctx);
    case E.IMPRISON: return cvImprison(ctx);
    case E.REFRESH: return cvRefresh(ctx);
    case E.SNATCH: return cvSnatch(ctx);
    case E.MUD_SPORT: return cvMudSport(ctx);
    case E.OVERHEAT: return cvOverheat(ctx);
    case E.WATER_SPORT: return cvWaterSport(ctx);
    case E.DRAGON_DANCE: return cvDragonDance(ctx);
    default: break;
  }
}

// ── Handlers ─────────────────────────────────────────────────────────

function cvSleep(ctx: AIContext) {
  // BUG: original checks TARGET for Dream Eater/Nightmare instead of USER
  if (monHasMoveWithEffect(ctx.targetMon, E.DREAM_EATER) ||
      monHasMoveWithEffect(ctx.targetMon, E.NIGHTMARE)) {
    if (rng(128)) return;
    adj(ctx, +1);
  }
}

function cvAbsorb(ctx: AIContext) {
  const eff = ctxTypeEff(ctx);
  if (eff === 0.5 || eff === 0.25) {
    if (!rng(50)) adj(ctx, -3);
  }
}

function cvSelfKO(ctx: AIContext) {
  const tEva = statStage(ctx.targetMon, 'evasion');
  if (tEva >= 7) adj(ctx, -1);
  if (tEva >= 10 && rng(128)) adj(ctx, -1);

  if (hpPct(ctx.aiMon) >= 80 && !targetFaster(ctx)) {
    if (!rng(50)) { adj(ctx, -3); return; }
  }
  if (hpPct(ctx.aiMon) <= 50) {
    if (rng(128)) adj(ctx, +1);
    if (hpPct(ctx.aiMon) <= 30 && !rng(50)) adj(ctx, +1);
  } else {
    if (!rng(50)) adj(ctx, -1);
  }
}

function cvDreamEater(ctx: AIContext) {
  const eff = ctxTypeEff(ctx);
  if (eff === 0.25 || eff === 0.5) adj(ctx, -1);
}

function cvMirrorMove(ctx: AIContext) {
  if (!targetFaster(ctx)) {
    const lastMove = getLastMoveId(ctx.targetMon);
    if (lastMove && MIRROR_MOVE_ENCOURAGED.has(lastMove)) {
      if (!rng(128)) adj(ctx, +2);
      return;
    }
  }
  const lastMove = getLastMoveId(ctx.targetMon);
  if (lastMove && !MIRROR_MOVE_ENCOURAGED.has(lastMove)) {
    if (!rng(80)) adj(ctx, -1);
  }
}

function cvAttackUp(ctx: AIContext) {
  if (statStage(ctx.aiMon, 'atk') >= 9) {
    if (!rng(100)) adj(ctx, -1);
  } else {
    if (hpPct(ctx.aiMon) === 100 && !rng(128)) adj(ctx, +2);
  }
  if (hpPct(ctx.aiMon) <= 70) {
    if (hpPct(ctx.aiMon) < 40 || !rng(40)) adj(ctx, -2);
  }
}

function cvDefenseUp(ctx: AIContext) {
  if (statStage(ctx.aiMon, 'def') >= 9) {
    if (!rng(100)) adj(ctx, -1);
  } else {
    if (hpPct(ctx.aiMon) === 100 && !rng(128)) adj(ctx, +2);
  }
  if (hpPct(ctx.aiMon) < 70) {
    if (hpPct(ctx.aiMon) < 40) { adj(ctx, -2); return; }
    const lastPow = getLastMovePower(ctx.targetMon, ctx.battle);
    if (lastPow > 0) {
      const lastType = getLastMoveType(ctx.targetMon, ctx.battle);
      if (!PHYSICAL_TYPES.has(lastType)) { adj(ctx, -2); return; }
      if (!rng(60)) return;
    }
    if (!rng(60)) return;
    adj(ctx, -2);
  }
}

function cvSpeedUp(ctx: AIContext) {
  if (!targetFaster(ctx)) { adj(ctx, -3); return; }
  if (!rng(70)) return;
  adj(ctx, +3);
}

function cvSpAtkUp(ctx: AIContext) {
  if (statStage(ctx.aiMon, 'spatk') >= 9) {
    if (!rng(100)) adj(ctx, -1);
  } else {
    if (hpPct(ctx.aiMon) === 100 && !rng(128)) adj(ctx, +2);
  }
  if (hpPct(ctx.aiMon) <= 70) {
    if (hpPct(ctx.aiMon) < 40 || !rng(70)) adj(ctx, -2);
  }
}

function cvSpDefUp(ctx: AIContext) {
  if (statStage(ctx.aiMon, 'spdef') >= 9) {
    if (!rng(100)) adj(ctx, -1);
  } else {
    if (hpPct(ctx.aiMon) === 100 && !rng(128)) adj(ctx, +2);
  }
  if (hpPct(ctx.aiMon) < 70) {
    if (hpPct(ctx.aiMon) < 40) { adj(ctx, -2); return; }
    const lastPow = getLastMovePower(ctx.targetMon, ctx.battle);
    if (lastPow > 0) {
      const lastType = getLastMoveType(ctx.targetMon, ctx.battle);
      if (PHYSICAL_TYPES.has(lastType)) { adj(ctx, -2); return; }
      if (!rng(60)) return;
    }
    if (!rng(60)) return;
    adj(ctx, -2);
  }
}

function cvAccuracyUp(ctx: AIContext) {
  if (statStage(ctx.aiMon, 'acc') >= 9 && !rng(50)) adj(ctx, -2);
  if (hpPct(ctx.aiMon) <= 70) adj(ctx, -2);
}

function cvEvasionUp(ctx: AIContext) {
  if (hpPct(ctx.aiMon) >= 90 && !rng(100)) adj(ctx, +3);
  if (statStage(ctx.aiMon, 'evasion') >= 9 && !rng(128)) adj(ctx, -1);

  if (hasStatusCond(ctx.targetMon, 'tox')) {
    if (hpPct(ctx.aiMon) > 50 || !rng(80)) {
      if (!rng(50)) adj(ctx, +3);
    }
  }
  if (hasVolatile(ctx.targetMon, 'leechseed') && !rng(70)) adj(ctx, +3);
  if (hasVolatile(ctx.aiMon, 'ingrain') && !rng(128)) adj(ctx, +2);
  if (hasVolatile(ctx.targetMon, 'curse') && !rng(70)) adj(ctx, +3);

  if (hpPct(ctx.aiMon) <= 70) {
    if (statStage(ctx.aiMon, 'evasion') === DEFAULT_STAT_STAGE) return;
    if (hpPct(ctx.aiMon) < 40 || hpPct(ctx.targetMon) < 40 || !rng(70))
      adj(ctx, -2);
  }
}

function cvAlwaysHit(ctx: AIContext) {
  if (statStage(ctx.targetMon, 'evasion') > 10 ||
      statStage(ctx.aiMon, 'acc') < 2) {
    adj(ctx, +1);
  }
  if (statStage(ctx.targetMon, 'evasion') > 8 ||
      statStage(ctx.aiMon, 'acc') < 4) {
    if (!rng(100)) adj(ctx, +1);
  }
}

function cvAttackDown(ctx: AIContext) {
  if (statStage(ctx.targetMon, 'atk') === DEFAULT_STAT_STAGE) {
    // skip to type check
  } else {
    adj(ctx, -1);
    if (hpPct(ctx.aiMon) > 90) adj(ctx, -1);
    if (statStage(ctx.targetMon, 'atk') > 3 && !rng(50)) adj(ctx, -2);
  }
  if (hpPct(ctx.targetMon) <= 70) adj(ctx, -2);

  // Discourage if target isn't physical type (original missing Flying/Poison/Ghost)
  if (!ATTACK_DOWN_PHYSICAL_TYPES.has(ctx.targetMon.types[0]) &&
      (!ctx.targetMon.types[1] || !ATTACK_DOWN_PHYSICAL_TYPES.has(ctx.targetMon.types[1]))) {
    if (!rng(50)) adj(ctx, -2);
  }
}

function cvDefenseDown(ctx: AIContext) {
  if (hpPct(ctx.aiMon) >= 70 && statStage(ctx.targetMon, 'def') <= 3) {
    if (!rng(50)) adj(ctx, -2);
  }
  if (hpPct(ctx.targetMon) <= 70) adj(ctx, -2);
}

function cvSpeedDownHit(ctx: AIContext) {
  const id = getMoveId(ctx);
  if (id === 'icywind' || id === 'rocktomb' || id === 'mudshot') {
    cvSpeedDown(ctx);
  }
}

function cvSpeedDown(ctx: AIContext) {
  if (!targetFaster(ctx)) { adj(ctx, -3); return; }
  if (!rng(70)) return;
  adj(ctx, +2);
}

function cvSpAtkDown(ctx: AIContext) {
  if (statStage(ctx.targetMon, 'spatk') === DEFAULT_STAT_STAGE) {
    // skip
  } else {
    adj(ctx, -1);
    if (hpPct(ctx.aiMon) > 90) adj(ctx, -1);
    if (statStage(ctx.targetMon, 'spatk') > 3 && !rng(50)) adj(ctx, -2);
  }
  if (hpPct(ctx.targetMon) <= 70) adj(ctx, -2);
  if (!SPECIAL_TYPES.has(ctx.targetMon.types[0]) &&
      (!ctx.targetMon.types[1] || !SPECIAL_TYPES.has(ctx.targetMon.types[1]))) {
    if (!rng(50)) adj(ctx, -2);
  }
}

function cvSpDefDown(ctx: AIContext) {
  if (hpPct(ctx.aiMon) >= 70 && statStage(ctx.targetMon, 'spdef') <= 3) {
    if (!rng(50)) adj(ctx, -2);
  }
  if (hpPct(ctx.targetMon) <= 70) adj(ctx, -2);
}

function cvAccuracyDown(ctx: AIContext) {
  if (hpPct(ctx.aiMon) >= 70 && hpPct(ctx.targetMon) <= 70) {
    // skip to stat check
  } else {
    if (!rng(100)) adj(ctx, -1);
  }
  if (statStage(ctx.aiMon, 'acc') <= 4 && !rng(80)) adj(ctx, -2);

  if (hasStatusCond(ctx.targetMon, 'tox') && !rng(70)) adj(ctx, +2);
  if (hasVolatile(ctx.targetMon, 'leechseed') && !rng(70)) adj(ctx, +2);
  if (hasVolatile(ctx.aiMon, 'ingrain') && !rng(128)) adj(ctx, +1);
  if (hasVolatile(ctx.targetMon, 'curse') && !rng(70)) adj(ctx, +2);

  if (hpPct(ctx.aiMon) <= 70) {
    if (statStage(ctx.targetMon, 'acc') === DEFAULT_STAT_STAGE) return;
    if (hpPct(ctx.aiMon) < 40 || hpPct(ctx.targetMon) < 40 || !rng(70))
      adj(ctx, -2);
  }
}

function cvEvasionDown(ctx: AIContext) {
  if (hpPct(ctx.aiMon) >= 70 && statStage(ctx.targetMon, 'evasion') <= 3) {
    if (!rng(50)) adj(ctx, -2);
  }
  if (hpPct(ctx.targetMon) <= 70) adj(ctx, -2);
}

function cvHaze(ctx: AIContext) {
  const u = ctx.aiMon;
  const t = ctx.targetMon;
  // Check if user's own stats are boosted high
  if (statStage(u, 'atk') > 8 || statStage(u, 'def') > 8 ||
      statStage(u, 'spatk') > 8 || statStage(u, 'spdef') > 8 ||
      statStage(u, 'evasion') > 8 ||
      statStage(t, 'atk') < 4 || statStage(t, 'def') < 4 ||
      statStage(t, 'spatk') < 4 || statStage(t, 'spdef') < 4 ||
      statStage(t, 'acc') < 4) {
    if (!rng(50)) adj(ctx, -3);
  }
  // Check if target's stats are boosted high
  if (statStage(t, 'atk') > 8 || statStage(t, 'def') > 8 ||
      statStage(t, 'spatk') > 8 || statStage(t, 'spdef') > 8 ||
      statStage(t, 'evasion') > 8 ||
      statStage(u, 'atk') < 4 || statStage(u, 'def') < 4 ||
      statStage(u, 'spatk') < 4 || statStage(u, 'spdef') < 4 ||
      statStage(u, 'acc') < 4) {
    if (!rng(50)) adj(ctx, +3);
  } else {
    if (!rng(50)) adj(ctx, -1);
  }
}

function cvBide(ctx: AIContext) {
  if (hpPct(ctx.aiMon) <= 90) adj(ctx, -2);
}

function cvRoar(ctx: AIContext) {
  const t = ctx.targetMon;
  if (statStage(t, 'atk') > 8 || statStage(t, 'def') > 8 ||
      statStage(t, 'spatk') > 8 || statStage(t, 'spdef') > 8 ||
      statStage(t, 'evasion') > 8) {
    if (!rng(128)) adj(ctx, +2);
  } else {
    adj(ctx, -3);
  }
}

function cvConversion(ctx: AIContext) {
  if (hpPct(ctx.aiMon) <= 90) adj(ctx, -2);
  if ((ctx.battle.turn ?? 0) > 0 && !rng(200)) adj(ctx, -2);
}

function cvHealWeather(ctx: AIContext) {
  const w = getWeather(ctx.battle);
  if (w === Weather.HAIL || w === Weather.RAIN || w === Weather.SANDSTORM) {
    adj(ctx, -2);
  }
  cvHeal(ctx);
}

function cvHeal(ctx: AIContext) {
  if (hpPct(ctx.aiMon) === 100) { adj(ctx, -3); return; }
  if (!targetFaster(ctx)) { adj(ctx, -8); return; }

  if (hpPct(ctx.aiMon) >= 70 || (!rng(30) && hpPct(ctx.aiMon) >= 50)) {
    adj(ctx, -3); return;
  }

  if (monHasMoveWithEffect(ctx.targetMon, E.SNATCH) && !rng(100)) return;
  if (!rng(20)) return;
  adj(ctx, +2);
}

function cvToxic(ctx: AIContext) {
  const noAtk = !ctx.aiMon.moveSlots.some(m => {
    const move = ctx.battle.dex.moves.get(m.id);
    return move.basePower > 0;
  });
  if (!noAtk) {
    if (hpPct(ctx.aiMon) <= 50 && !rng(50)) adj(ctx, -3);
    if (hpPct(ctx.targetMon) <= 50 && !rng(50)) adj(ctx, -3);
  }
  if (monHasMoveWithEffect(ctx.aiMon, E.SPECIAL_DEFENSE_UP) ||
      monHasMoveWithEffect(ctx.aiMon, E.PROTECT)) {
    if (!rng(60)) adj(ctx, +2);
  }
}

function cvLightScreen(ctx: AIContext) {
  if (hpPct(ctx.aiMon) < 50) { adj(ctx, -2); return; }
  if (SPECIAL_TYPES.has(ctx.targetMon.types[0]) ||
      (ctx.targetMon.types[1] && SPECIAL_TYPES.has(ctx.targetMon.types[1]))) {
    return;
  }
  if (!rng(50)) adj(ctx, -2);
}

function cvRest(ctx: AIContext) {
  if (!targetFaster(ctx)) {
    if (hpPct(ctx.aiMon) === 100) { adj(ctx, -8); return; }
    if (hpPct(ctx.aiMon) >= 40 && (hpPct(ctx.aiMon) > 50 || !rng(70))) {
      adj(ctx, -3); return;
    }
  } else {
    if (hpPct(ctx.aiMon) >= 60 && (hpPct(ctx.aiMon) > 70 || !rng(50))) {
      adj(ctx, -3); return;
    }
  }
  if (monHasMoveWithEffect(ctx.targetMon, E.SNATCH) && !rng(50)) return;
  if (!rng(10)) return;
  adj(ctx, +3);
}

function cvSuperFang(ctx: AIContext) {
  if (hpPct(ctx.targetMon) <= 50) adj(ctx, -1);
}

function cvTrap(ctx: AIContext) {
  if (hasStatusCond(ctx.targetMon, 'tox') ||
      hasVolatile(ctx.targetMon, 'curse') ||
      hasVolatile(ctx.targetMon, 'perishsong') ||
      hasVolatile(ctx.targetMon, 'attract')) {
    if (!rng(128)) adj(ctx, +1);
  }
}

function cvHighCrit(ctx: AIContext) {
  const eff = ctxTypeEff(ctx);
  if (eff === 0.25 || eff === 0.5) return;
  if (eff === 2 || eff === 4) {
    if (!rng(128)) adj(ctx, +1);
    return;
  }
  if (rng(128)) return;
  if (!rng(128)) return;
  adj(ctx, +1);
}

function cvSwagger(ctx: AIContext) {
  if (monHasMove(ctx.aiMon, 'psychup')) {
    if (statStage(ctx.targetMon, 'atk') > 3) { adj(ctx, -5); return; }
    adj(ctx, +3);
    if ((ctx.battle.turn ?? 0) === 0) adj(ctx, +2);
    return;
  }
  cvFlatter(ctx);
}

function cvFlatter(ctx: AIContext) {
  if (!rng(128)) adj(ctx, +1);
  cvConfuse(ctx);
}

function cvConfuse(ctx: AIContext) {
  if (hpPct(ctx.targetMon) <= 70) {
    if (!rng(128)) adj(ctx, -1);
    if (hpPct(ctx.targetMon) <= 50) {
      adj(ctx, -1);
      if (hpPct(ctx.targetMon) <= 30) adj(ctx, -1);
    }
  }
}

function cvReflect(ctx: AIContext) {
  if (hpPct(ctx.aiMon) < 50) { adj(ctx, -2); return; }
  if (PHYSICAL_TYPES.has(ctx.targetMon.types[0]) ||
      (ctx.targetMon.types[1] && PHYSICAL_TYPES.has(ctx.targetMon.types[1]))) {
    return;
  }
  if (!rng(50)) adj(ctx, -2);
}

function cvPoison(ctx: AIContext) {
  if (hpPct(ctx.aiMon) < 50 || hpPct(ctx.targetMon) <= 50) adj(ctx, -1);
}

function cvParalyze(ctx: AIContext) {
  if (!targetFaster(ctx)) {
    if (hpPct(ctx.aiMon) <= 70) adj(ctx, -1);
    return;
  }
  if (!rng(20)) return;
  adj(ctx, +3);
}

function cvVitalThrow(ctx: AIContext) {
  if (targetFaster(ctx)) return;
  if (hpPct(ctx.aiMon) > 60) return;
  if (hpPct(ctx.aiMon) >= 40 && !rng(180)) return;
  if (!rng(50)) return;
  adj(ctx, -1);
}

function cvSubstitute(ctx: AIContext) {
  if (hpPct(ctx.aiMon) <= 90) {
    if (hpPct(ctx.aiMon) <= 70 && !rng(100)) adj(ctx, -1);
    if (hpPct(ctx.aiMon) <= 50 && !rng(100)) adj(ctx, -1);
    if (!rng(100)) adj(ctx, -1);
  }
  if (targetFaster(ctx)) return;
  const lastEff = getLastMoveEffect(ctx.targetMon);
  if (lastEff === E.SLEEP || lastEff === E.TOXIC || lastEff === E.POISON ||
      lastEff === E.PARALYZE || lastEff === E.WILL_O_WISP) {
    if (!hasStatus(ctx.targetMon) && !rng(100)) adj(ctx, +1);
  } else if (lastEff === E.CONFUSE) {
    if (!hasVolatile(ctx.targetMon, 'confusion') && !rng(100)) adj(ctx, +1);
  } else if (lastEff === E.LEECH_SEED) {
    if (!hasVolatile(ctx.targetMon, 'leechseed') && !rng(100)) adj(ctx, +1);
  }
}

function cvRecharge(ctx: AIContext) {
  const eff = ctxTypeEff(ctx);
  if (eff === 0.25 || eff === 0.5) { adj(ctx, -1); return; }
  if (!targetFaster(ctx) && hpPct(ctx.aiMon) > 40) { adj(ctx, -1); return; }
  if (targetFaster(ctx) && hpPct(ctx.aiMon) >= 60) adj(ctx, -1);
}

function cvDisable(ctx: AIContext) {
  if (targetFaster(ctx)) return;
  const lastPow = getLastMovePower(ctx.targetMon, ctx.battle);
  if (lastPow > 0) { adj(ctx, +1); return; }
  if (!rng(100)) adj(ctx, -1);
}

function cvCounter(ctx: AIContext) {
  // BUG: original scores up Counter when target types are NOT physical
  if (hasStatusCond(ctx.targetMon, 'slp') ||
      hasVolatile(ctx.targetMon, 'attract') ||
      hasVolatile(ctx.targetMon, 'confusion')) {
    adj(ctx, -1); return;
  }
  if (hpPct(ctx.aiMon) <= 30 && !rng(10)) adj(ctx, -1);
  if (hpPct(ctx.aiMon) <= 50 && !rng(100)) adj(ctx, -1);

  if (monHasMove(ctx.aiMon, 'mirrorcoat')) {
    if (!rng(100)) adj(ctx, +4);
    return;
  }

  const lastPow = getLastMovePower(ctx.targetMon, ctx.battle);
  if (lastPow > 0) {
    const lastType = getLastMoveType(ctx.targetMon, ctx.battle);
    if (!PHYSICAL_TYPES.has(lastType)) { adj(ctx, -1); return; }
    if (!rng(100)) adj(ctx, +1);
    return;
  }

  // Buggy: checks target types, scores up if physical (wrong for Counter)
  if (PHYSICAL_TYPES.has(ctx.targetMon.types[0]) ||
      (ctx.targetMon.types[1] && PHYSICAL_TYPES.has(ctx.targetMon.types[1]))) {
    return; // original falls through without scoring
  }
  if (!rng(50)) {
    if (!rng(100)) adj(ctx, +4);
  }
}

function cvEncore(ctx: AIContext) {
  if (hasVolatile(ctx.targetMon, 'disable') ||
      hasVolatile(ctx.targetMon, 'encore')) {
    if (!rng(30)) { adj(ctx, +3); return; }
    return;
  }
  if (targetFaster(ctx)) { adj(ctx, -2); return; }
  const lastEff = getLastMoveEffect(ctx.targetMon);
  if (!ENCORE_ENCOURAGED_EFFECTS.has(lastEff)) { adj(ctx, -2); return; }
  if (!rng(30)) { adj(ctx, +3); return; }
}

function cvPainSplit(ctx: AIContext) {
  if (hpPct(ctx.targetMon) < 80) { adj(ctx, -1); return; }
  if (!targetFaster(ctx)) {
    if (hpPct(ctx.aiMon) > 40) { adj(ctx, -1); return; }
  } else {
    if (hpPct(ctx.aiMon) > 60) { adj(ctx, -1); return; }
  }
  adj(ctx, +1);
}

function cvLockOn(ctx: AIContext) {
  if (!rng(128)) return;
  adj(ctx, +2);
}

function cvSleepTalk(ctx: AIContext) {
  if (hasStatusCond(ctx.aiMon, 'slp')) { adj(ctx, +10); return; }
  adj(ctx, -5);
}

function cvDestinyBond(ctx: AIContext) {
  adj(ctx, -1);
  if (targetFaster(ctx)) return;
  if (hpPct(ctx.aiMon) > 70) return;
  if (!rng(128)) adj(ctx, +1);
  if (hpPct(ctx.aiMon) > 50) return;
  if (!rng(128)) adj(ctx, +1);
  if (hpPct(ctx.aiMon) > 30) return;
  if (!rng(100)) adj(ctx, +2);
}

function cvFlail(ctx: AIContext) {
  if (!targetFaster(ctx)) {
    if (hpPct(ctx.aiMon) > 33) { adj(ctx, -1); return; }
    if (hpPct(ctx.aiMon) <= 20) {
      if (hpPct(ctx.aiMon) < 8) adj(ctx, +1);
      if (!rng(100)) adj(ctx, +1);
    }
    return;
  }
  if (hpPct(ctx.aiMon) > 60) { adj(ctx, -1); return; }
  if (hpPct(ctx.aiMon) > 40) return;
  if (!rng(100)) adj(ctx, +1);
}

function cvHealBell(ctx: AIContext) {
  if (!hasStatus(ctx.aiMon)) {
    let partyHasStatus = false;
    for (const mon of ctx.aiSide.pokemon) {
      if (mon.hp > 0 && !mon.isActive && mon.status) { partyHasStatus = true; break; }
    }
    if (!partyHasStatus) adj(ctx, -5);
  }
}

function cvThief(ctx: AIContext) {
  const item = getHeldItem(ctx.targetMon);
  if (item && THIEF_ENCOURAGED_ITEMS.has(item)) {
    if (!rng(50)) adj(ctx, +1);
  } else {
    adj(ctx, -2);
  }
}

function cvCurse(ctx: AIContext) {
  if (ctx.aiMon.hasType('Ghost')) {
    if (hpPct(ctx.aiMon) <= 80) adj(ctx, -1);
    return;
  }
  if (statStage(ctx.aiMon, 'def') > 9) return;
  if (!rng(128)) adj(ctx, +1);
  if (statStage(ctx.aiMon, 'def') > 7) return;
  if (!rng(128)) adj(ctx, +1);
  if (statStage(ctx.aiMon, 'def') > DEFAULT_STAT_STAGE) return;
  if (!rng(128)) adj(ctx, +1);
}

function cvProtect(ctx: AIContext) {
  const protectCount = ctx.aiMon.volatiles['stall']
    ? ((ctx.aiMon.volatiles['stall'] as any).counter ?? 0) : 0;
  if (protectCount > 1) { adj(ctx, -2); return; }

  // Check if user has residual damage conditions → protect is bad
  if (hasStatusCond(ctx.aiMon, 'tox') || hasVolatile(ctx.aiMon, 'curse') ||
      hasVolatile(ctx.aiMon, 'perishsong') || hasVolatile(ctx.aiMon, 'attract') ||
      hasVolatile(ctx.aiMon, 'leechseed') || hasVolatile(ctx.aiMon, 'yawn') ||
      monHasMoveWithEffect(ctx.targetMon, E.RESTORE_HP) ||
      monHasMoveWithEffect(ctx.targetMon, E.DEFENSE_CURL)) {
    const lastEff = getLastMoveEffect(ctx.targetMon);
    if (lastEff === E.LOCK_ON) { adj(ctx, -2); return; }
    return;
  }

  // Check if target has residual conditions → protect is good
  if (hasStatusCond(ctx.targetMon, 'tox') || hasVolatile(ctx.targetMon, 'curse') ||
      hasVolatile(ctx.targetMon, 'perishsong') || hasVolatile(ctx.targetMon, 'attract') ||
      hasVolatile(ctx.targetMon, 'leechseed') || hasVolatile(ctx.targetMon, 'yawn')) {
    adj(ctx, +2);
  } else {
    const lastEff = getLastMoveEffect(ctx.targetMon);
    if (lastEff === E.LOCK_ON) { /* skip bonus */ }
    else adj(ctx, +2); // original gives +2 here via Score_Plus2 path
  }

  if (!rng(128)) adj(ctx, -1);
  if (protectCount > 0) {
    adj(ctx, -1);
    if (!rng(128)) adj(ctx, -1);
  }
}

function cvForesight(ctx: AIContext) {
  // BUG: original checks USER's types/evasion instead of TARGET's
  if (ctx.aiMon.hasType('Ghost')) {
    if (rng(80)) return;
    if (rng(80)) return;
    adj(ctx, +2);
    return;
  }
  if (statStage(ctx.aiMon, 'evasion') > 8) {
    if (rng(80)) return;
    adj(ctx, +2);
    return;
  }
  adj(ctx, -2);
}

function cvEndure(ctx: AIContext) {
  if (hpPct(ctx.aiMon) < 4) { adj(ctx, -1); return; }
  if (hpPct(ctx.aiMon) < 35) {
    if (!rng(70)) adj(ctx, +1);
    return;
  }
  adj(ctx, -1);
}

function cvBatonPass(ctx: AIContext) {
  const u = ctx.aiMon;
  const highBoost =
    statStage(u, 'atk') > 8 || statStage(u, 'def') > 8 ||
    statStage(u, 'spatk') > 8 || statStage(u, 'spdef') > 8 ||
    statStage(u, 'evasion') > 8;
  const medBoost =
    statStage(u, 'atk') > 7 || statStage(u, 'def') > 7 ||
    statStage(u, 'spatk') > 7 || statStage(u, 'spdef') > 7 ||
    statStage(u, 'evasion') > 7;

  if (highBoost) {
    if (targetFaster(ctx)) {
      if (hpPct(u) < 70) { if (!rng(80)) adj(ctx, +2); return; }
    } else {
      if (hpPct(u) > 60) return;
      if (!rng(80)) adj(ctx, +2);
    }
    return;
  }
  if (medBoost) {
    if (targetFaster(ctx)) {
      if (hpPct(u) >= 70) { adj(ctx, -2); return; }
    } else {
      if (hpPct(u) > 60) { adj(ctx, -2); return; }
    }
    return;
  }
  adj(ctx, -2);
}

function cvPursuit(ctx: AIContext) {
  if (!isFirstTurnFor(ctx.aiMon)) return;
  if (ctx.targetMon.hasType('Ghost') || ctx.targetMon.hasType('Psychic')) {
    if (!rng(128)) adj(ctx, +1);
  }
}

function cvRainDance(ctx: AIContext) {
  if (!userFaster(ctx) && ctx.aiMon.ability === 'swiftswim') {
    adj(ctx, +1); return;
  }
  if (hpPct(ctx.aiMon) < 40) { adj(ctx, -1); return; }
  const w = getWeather(ctx.battle);
  if (w === Weather.HAIL || w === Weather.SUN || w === Weather.SANDSTORM) {
    adj(ctx, +1); return;
  }
  if (ctx.aiMon.ability === 'raindish') adj(ctx, +1);
}

function cvSunnyDay(ctx: AIContext) {
  if (hpPct(ctx.aiMon) < 40) { adj(ctx, -1); return; }
  const w = getWeather(ctx.battle);
  if (w === Weather.HAIL || w === Weather.RAIN || w === Weather.SANDSTORM) {
    adj(ctx, +1);
  }
}

function cvBellyDrum(ctx: AIContext) {
  if (hpPct(ctx.aiMon) < 90) adj(ctx, -2);
}

function cvPsychUp(ctx: AIContext) {
  const t = ctx.targetMon;
  const u = ctx.aiMon;
  const targetBoosted =
    statStage(t, 'atk') > 8 || statStage(t, 'def') > 8 ||
    statStage(t, 'spatk') > 8 || statStage(t, 'spdef') > 8 ||
    statStage(t, 'evasion') > 8;
  if (!targetBoosted) { adj(ctx, -2); return; }
  const userDebuffed =
    statStage(u, 'atk') < 7 || statStage(u, 'def') < 7 ||
    statStage(u, 'spatk') < 7 || statStage(u, 'spdef') < 7;
  if (userDebuffed) { adj(ctx, +1); adj(ctx, +1); return; }
  if (statStage(u, 'evasion') < 7) {
    adj(ctx, +1); adj(ctx, +1); return;
  }
  if (!rng(50)) { adj(ctx, -2); return; }
}

function cvMirrorCoat(ctx: AIContext) {
  // BUG: original scores up Mirror Coat when target types are NOT special
  if (hasStatusCond(ctx.targetMon, 'slp') ||
      hasVolatile(ctx.targetMon, 'attract') ||
      hasVolatile(ctx.targetMon, 'confusion')) {
    adj(ctx, -1); return;
  }
  if (hpPct(ctx.aiMon) <= 30 && !rng(10)) adj(ctx, -1);
  if (hpPct(ctx.aiMon) <= 50 && !rng(100)) adj(ctx, -1);

  if (monHasMove(ctx.aiMon, 'counter')) {
    if (!rng(100)) adj(ctx, +4);
    return;
  }
  const lastPow = getLastMovePower(ctx.targetMon, ctx.battle);
  if (lastPow > 0) {
    const lastType = getLastMoveType(ctx.targetMon, ctx.battle);
    if (!SPECIAL_TYPES.has(lastType)) { adj(ctx, -1); return; }
    if (!rng(100)) adj(ctx, +1);
    return;
  }
  // Buggy path
  if (SPECIAL_TYPES.has(ctx.targetMon.types[0]) ||
      (ctx.targetMon.types[1] && SPECIAL_TYPES.has(ctx.targetMon.types[1]))) {
    return;
  }
  if (!rng(50)) { if (!rng(100)) adj(ctx, +4); }
}

function cvChargeUpMove(ctx: AIContext) {
  const eff = ctxTypeEff(ctx);
  if (eff === 0.25 || eff === 0.5) { adj(ctx, -2); return; }
  if (monHasMoveWithEffect(ctx.targetMon, E.PROTECT)) { adj(ctx, -2); return; }
  if (hpPct(ctx.aiMon) <= 38) adj(ctx, -1);
}

function cvSemiInvulnerable(ctx: AIContext) {
  if (monHasMoveWithEffect(ctx.targetMon, E.PROTECT)) { adj(ctx, -1); return; }

  // Encourage stalling if target has residual damage
  if (hasStatusCond(ctx.targetMon, 'tox') ||
      hasVolatile(ctx.targetMon, 'curse') ||
      hasVolatile(ctx.targetMon, 'leechseed')) {
    if (!rng(80)) adj(ctx, +1);
    return;
  }

  const w = getWeather(ctx.battle);
  // BUG: weather type checks are swapped in original
  if (w === Weather.HAIL) {
    // Original checks sandstorm types here (swapped bug)
    if (SANDSTORM_RESISTANT_TYPES.has(ctx.aiMon.types[0]) ||
        (ctx.aiMon.types[1] && SANDSTORM_RESISTANT_TYPES.has(ctx.aiMon.types[1]))) {
      if (!rng(80)) adj(ctx, +1);
      return;
    }
  } else if (w === Weather.SANDSTORM) {
    // Original checks Ice type here (swapped bug)
    if (ctx.aiMon.hasType('Ice')) {
      if (!rng(80)) adj(ctx, +1);
      return;
    }
  }

  if (!targetFaster(ctx)) {
    if (getLastMoveEffect(ctx.targetMon) === E.LOCK_ON) return;
    if (!rng(80)) adj(ctx, +1);
  }
}

function cvSpitUp(ctx: AIContext) {
  const count = ctx.aiMon.volatiles['stockpile']
    ? ((ctx.aiMon.volatiles['stockpile'] as any).layers ?? 0) : 0;
  if (count >= 2 && !rng(80)) adj(ctx, +2);
}

function cvHail(ctx: AIContext) {
  if (hpPct(ctx.aiMon) < 40) { adj(ctx, -1); return; }
  const w = getWeather(ctx.battle);
  if (w === Weather.SUN || w === Weather.RAIN || w === Weather.SANDSTORM) {
    adj(ctx, +1);
  }
}

function cvFacade(ctx: AIContext) {
  // BUG: original checks TARGET status instead of USER
  const s = ctx.targetMon.status;
  if (s === 'psn' || s === 'brn' || s === 'par' || s === 'tox') {
    adj(ctx, +1);
  }
}

function cvFocusPunch(ctx: AIContext) {
  const eff = ctxTypeEff(ctx);
  if (eff === 0.25 || eff === 0.5) { adj(ctx, -1); return; }
  if (hasStatusCond(ctx.targetMon, 'slp')) { adj(ctx, +1); return; }
  if (hasVolatile(ctx.targetMon, 'attract') ||
      hasVolatile(ctx.targetMon, 'confusion')) {
    if (!rng(100)) {
      if (hasVolatile(ctx.aiMon, 'substitute')) { adj(ctx, +5); return; }
    }
    adj(ctx, +1); return;
  }
  if (!isFirstTurnFor(ctx.aiMon)) return;
  if (!rng(100)) adj(ctx, +1);
}

function cvSmellingSalt(ctx: AIContext) {
  if (hasStatusCond(ctx.targetMon, 'par')) adj(ctx, +1);
}

function cvTrick(ctx: AIContext) {
  const userItem = getHeldItem(ctx.aiMon);
  const targetItem = getHeldItem(ctx.targetMon);
  if (userItem && TRICK_CHOICE_ITEMS.has(userItem)) {
    if (targetItem && TRICK_CHOICE_ITEMS.has(targetItem)) { adj(ctx, -3); return; }
    adj(ctx, +5); return;
  }
  if (userItem && TRICK_CONFUSE_ITEMS.has(userItem)) {
    if (targetItem && TRICK_CONFUSE_ITEMS.has(targetItem)) { adj(ctx, -3); return; }
    if (!rng(50)) adj(ctx, +2);
    return;
  }
  adj(ctx, -3);
}

function cvChangeSelfAbility(ctx: AIContext) {
  if (ROLE_PLAY_ENCOURAGED_ABILITIES.has(ctx.aiMon.ability)) { adj(ctx, -1); return; }
  if (ROLE_PLAY_ENCOURAGED_ABILITIES.has(ctx.targetMon.ability)) {
    if (!rng(50)) adj(ctx, +2);
    return;
  }
  adj(ctx, -1);
}

function cvSuperpower(ctx: AIContext) {
  const eff = ctxTypeEff(ctx);
  if (eff === 0.25 || eff === 0.5) { adj(ctx, -1); return; }
  if (statStage(ctx.aiMon, 'atk') < DEFAULT_STAT_STAGE) { adj(ctx, -1); return; }
  if (!targetFaster(ctx) && hpPct(ctx.aiMon) > 40) { adj(ctx, -1); return; }
  if (targetFaster(ctx) && hpPct(ctx.aiMon) >= 60) adj(ctx, -1);
}

function cvMagicCoat(ctx: AIContext) {
  if (hpPct(ctx.targetMon) <= 30 && !rng(100)) adj(ctx, -1);
  if (isFirstTurnFor(ctx.aiMon)) {
    if (!rng(150)) adj(ctx, +1);
    return;
  }
  if (!rng(30)) adj(ctx, -1);
}

function cvRecycle(ctx: AIContext) {
  // Approximation: if mon has no item, it was consumed
  if (!ctx.aiMon.item) {
    // Would need to track consumed items; approximate as -2
    adj(ctx, -2);
    return;
  }
  if (RECYCLE_ENCOURAGED_ITEMS.has(ctx.aiMon.item)) {
    if (!rng(50)) adj(ctx, +1);
  } else {
    adj(ctx, -2);
  }
}

function cvRevenge(ctx: AIContext) {
  if (hasStatusCond(ctx.targetMon, 'slp') ||
      hasVolatile(ctx.targetMon, 'attract') ||
      hasVolatile(ctx.targetMon, 'confusion')) {
    adj(ctx, -2); return;
  }
  if (!rng(180)) { adj(ctx, +2); return; }
  adj(ctx, -2);
}

function cvBrickBreak(ctx: AIContext) {
  if (hasSideCond(ctx.playerSide, 'reflect')) adj(ctx, +1);
}

function cvKnockOff(ctx: AIContext) {
  if (hpPct(ctx.targetMon) < 30) return;
  if (!isFirstTurnFor(ctx.aiMon)) return;
  if (!rng(180)) adj(ctx, +1);
}

function cvEndeavor(ctx: AIContext) {
  if (hpPct(ctx.targetMon) < 70) { adj(ctx, -1); return; }
  if (!targetFaster(ctx)) {
    if (hpPct(ctx.aiMon) > 40) { adj(ctx, -1); return; }
  } else {
    if (hpPct(ctx.aiMon) > 50) { adj(ctx, -1); return; }
  }
  adj(ctx, +1);
}

function cvEruption(ctx: AIContext) {
  const eff = ctxTypeEff(ctx);
  if (eff === 0.25 || eff === 0.5) { adj(ctx, -1); return; }
  if (!targetFaster(ctx)) {
    if (hpPct(ctx.targetMon) <= 50) adj(ctx, -1);
    return;
  }
  if (hpPct(ctx.targetMon) <= 70) adj(ctx, -1);
}

function cvImprison(ctx: AIContext) {
  if (!isFirstTurnFor(ctx.aiMon)) return;
  if (!rng(100)) adj(ctx, +2);
}

function cvRefresh(ctx: AIContext) {
  if (hpPct(ctx.targetMon) < 50) adj(ctx, -1);
}

function cvSnatch(ctx: AIContext) {
  if (isFirstTurnFor(ctx.aiMon)) {
    if (!rng(150)) { adj(ctx, +2); return; }
    return;
  }
  if (!rng(30)) return;
  if (!targetFaster(ctx)) {
    if (hpPct(ctx.aiMon) === 100 && hpPct(ctx.targetMon) >= 70) {
      if (!rng(60)) { if (!rng(30)) adj(ctx, -2); return; }
    }
  } else {
    if (hpPct(ctx.targetMon) > 25) { if (!rng(30)) adj(ctx, -2); return; }
    if (monHasMoveWithEffect(ctx.targetMon, E.RESTORE_HP) ||
        monHasMoveWithEffect(ctx.targetMon, E.DEFENSE_CURL)) {
      if (!rng(150)) { adj(ctx, +2); return; }
      return;
    }
  }
  if (!rng(230)) { adj(ctx, +1); return; }
  if (!rng(30)) adj(ctx, -2);
}

function cvMudSport(ctx: AIContext) {
  if (hpPct(ctx.aiMon) < 50) { adj(ctx, -1); return; }
  if (ctx.targetMon.hasType('Electric')) { adj(ctx, +1); return; }
  adj(ctx, -1);
}

function cvOverheat(ctx: AIContext) {
  const eff = ctxTypeEff(ctx);
  if (eff === 0.25 || eff === 0.5) { adj(ctx, -1); return; }
  if (!targetFaster(ctx)) {
    if (hpPct(ctx.aiMon) > 60) return;
  } else {
    if (hpPct(ctx.aiMon) > 80) return;
  }
  adj(ctx, -1);
}

function cvWaterSport(ctx: AIContext) {
  if (hpPct(ctx.aiMon) < 50) { adj(ctx, -1); return; }
  if (ctx.targetMon.hasType('Fire')) { adj(ctx, +1); return; }
  adj(ctx, -1);
}

function cvDragonDance(ctx: AIContext) {
  if (!targetFaster(ctx)) {
    if (hpPct(ctx.aiMon) > 50) return;
    if (!rng(70)) adj(ctx, -1);
    return;
  }
  if (!rng(128)) adj(ctx, +1);
}
