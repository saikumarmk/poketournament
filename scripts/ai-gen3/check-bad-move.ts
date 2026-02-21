/**
 * AI_CheckBadMove — transpiled from pokeemerald/data/battle_ai_scripts.s lines 51-598
 *
 * Penalizes moves that are bad in the current context: immune targets,
 * redundant status, maxed stats, ability interactions, etc.
 * Score adjustments are always negative (penalties).
 */
import { E, getEffect } from './effect-map.js';
import { SOUND_MOVES } from './tables.js';
import {
  type AIContext, adj, getMoveId, getMoveType, getMoveEffect,
  ctxTypeEff, hpPct, statStage, countUsablePartyMons,
  hasStatus, hasStatusCond, hasVolatile, hasSideCond,
  getWeather, Weather, getGender, rng,
  MIN_STAT_STAGE, MAX_STAT_STAGE, DEFAULT_STAT_STAGE,
  getHowPowerful, POWER_OTHER,
} from './helpers.js';

export function aiCheckBadMove(ctx: AIContext): void {
  const moveId = getMoveId(ctx);
  const effect = getMoveEffect(ctx);

  // Type/ability immunity checks for damaging moves + OHKO
  if (moveId === 'fissure' || moveId === 'horndrill' ||
      getHowPowerful(ctx) !== POWER_OTHER) {
    // AI_CBM_CheckIfNegatesType
    if (ctxTypeEff(ctx) === 0) { adj(ctx, -10); return; }

    const ab = ctx.targetMon.ability;
    if (ab === 'voltabsorb') {
      if (getMoveType(ctx) === 'Electric') { adj(ctx, -12); return; }
    } else if (ab === 'waterabsorb') {
      if (getMoveType(ctx) === 'Water') { adj(ctx, -12); return; }
    } else if (ab === 'flashfire') {
      if (getMoveType(ctx) === 'Fire') { adj(ctx, -12); return; }
    } else if (ab === 'wonderguard') {
      if (ctxTypeEff(ctx) !== 2) { adj(ctx, -10); return; }
    } else if (ab === 'levitate') {
      if (getMoveType(ctx) === 'Ground') { adj(ctx, -10); return; }
    }
  }

  // AI_CheckBadMove_CheckSoundproof
  if (ctx.targetMon.ability === 'soundproof' && SOUND_MOVES.has(moveId)) {
    adj(ctx, -10); return;
  }

  // AI_CheckBadMove_CheckEffect — dispatch on move effect
  switch (effect) {
    case E.SLEEP: return cbmSleep(ctx);
    case E.EXPLOSION: return cbmExplosion(ctx);
    case E.DREAM_EATER: return cbmDreamEater(ctx);
    case E.ATTACK_UP: case E.ATTACK_UP_2: return cbmStatUp(ctx, 'atk');
    case E.DEFENSE_UP: case E.DEFENSE_UP_2: case E.DEFENSE_CURL:
      return cbmStatUp(ctx, 'def');
    case E.SPEED_UP: case E.SPEED_UP_2: return cbmStatUp(ctx, 'spe');
    case E.SPECIAL_ATTACK_UP: case E.SPECIAL_ATTACK_UP_2:
      return cbmStatUp(ctx, 'spatk');
    case E.SPECIAL_DEFENSE_UP: case E.SPECIAL_DEFENSE_UP_2:
      return cbmStatUp(ctx, 'spdef');
    case E.ACCURACY_UP: case E.ACCURACY_UP_2: return cbmStatUp(ctx, 'acc');
    case E.EVASION_UP: case E.EVASION_UP_2: case E.MINIMIZE:
      return cbmStatUp(ctx, 'evasion');
    case E.ATTACK_DOWN: case E.ATTACK_DOWN_2:
      return cbmAttackDown(ctx);
    case E.DEFENSE_DOWN: case E.DEFENSE_DOWN_2:
      return cbmDefenseDown(ctx);
    case E.SPEED_DOWN: case E.SPEED_DOWN_2:
      return cbmSpeedDown(ctx);
    case E.SPECIAL_ATTACK_DOWN: case E.SPECIAL_ATTACK_DOWN_2:
      return cbmSpAtkDown(ctx);
    case E.SPECIAL_DEFENSE_DOWN: case E.SPECIAL_DEFENSE_DOWN_2:
      return cbmSpDefDown(ctx);
    case E.ACCURACY_DOWN: case E.ACCURACY_DOWN_2:
      return cbmAccDown(ctx);
    case E.EVASION_DOWN: case E.EVASION_DOWN_2:
      return cbmEvasionDown(ctx);
    case E.HAZE: case E.PSYCH_UP: return cbmHaze(ctx);
    case E.BIDE: case E.RAZOR_WIND: case E.SUPER_FANG:
    case E.RECHARGE: case E.LEVEL_DAMAGE: case E.PSYWAVE:
    case E.COUNTER: case E.FLAIL: case E.RETURN:
    case E.PRESENT: case E.FRUSTRATION: case E.SONICBOOM:
    case E.MIRROR_COAT: case E.SKULL_BASH:
    case E.SUPERPOWER: case E.ENDEAVOR: case E.LOW_KICK:
    case E.FOCUS_PUNCH:
      return cbmHighRiskForDamage(ctx);
    case E.FUTURE_SIGHT: return cbmFutureSight(ctx);
    case E.ROAR: return cbmRoar(ctx);
    case E.TOXIC: case E.POISON: return cbmToxic(ctx);
    case E.LIGHT_SCREEN: return cbmLightScreen(ctx);
    case E.OHKO: return cbmOneHitKO(ctx);
    case E.MAGNITUDE: return cbmMagnitude(ctx);
    case E.MIST: return cbmMist(ctx);
    case E.FOCUS_ENERGY: return cbmFocusEnergy(ctx);
    case E.CONFUSE: case E.SWAGGER: case E.FLATTER:
      return cbmConfuse(ctx);
    case E.REFLECT: return cbmReflect(ctx);
    case E.PARALYZE: return cbmParalyze(ctx);
    case E.SUBSTITUTE: return cbmSubstitute(ctx);
    case E.LEECH_SEED: return cbmLeechSeed(ctx);
    case E.DISABLE: return cbmDisable(ctx);
    case E.ENCORE: return cbmEncore(ctx);
    case E.SNORE: case E.SLEEP_TALK: return cbmDamageDuringSleep(ctx);
    case E.MEAN_LOOK: return cbmCantEscape(ctx);
    case E.NIGHTMARE: return cbmNightmare(ctx);
    case E.CURSE: return cbmCurse(ctx);
    case E.SPIKES: return cbmSpikes(ctx);
    case E.FORESIGHT: return cbmForesight(ctx);
    case E.PERISH_SONG: return cbmPerishSong(ctx);
    case E.SANDSTORM: return cbmSandstorm(ctx);
    case E.ATTRACT: return cbmAttract(ctx);
    case E.SAFEGUARD: return cbmSafeguard(ctx);
    case E.BATON_PASS: case E.MEMENTO: return cbmBatonPassMemento(ctx, effect);
    case E.RAIN_DANCE: return cbmRainDance(ctx);
    case E.SUNNY_DAY: return cbmSunnyDay(ctx);
    case E.BELLY_DRUM: return cbmBellyDrum(ctx);
    case E.TELEPORT: adj(ctx, -10); return;
    case E.FAKE_OUT: return cbmFakeOut(ctx);
    case E.STOCKPILE: return cbmStockpile(ctx);
    case E.SPIT_UP: case E.SWALLOW: return cbmSpitUpSwallow(ctx);
    case E.HAIL: return cbmHail(ctx);
    case E.TORMENT: return cbmTorment(ctx);
    case E.WILL_O_WISP: return cbmWillOWisp(ctx);
    case E.HELPING_HAND: adj(ctx, -10); return; // always singles
    case E.TRICK: case E.KNOCK_OFF: return cbmTrickKnockOff(ctx);
    case E.INGRAIN: return cbmIngrain(ctx);
    case E.RECYCLE: return cbmRecycle(ctx);
    case E.IMPRISON: return cbmImprison(ctx);
    case E.REFRESH: return cbmRefresh(ctx);
    case E.MUD_SPORT: return cbmMudSport(ctx);
    case E.TICKLE: return cbmTickle(ctx);
    case E.COSMIC_POWER: return cbmCosmicPower(ctx);
    case E.BULK_UP: return cbmBulkUp(ctx);
    case E.WATER_SPORT: return cbmWaterSport(ctx);
    case E.CALM_MIND: return cbmCalmMind(ctx);
    case E.DRAGON_DANCE: return cbmDragonDance(ctx);
    default: break;
  }
}

