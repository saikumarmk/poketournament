/**
 * Data tables ported from pokecrystal/data/battle/ai/*.asm
 * These use @pkmn/sim move IDs (lowercase, no spaces).
 */

// pokecrystal/data/battle/ai/useful_moves.asm
export const USEFUL_MOVES = new Set([
  'doubleedge', 'sing', 'flamethrower', 'hydropump', 'surf',
  'icebeam', 'blizzard', 'hyperbeam', 'sleeppowder', 'thunderbolt',
  'thunder', 'earthquake', 'toxic', 'psychic', 'hypnosis',
  'recover', 'fireblast', 'softboiled', 'superfang',
]);

// pokecrystal/data/battle/ai/stall_moves.asm
export const STALL_MOVES = new Set([
  'swordsdance', 'tailwhip', 'leer', 'growl', 'disable', 'mist',
  'counter', 'leechseed', 'growth', 'stringshot', 'meditate',
  'agility', 'rage', 'mimic', 'screech', 'harden', 'withdraw',
  'defensecurl', 'barrier', 'lightscreen', 'haze', 'reflect',
  'focusenergy', 'bide', 'amnesia', 'transform', 'splash',
  'acidarmor', 'sharpen', 'conversion', 'substitute', 'flamewheel',
]);

// pokecrystal/data/battle/ai/residual_moves.asm
export const RESIDUAL_MOVES = new Set([
  'mist', 'leechseed', 'poisonpowder', 'stunspore', 'thunderwave',
  'focusenergy', 'bide', 'poisongas', 'transform', 'conversion',
  'substitute', 'spikes',
]);

// pokecrystal/data/battle/ai/encore_moves.asm
export const ENCORE_MOVES = new Set([
  'swordsdance', 'whirlwind', 'leer', 'roar', 'disable', 'mist',
  'leechseed', 'growth', 'poisonpowder', 'stringshot', 'meditate',
  'agility', 'teleport', 'screech', 'haze', 'focusenergy',
  'dreameater', 'poisongas', 'splash', 'sharpen', 'conversion',
  'superfang', 'substitute', 'triplekick', 'spiderweb', 'mindreader',
  'flamewheel', 'aeroblast', 'cottonspore', 'powdersnow',
]);

// pokecrystal/data/battle/ai/rain_dance_moves.asm
export const RAIN_DANCE_MOVES = new Set([
  'watergun', 'hydropump', 'surf', 'bubblebeam', 'thunder',
  'waterfall', 'clamp', 'bubble', 'crabhammer', 'octazooka',
  'whirlpool',
]);

// pokecrystal/data/battle/ai/sunny_day_moves.asm
export const SUNNY_DAY_MOVES = new Set([
  'firepunch', 'ember', 'flamethrower', 'firespin', 'fireblast',
  'sacredfire', 'morningsun', 'synthesis',
]);

// Effect categories — mapped to @pkmn/sim volatileStatus / move flags

// pokecrystal/data/battle/ai/risky_effects.asm
export const RISKY_EFFECT_MOVES = new Set([
  'selfdestruct', 'explosion', // EFFECT_SELFDESTRUCT
  'guillotine', 'horndrill', 'fissure', 'sheercold', // EFFECT_OHKO
]);

// pokecrystal/data/battle/ai/reckless_moves.asm (effect-based)
export const RECKLESS_EFFECT_IDS = new Set([
  'selfdestruct', 'explosion', // EFFECT_SELFDESTRUCT
  'thrash', 'petaldance', 'outrage', // EFFECT_RAMPAGE
  'doubleslap', 'cometpunch', 'furyattack', 'pinmissile', 'spikecannon', 'barrage', 'bonemerang', // EFFECT_MULTI_HIT
  'doublekick', 'twineedle', // EFFECT_DOUBLE_HIT
]);

// pokecrystal/data/battle/ai/constant_damage_effects.asm
export const CONSTANT_DAMAGE_MOVES = new Set([
  'superfang', // EFFECT_SUPER_FANG
  'sonicboom', 'dragonrage', // EFFECT_STATIC_DAMAGE
  'nightshade', 'seismictoss', // EFFECT_LEVEL_DAMAGE
  'psywave', // EFFECT_PSYWAVE
]);

// Status-only effects — moves that only inflict status
export const STATUS_ONLY_MOVES = new Set([
  'sing', 'sleeppowder', 'hypnosis', 'lovelykiss', 'spore', 'grasswhistle', // sleep
  'toxic', // toxic
  'poisonpowder', 'poisongas', // poison
  'thunderwave', 'stunspore', 'glare', // paralyze
]);

// Stat-up moves (for AI_SETUP)
export const STAT_UP_MOVES = new Set([
  'swordsdance', 'growth', 'meditate', 'agility', 'doubleteam',
  'harden', 'minimize', 'withdraw', 'defensecurl', 'barrier',
  'amnesia', 'acidarmor', 'sharpen',
]);

// Stat-down moves (for AI_SETUP)
export const STAT_DOWN_MOVES = new Set([
  'growl', 'leer', 'tailwhip', 'stringshot', 'screech',
  'cottonspore', 'charm', 'scaryface', 'sweetscent',
]);

// Healing moves
export const HEAL_MOVES = new Set([
  'recover', 'softboiled', 'milkdrink', 'rest',
  'morningsun', 'synthesis', 'moonlight',
]);

// Sleep-inducing moves
export const SLEEP_MOVES = new Set([
  'sing', 'sleeppowder', 'hypnosis', 'lovelykiss', 'spore',
]);

// Weather-related
export const WEATHER_MOVES: Record<string, string> = {
  raindance: 'RainDance',
  sunnyday: 'SunnyDay',
  sandstorm: 'Sandstorm',
};
