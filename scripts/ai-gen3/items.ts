/**
 * Gen 3 AI item usage — ported from pokeemerald/src/battle_ai_switch_items.c
 *
 * Since @pkmn/sim has no "use item" battle action, we directly manipulate
 * the battle state (heal HP, cure status, boost stats) to simulate it.
 *
 * Emerald trainers carry up to 4 items. Item types from the C source:
 * - AI_ITEM_FULL_RESTORE: heal HP + cure all status
 * - AI_ITEM_HEAL_HP: potions (Super/Hyper/etc.)
 * - AI_ITEM_CURE_CONDITION: status cure items
 * - AI_ITEM_X_STAT: X Attack, X Defend, etc. (first turn only)
 * - AI_ITEM_GUARD_SPEC: Guard Spec (first turn only, if no Mist)
 */
import type { Battle, Pokemon, Side } from '@pkmn/sim';

export type TrainerItem = string | null;

export interface ItemState {
  items: TrainerItem[];
  used: boolean[];
}

export function createItemState(items: TrainerItem[]): ItemState {
  return {
    items: [...items],
    used: items.map(() => false),
  };
}

/**
 * Try to use a trainer item. Called before move/switch selection each turn.
 * Returns true if an item was used (AI turn consumed).
 *
 * Faithfully ports ShouldUseItem from the C source, including the logic
 * that reserves later items for when fewer mons are alive.
 */
export function tryUseItem(
  battle: Battle,
  aiSide: Side,
  state: ItemState,
): boolean {
  const mon = aiSide.active[0];
  if (!mon || mon.fainted) return false;

  const validMons = aiSide.pokemon.filter(
    p => !p.fainted && p.hp > 0,
  ).length;

  const totalItems = state.items.filter(x => x !== null).length;

  for (let i = 0; i < state.items.length; i++) {
    if (state.used[i] || !state.items[i]) continue;

    // C logic: skip later items if we still have many mons alive
    // i != 0 && validMons > (itemsNo - i) + 1
    if (i > 0 && validMons > (totalItems - i) + 1) continue;

    const item = state.items[i]!;
    const used = tryItemByType(battle, mon, item);
    if (used) {
      state.used[i] = true;
      return true;
    }
  }

  return false;
}

// ── Item type classification (mirrors GetAI_ItemType) ────────────────

type AIItemType =
  | 'FULL_RESTORE'
  | 'HEAL_HP'
  | 'CURE_CONDITION'
  | 'X_STAT'
  | 'GUARD_SPEC'
  | 'UNKNOWN';

function classifyItem(item: string): AIItemType {
  switch (item) {
    case 'Full Restore':
      return 'FULL_RESTORE';
    case 'Max Potion':
    case 'Hyper Potion':
    case 'Super Potion':
    case 'Potion':
    case 'Moomoo Milk':
    case 'Berry Juice':
    case 'Fresh Water':
    case 'Soda Pop':
    case 'Lemonade':
    case 'Energy Powder':
    case 'Energy Root':
      return 'HEAL_HP';
    case 'Full Heal':
    case 'Awakening':
    case 'Antidote':
    case 'Burn Heal':
    case 'Ice Heal':
    case 'Paralyze Heal':
    case 'Lava Cookie':
      return 'CURE_CONDITION';
    case 'X Attack':
    case 'X Defend':
    case 'X Speed':
    case 'X Special':
    case 'X Sp. Atk':
    case 'X Accuracy':
    case 'Dire Hit':
      return 'X_STAT';
    case 'Guard Spec.':
    case 'Guard Spec':
      return 'GUARD_SPEC';
    default:
      return 'UNKNOWN';
  }
}

// ── Heal amount lookup ───────────────────────────────────────────────

function healAmount(item: string, mon: Pokemon): number {
  switch (item) {
    case 'Max Potion': return mon.maxhp;
    case 'Hyper Potion': return 200;
    case 'Super Potion': return 50;
    case 'Potion': return 20;
    case 'Moomoo Milk': return 100;
    case 'Berry Juice': return 20;
    case 'Fresh Water': return 50;
    case 'Soda Pop': return 60;
    case 'Lemonade': return 80;
    case 'Energy Powder': return 50;
    case 'Energy Root': return 200;
    default: return 0;
  }
}

// ── Item usage per type ──────────────────────────────────────────────