// ── Sub-handlers ─────────────────────────────────────────────────────

function cbmSleep(ctx: AIContext) {
  const ab = ctx.targetMon.ability;
  if (ab === 'insomnia' || ab === 'vitalspirit') { adj(ctx, -10); return; }
  if (hasStatus(ctx.targetMon)) { adj(ctx, -10); return; }
  if (hasSideCond(ctx.playerSide, 'safeguard')) { adj(ctx, -10); return; }
}

function cbmExplosion(ctx: AIContext) {
  if (ctxTypeEff(ctx) === 0) { adj(ctx, -10); return; }
  if (ctx.targetMon.ability === 'damp') { adj(ctx, -10); return; }
  const userParty = countUsablePartyMons(ctx.aiSide);
  if (userParty !== 0) return;
  const targetParty = countUsablePartyMons(ctx.playerSide);
  if (targetParty !== 0) { adj(ctx, -10); return; }
  adj(ctx, -1);
}

function cbmNightmare(ctx: AIContext) {
  if (hasVolatile(ctx.targetMon, 'nightmare')) { adj(ctx, -10); return; }
  if (!hasStatusCond(ctx.targetMon, 'slp')) { adj(ctx, -8); return; }
}

function cbmDreamEater(ctx: AIContext) {
  if (!hasStatusCond(ctx.targetMon, 'slp')) { adj(ctx, -8); return; }
  if (ctxTypeEff(ctx) === 0) { adj(ctx, -10); return; }
}

