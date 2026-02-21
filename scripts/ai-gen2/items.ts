/**
 * Gen 2 AI item usage — ported from pokecrystal/engine/battle/ai/items.asm
 *
 * Since @pkmn/sim has no "use item" battle action, we directly manipulate
 * the battle state (heal HP, cure status, boost stats) to simulate it.
 *
 * Items are only used on the highest-level Pokemon in the party.
 * Returns true if an item was used (the AI should skip its move this turn).
 */
import type { Battle, Pokemon, Side } from '@pkmn/sim';

export type ItemUseFlag = 'CONTEXT_USE' | 'ALWAYS_USE' | null;
export type TrainerItem = string | null;

interface ItemState {
  items: [TrainerItem, TrainerItem];
  useFlag: ItemUseFlag;
  used: [boolean, boolean];
}

export function createItemState(
  items: [TrainerItem, TrainerItem],
  useFlag: ItemUseFlag,
): ItemState {
  return { items, useFlag, used: [false, false] };
}

/**
 * Try to use a trainer item. Called before move/switch selection each turn.
 * Returns true if an item was used (AI turn consumed), false otherwise.
 * Directly modifies battle state when an item is used.
 */
export function tryUseItem(
  battle: Battle,
  aiSide: Side,
  state: ItemState,
): boolean {
  if (!aiSide?.active) return false;
  const mon = aiSide.active[0];
  if (!mon || mon.fainted) return false;

  // Items are only used on the highest-level Pokemon
  if (!isHighestLevel(aiSide, mon)) return false;

  for (let i = 0; i < 2; i++) {
    if (state.used[i] || !state.items[i]) continue;

    const item = state.items[i]!;
    const used = tryItem(battle, mon, item, state.useFlag);
    if (used) {
      state.used[i] = true;
      return true;
    }
  }

  return false;
}

function isHighestLevel(side: Side, mon: Pokemon): boolean {
  let maxLevel = 0;
  for (const p of side.pokemon) {
    if (p.level > maxLevel) maxLevel = p.level;
  }
  return mon.level >= maxLevel;
}

function tryItem(
  battle: Battle, mon: Pokemon, item: string, useFlag: ItemUseFlag,
): boolean {
  switch (item) {
    case 'FULL_RESTORE': return tryFullRestore(mon, useFlag);
    case 'MAX_POTION': return tryHealItem(mon, useFlag, mon.maxhp);
    case 'HYPER_POTION': return tryHealItem(mon, useFlag, 200);
    case 'SUPER_POTION': return tryHealItem(mon, useFlag, 50);
    case 'POTION': return tryHealItem(mon, useFlag, 20);
    case 'FULL_HEAL': return tryFullHeal(mon, useFlag);
    case 'X_ACCURACY': return tryXItem(battle, mon, useFlag, { accuracy: 1 });
    case 'X_ATTACK': return tryXItem(battle, mon, useFlag, { atk: 1 });
    case 'X_DEFEND': return tryXItem(battle, mon, useFlag, { def: 1 });
    case 'X_SPEED': return tryXItem(battle, mon, useFlag, { spe: 1 });
    case 'X_SPECIAL': return tryXItem(battle, mon, useFlag, { spa: 1 });
    case 'GUARD_SPEC': return tryXItem(battle, mon, useFlag, { spd: 1 });
    case 'DIRE_HIT': return tryDireHit(battle, mon, useFlag);
    default: return false;
  }
}

// ── Heal items ───────────────────────────────────────────────────────

function tryHealItem(mon: Pokemon, useFlag: ItemUseFlag, amount: number): boolean {
  if (mon.hp >= mon.maxhp) return false;

  const hpPct = mon.hp / mon.maxhp;

  if (useFlag === 'CONTEXT_USE') {
    // Use when HP <= 50%, with higher chance at <= 25%
    if (hpPct > 0.5) return false;
    if (hpPct > 0.25 && Math.random() > 0.8) return false;
  } else {
    // Without CONTEXT_USE: use at <= 50%, 50% chance at 25-50%
    if (hpPct > 0.5) return false;
    if (hpPct > 0.25 && Math.random() > 0.5) return false;
  }

  const maxHeal = amount === mon.maxhp ? mon.maxhp : amount;
  mon.heal(Math.min(maxHeal, mon.maxhp - mon.hp));
  return true;
}

function tryFullRestore(mon: Pokemon, useFlag: ItemUseFlag): boolean {
  // Full Restore heals HP and cures status
  const needsHeal = mon.hp < mon.maxhp;
  const needsCure = !!mon.status;

  if (!needsHeal && !needsCure) return false;

  // Try as heal item first
  if (needsHeal) {
    const hpPct = mon.hp / mon.maxhp;
    if (useFlag === 'CONTEXT_USE') {
      if (hpPct > 0.5 && !needsCure) return false;
      if (hpPct > 0.25 && !needsCure && Math.random() > 0.8) return false;
    } else {
      if (hpPct > 0.5 && !needsCure) return false;
    }
  }

  // If we get here, use it
  if (needsHeal) mon.heal(mon.maxhp - mon.hp);
  if (needsCure) mon.cureStatus(true);
  return true;
}

// ── Status heal ──────────────────────────────────────────────────────

function tryFullHeal(mon: Pokemon, useFlag: ItemUseFlag): boolean {
  if (!mon.status) return false;

  if (useFlag === 'CONTEXT_USE') {
    // CONTEXT_USE: only cure freeze or sleep
    if (mon.status !== 'frz' && mon.status !== 'slp') return false;
  }
  // ALWAYS_USE or no flag: cure any status

  mon.cureStatus(true);
  return true;
}

// ── X-items ──────────────────────────────────────────────────────────

function tryXItem(
  battle: Battle, mon: Pokemon, useFlag: ItemUseFlag,
  boosts: Partial<Record<string, number>>,
): boolean {
  // X-items are used on the first turn out
  const turnsOut = (mon as any).activeTurns ?? battle.turn;
  if (turnsOut > 1) {
    // After first turn: only with ALWAYS_USE, 20% chance
    if (useFlag !== 'ALWAYS_USE') return false;
    if (Math.random() > 0.2) return false;
  } else {
    // First turn: ALWAYS_USE = 100%, CONTEXT_USE = 50%, else 25%
    if (useFlag === 'ALWAYS_USE') {
      // always use
    } else if (useFlag === 'CONTEXT_USE') {
      if (Math.random() > 0.5) return false;
    } else {
      if (Math.random() > 0.25) return false;
    }
  }

  mon.boostBy(boosts as any);
  return true;
}

function tryDireHit(battle: Battle, mon: Pokemon, useFlag: ItemUseFlag): boolean {
  const turnsOut = (mon as any).activeTurns ?? battle.turn;
  if (turnsOut > 1) {
    if (useFlag !== 'ALWAYS_USE') return false;
    if (Math.random() > 0.2) return false;
  } else {
    if (useFlag !== 'ALWAYS_USE' && useFlag !== 'CONTEXT_USE') {
      if (Math.random() > 0.25) return false;
    }
  }

  // Dire Hit sets Focus Energy volatile
  mon.addVolatile('focusenergy');
  return true;
}