function tryItemByType(battle: Battle, mon: Pokemon, item: string): boolean {
  const type = classifyItem(item);

  switch (type) {
    case 'FULL_RESTORE':
      return tryFullRestore(mon);
    case 'HEAL_HP':
      return tryHealHP(mon, item);
    case 'CURE_CONDITION':
      return tryCureCondition(mon, item);
    case 'X_STAT':
      return tryXStat(battle, mon, item);
    case 'GUARD_SPEC':
      return tryGuardSpec(battle, mon);
    default:
      return false;
  }
}

// AI_ITEM_FULL_RESTORE: use when HP < 25% and not fainted
function tryFullRestore(mon: Pokemon): boolean {
  if (mon.hp === 0) return false;
  if (mon.hp >= mon.maxhp / 4) return false;

  mon.heal(mon.maxhp - mon.hp);
  if (mon.status) mon.cureStatus(true);
  return true;
}

// AI_ITEM_HEAL_HP: use when HP < 25%, or when damage taken > heal amount
function tryHealHP(mon: Pokemon, item: string): boolean {
  if (mon.hp === 0) return false;
  const amount = healAmount(item, mon);
  if (amount === 0) return false;

  const damageTaken = mon.maxhp - mon.hp;
  if (mon.hp < mon.maxhp / 4 || damageTaken > amount) {
    const heal = Math.min(amount, damageTaken);
    if (heal > 0) mon.heal(heal);
    return true;
  }
  return false;
}

// AI_ITEM_CURE_CONDITION: cure matching status conditions
function tryCureCondition(mon: Pokemon, item: string): boolean {
  if (!mon.status && !mon.volatiles['confusion']) return false;

  const cures = getCuredConditions(item);
  let shouldUse = false;

  if (cures.sleep && mon.status === 'slp') shouldUse = true;
  if (cures.poison && (mon.status === 'psn' || mon.status === 'tox')) shouldUse = true;
  if (cures.burn && mon.status === 'brn') shouldUse = true;
  if (cures.freeze && mon.status === 'frz') shouldUse = true;
  if (cures.paralysis && mon.status === 'par') shouldUse = true;
  if (cures.confusion && mon.volatiles['confusion']) shouldUse = true;

  if (shouldUse) {
    if (mon.status) mon.cureStatus(true);
    if (cures.confusion && mon.volatiles['confusion']) {
      mon.removeVolatile('confusion');
    }
    return true;
  }
  return false;
}

interface CureFlags {
  sleep: boolean;
  poison: boolean;
  burn: boolean;
  freeze: boolean;
  paralysis: boolean;
  confusion: boolean;
}

function getCuredConditions(item: string): CureFlags {
  const all = { sleep: true, poison: true, burn: true, freeze: true, paralysis: true, confusion: true };
  switch (item) {
    case 'Full Heal':
    case 'Lava Cookie':
      return all;
    case 'Awakening':
      return { ...noFlags(), sleep: true };
    case 'Antidote':
      return { ...noFlags(), poison: true };
    case 'Burn Heal':
      return { ...noFlags(), burn: true };
    case 'Ice Heal':
      return { ...noFlags(), freeze: true };
    case 'Paralyze Heal':
      return { ...noFlags(), paralysis: true };
    default:
      return noFlags();
  }
}

function noFlags(): CureFlags {
  return { sleep: false, poison: false, burn: false, freeze: false, paralysis: false, confusion: false };
}

// AI_ITEM_X_STAT: boost stats, only on first turn
function tryXStat(battle: Battle, mon: Pokemon, item: string): boolean {
  const turnsOut = (mon as any).activeTurns ?? battle.turn;
  if (turnsOut > 1) return false;

  const boosts = getXStatBoosts(item);
  if (!boosts) return false;

  if (item === 'Dire Hit') {
    mon.addVolatile('focusenergy');
  } else {
    mon.boostBy(boosts);
  }
  return true;
}

function getXStatBoosts(item: string): Record<string, number> | null {
  switch (item) {
    case 'X Attack': return { atk: 1 };
    case 'X Defend': return { def: 1 };
    case 'X Speed': return { spe: 1 };
    case 'X Special':
    case 'X Sp. Atk': return { spa: 1 };
    case 'X Accuracy': return { accuracy: 1 };
    case 'Dire Hit': return {};
    default: return null;
  }
}

// AI_ITEM_GUARD_SPEC: use on first turn if no Mist active
function tryGuardSpec(battle: Battle, mon: Pokemon): boolean {
  const turnsOut = (mon as any).activeTurns ?? battle.turn;
  if (turnsOut > 1) return false;

  if (mon.side.sideConditions['mist']) return false;

  mon.side.addSideCondition('mist');
  return true;
}