function cbmBellyDrum(ctx: AIContext) {
  if (hpPct(ctx.aiMon) < 51) { adj(ctx, -10); return; }
  cbmStatUp(ctx, 'atk');
}

function cbmStatUp(ctx: AIContext, stat: string) {
  if (statStage(ctx.aiMon, stat) >= MAX_STAT_STAGE) { adj(ctx, -10); return; }
}

function cbmAttackDown(ctx: AIContext) {
  if (statStage(ctx.targetMon, 'atk') <= MIN_STAT_STAGE) { adj(ctx, -10); return; }
  if (ctx.targetMon.ability === 'hypercutter') { adj(ctx, -10); return; }
  cbmCheckStatChangeBlocked(ctx);
}

function cbmDefenseDown(ctx: AIContext) {
  if (statStage(ctx.targetMon, 'def') <= MIN_STAT_STAGE) { adj(ctx, -10); return; }
  cbmCheckStatChangeBlocked(ctx);
}

function cbmSpeedDown(ctx: AIContext) {
  if (statStage(ctx.targetMon, 'spe') <= MIN_STAT_STAGE) { adj(ctx, -10); return; }
  if (ctx.targetMon.ability === 'speedboost') { adj(ctx, -10); return; }
  cbmCheckStatChangeBlocked(ctx);
}

function cbmSpAtkDown(ctx: AIContext) {
  if (statStage(ctx.targetMon, 'spatk') <= MIN_STAT_STAGE) { adj(ctx, -10); return; }
  cbmCheckStatChangeBlocked(ctx);
}

function cbmSpDefDown(ctx: AIContext) {
  if (statStage(ctx.targetMon, 'spdef') <= MIN_STAT_STAGE) { adj(ctx, -10); return; }
  cbmCheckStatChangeBlocked(ctx);
}

function cbmAccDown(ctx: AIContext) {
  if (statStage(ctx.targetMon, 'acc') <= MIN_STAT_STAGE) { adj(ctx, -10); return; }
  if (ctx.targetMon.ability === 'keeneye') { adj(ctx, -10); return; }
  cbmCheckStatChangeBlocked(ctx);
}

function cbmEvasionDown(ctx: AIContext) {
  if (statStage(ctx.targetMon, 'evasion') <= MIN_STAT_STAGE) { adj(ctx, -10); return; }
  cbmCheckStatChangeBlocked(ctx);
}

function cbmCheckStatChangeBlocked(ctx: AIContext) {
  const ab = ctx.targetMon.ability;
  if (ab === 'clearbody' || ab === 'whitesmoke') { adj(ctx, -10); return; }
}

function cbmHaze(ctx: AIContext) {
  const u = ctx.aiMon;
  const t = ctx.targetMon;
  const stats = ['atk', 'def', 'spe', 'spatk', 'spdef', 'acc', 'evasion'];
  for (const s of stats) {
    if (statStage(u, s) < DEFAULT_STAT_STAGE) return; // user has debuff → useful
  }
  for (const s of stats) {
    if (statStage(t, s) > DEFAULT_STAT_STAGE) return; // target has buff → useful
  }
  adj(ctx, -10);
}

function cbmRoar(ctx: AIContext) {
  if (countUsablePartyMons(ctx.playerSide) === 0) { adj(ctx, -10); return; }
  if (ctx.targetMon.ability === 'suctioncups') { adj(ctx, -10); return; }
}

function cbmToxic(ctx: AIContext) {
  for (const t of ctx.targetMon.types) {
    if (t === 'Steel' || t === 'Poison') { adj(ctx, -10); return; }
  }
  if (ctx.targetMon.ability === 'immunity') { adj(ctx, -10); return; }
  if (hasStatus(ctx.targetMon)) { adj(ctx, -10); return; }
  if (hasSideCond(ctx.playerSide, 'safeguard')) { adj(ctx, -10); return; }
}

function cbmLightScreen(ctx: AIContext) {
  if (hasSideCond(ctx.aiSide, 'lightscreen')) { adj(ctx, -8); return; }
}

function cbmOneHitKO(ctx: AIContext) {
  if (ctxTypeEff(ctx) === 0) { adj(ctx, -10); return; }
  if (ctx.targetMon.ability === 'sturdy') { adj(ctx, -10); return; }
  if (ctx.aiMon.level < ctx.targetMon.level) { adj(ctx, -10); return; }
}

function cbmMagnitude(ctx: AIContext) {
  if (ctx.targetMon.ability === 'levitate') { adj(ctx, -10); return; }
  cbmHighRiskForDamage(ctx);
}

function cbmHighRiskForDamage(ctx: AIContext) {
  if (ctxTypeEff(ctx) === 0) { adj(ctx, -10); return; }
  if (ctx.targetMon.ability === 'wonderguard') {
    if (ctxTypeEff(ctx) !== 2) { adj(ctx, -10); return; }
  }
}

function cbmMist(ctx: AIContext) {
  if (hasSideCond(ctx.aiSide, 'mist')) { adj(ctx, -8); return; }
}

function cbmFocusEnergy(ctx: AIContext) {
  if (hasVolatile(ctx.aiMon, 'focusenergy')) { adj(ctx, -10); return; }
}

function cbmConfuse(ctx: AIContext) {
  if (hasVolatile(ctx.targetMon, 'confusion')) { adj(ctx, -5); return; }
  if (ctx.targetMon.ability === 'owntempo') { adj(ctx, -10); return; }
  if (hasSideCond(ctx.playerSide, 'safeguard')) { adj(ctx, -10); return; }
}

function cbmReflect(ctx: AIContext) {
  if (hasSideCond(ctx.aiSide, 'reflect')) { adj(ctx, -8); return; }
}

function cbmParalyze(ctx: AIContext) {
  if (ctxTypeEff(ctx) === 0) { adj(ctx, -10); return; }
  if (ctx.targetMon.ability === 'limber') { adj(ctx, -10); return; }
  if (hasStatus(ctx.targetMon)) { adj(ctx, -10); return; }
  if (hasSideCond(ctx.playerSide, 'safeguard')) { adj(ctx, -10); return; }
}

function cbmSubstitute(ctx: AIContext) {
  if (hasVolatile(ctx.aiMon, 'substitute')) { adj(ctx, -8); return; }
  if (hpPct(ctx.aiMon) < 26) { adj(ctx, -10); return; }
}

function cbmLeechSeed(ctx: AIContext) {
  if (hasVolatile(ctx.targetMon, 'leechseed')) { adj(ctx, -10); return; }
  for (const t of ctx.targetMon.types) {
    if (t === 'Grass') { adj(ctx, -10); return; }
  }
}

function cbmDisable(ctx: AIContext) {
  if (hasVolatile(ctx.targetMon, 'disable')) { adj(ctx, -8); return; }
}

function cbmEncore(ctx: AIContext) {
  if (hasVolatile(ctx.targetMon, 'encore')) { adj(ctx, -8); return; }
}

function cbmDamageDuringSleep(ctx: AIContext) {
  if (!hasStatusCond(ctx.aiMon, 'slp')) { adj(ctx, -8); return; }
}

function cbmCantEscape(ctx: AIContext) {
  if (hasVolatile(ctx.targetMon, 'trapped') ||
      hasVolatile(ctx.targetMon, 'meanLook')) {
    adj(ctx, -10); return;
  }
}

function cbmCurse(ctx: AIContext) {
  if (statStage(ctx.aiMon, 'atk') >= MAX_STAT_STAGE) { adj(ctx, -10); return; }
  if (statStage(ctx.aiMon, 'def') >= MAX_STAT_STAGE) { adj(ctx, -8); return; }
}

function cbmSpikes(ctx: AIContext) {
  if (hasSideCond(ctx.playerSide, 'spikes')) { adj(ctx, -10); return; }
}

function cbmForesight(ctx: AIContext) {
  if (hasVolatile(ctx.targetMon, 'foresight')) { adj(ctx, -10); return; }
}

function cbmPerishSong(ctx: AIContext) {
  if (hasVolatile(ctx.targetMon, 'perishsong')) { adj(ctx, -10); return; }
}

function cbmSandstorm(ctx: AIContext) {
  if (getWeather(ctx.battle) === Weather.SANDSTORM) { adj(ctx, -8); return; }
}

function cbmAttract(ctx: AIContext) {
  if (hasVolatile(ctx.targetMon, 'attract')) { adj(ctx, -10); return; }
  if (ctx.targetMon.ability === 'oblivious') { adj(ctx, -10); return; }
  const userG = getGender(ctx.aiMon);
  const targetG = getGender(ctx.targetMon);
  if (userG === 'M' && targetG === 'F') return;
  if (userG === 'F' && targetG === 'M') return;
  adj(ctx, -10);
}

function cbmSafeguard(ctx: AIContext) {
  if (hasSideCond(ctx.aiSide, 'safeguard')) { adj(ctx, -8); return; }
}

function cbmBatonPassMemento(ctx: AIContext, effect: E) {
  if (effect === E.MEMENTO) {
    if (statStage(ctx.targetMon, 'atk') <= MIN_STAT_STAGE) { adj(ctx, -10); return; }
    if (statStage(ctx.targetMon, 'spatk') <= MIN_STAT_STAGE) { adj(ctx, -8); return; }
  }
  if (countUsablePartyMons(ctx.aiSide) === 0) { adj(ctx, -10); return; }
}

function cbmRainDance(ctx: AIContext) {
  if (getWeather(ctx.battle) === Weather.RAIN) { adj(ctx, -8); return; }
}

function cbmSunnyDay(ctx: AIContext) {
  if (getWeather(ctx.battle) === Weather.SUN) { adj(ctx, -8); return; }
}

function cbmFakeOut(ctx: AIContext) {
  const isFirst = (ctx.aiMon.activeTurns ?? 0) <= 1;
  if (!isFirst) { adj(ctx, -10); return; }
}

function cbmStockpile(ctx: AIContext) {
  const count = ctx.aiMon.volatiles['stockpile']
    ? (ctx.aiMon.volatiles['stockpile'] as any).layers ?? 0
    : 0;
  if (count >= 3) { adj(ctx, -10); return; }
}

function cbmSpitUpSwallow(ctx: AIContext) {
  if (ctxTypeEff(ctx) === 0 && getMoveEffect(ctx) === E.SPIT_UP) {
    adj(ctx, -10); return;
  }
  const count = ctx.aiMon.volatiles['stockpile']
    ? (ctx.aiMon.volatiles['stockpile'] as any).layers ?? 0
    : 0;
  if (count === 0) { adj(ctx, -10); return; }
}

function cbmHail(ctx: AIContext) {
  if (getWeather(ctx.battle) === Weather.HAIL) { adj(ctx, -8); return; }
}

function cbmTorment(ctx: AIContext) {
  if (hasVolatile(ctx.targetMon, 'torment')) { adj(ctx, -10); return; }
}

function cbmWillOWisp(ctx: AIContext) {
  if (ctx.targetMon.ability === 'waterveil') { adj(ctx, -10); return; }
  if (hasStatus(ctx.targetMon)) { adj(ctx, -10); return; }
  const eff = ctxTypeEff(ctx);
  if (eff === 0 || eff === 0.5 || eff === 0.25) { adj(ctx, -10); return; }
  if (hasSideCond(ctx.playerSide, 'safeguard')) { adj(ctx, -10); return; }
}

function cbmTrickKnockOff(ctx: AIContext) {
  if (ctx.targetMon.ability === 'stickyhold') { adj(ctx, -10); return; }
}

function cbmIngrain(ctx: AIContext) {
  if (hasVolatile(ctx.aiMon, 'ingrain')) { adj(ctx, -10); return; }
}

function cbmRecycle(ctx: AIContext) {
  // get_used_held_item: approximated — if mon still has its item, nothing to recycle
  if (ctx.aiMon.item) { adj(ctx, -10); return; }
}

function cbmImprison(ctx: AIContext) {
  if (hasVolatile(ctx.aiMon, 'imprison')) { adj(ctx, -10); return; }
}

function cbmRefresh(ctx: AIContext) {
  const s = ctx.aiMon.status;
  if (s !== 'psn' && s !== 'brn' && s !== 'par' && s !== 'tox') {
    adj(ctx, -10); return;
  }
}

function cbmMudSport(ctx: AIContext) {
  if (hasVolatile(ctx.aiMon, 'mudsport') ||
      ctx.battle.field.pseudoWeather['mudsport']) {
    adj(ctx, -10); return;
  }
}

function cbmTickle(ctx: AIContext) {
  if (statStage(ctx.targetMon, 'atk') <= MIN_STAT_STAGE) { adj(ctx, -10); return; }
  if (statStage(ctx.targetMon, 'def') <= MIN_STAT_STAGE) { adj(ctx, -8); return; }
}

function cbmCosmicPower(ctx: AIContext) {
  if (statStage(ctx.aiMon, 'def') >= MAX_STAT_STAGE) { adj(ctx, -10); return; }
  if (statStage(ctx.aiMon, 'spdef') >= MAX_STAT_STAGE) { adj(ctx, -8); return; }
}

function cbmBulkUp(ctx: AIContext) {
  if (statStage(ctx.aiMon, 'atk') >= MAX_STAT_STAGE) { adj(ctx, -10); return; }
  if (statStage(ctx.aiMon, 'def') >= MAX_STAT_STAGE) { adj(ctx, -8); return; }
}

function cbmWaterSport(ctx: AIContext) {
  if (hasVolatile(ctx.aiMon, 'watersport') ||
      ctx.battle.field.pseudoWeather['watersport']) {
    adj(ctx, -10); return;
  }
}

function cbmCalmMind(ctx: AIContext) {
  if (statStage(ctx.aiMon, 'spatk') >= MAX_STAT_STAGE) { adj(ctx, -10); return; }
  if (statStage(ctx.aiMon, 'spdef') >= MAX_STAT_STAGE) { adj(ctx, -8); return; }
}

function cbmDragonDance(ctx: AIContext) {
  if (statStage(ctx.aiMon, 'atk') >= MAX_STAT_STAGE) { adj(ctx, -10); return; }
  if (statStage(ctx.aiMon, 'spe') >= MAX_STAT_STAGE) { adj(ctx, -8); return; }
}

function cbmFutureSight(ctx: AIContext) {
  if (hasSideCond(ctx.playerSide, 'futuremove')) { adj(ctx, -12); return; }
  if (hasSideCond(ctx.aiSide, 'futuremove')) { adj(ctx, -12); return; }
  adj(ctx, +5);
}
