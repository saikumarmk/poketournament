/**
 * Data tables from pokeemerald/data/battle_ai_scripts.s
 * Byte/hword arrays used by if_in_bytes / if_in_hwords checks.
 */
import { E } from './effect-map.js';

// ── Type lists ───────────────────────────────────────────────────────

export const PHYSICAL_TYPES = new Set([
  'Normal', 'Fighting', 'Poison', 'Ground', 'Flying',
  'Rock', 'Bug', 'Ghost', 'Steel',
]);

export const SPECIAL_TYPES = new Set([
  'Fire', 'Water', 'Grass', 'Electric',
  'Psychic', 'Ice', 'Dragon', 'Dark',
]);

export const SANDSTORM_RESISTANT_TYPES = new Set(['Ground', 'Rock', 'Steel']);

// AI_CV_AttackDown_PhysicalTypeList (missing Flying, Poison, Ghost — original bug)
export const ATTACK_DOWN_PHYSICAL_TYPES = new Set([
  'Normal', 'Fighting', 'Ground', 'Rock', 'Bug', 'Steel',
]);

// ── Sound moves (Soundproof check) ──────────────────────────────────

export const SOUND_MOVES = new Set([
  'growl', 'roar', 'sing', 'supersonic', 'screech',
  'snore', 'uproar', 'metalsound', 'grasswhistle',
]);

// ── Mirror Move encouraged targets ──────────────────────────────────

export const MIRROR_MOVE_ENCOURAGED = new Set([
  'sleeppowder', 'lovelykiss', 'spore', 'hypnosis', 'sing',
  'grasswhistle', 'shadowpunch', 'sandattack', 'smokescreen',
  'toxic', 'guillotine', 'horndrill', 'fissure', 'sheercold',
  'crosschop', 'aeroblast', 'confuseray', 'sweetkiss', 'screech',
  'cottonspore', 'scaryface', 'faketears', 'metalsound',
  'thunderwave', 'glare', 'poisonpowder', 'shadowball',
  'dynamicpunch', 'hyperbeam', 'extremespeed', 'thief', 'covet',
  'attract', 'swagger', 'torment', 'flatter', 'trick',
  'superpower', 'skillswap',
]);

// ── Protect chain moves ─────────────────────────────────────────────

export const PROTECT_MOVES = new Set(['protect', 'detect']);

// ── Encore encouraged effects ───────────────────────────────────────

export const ENCORE_ENCOURAGED_EFFECTS = new Set<E>([
  E.DREAM_EATER, E.ATTACK_UP, E.DEFENSE_UP, E.SPEED_UP,
  E.SPECIAL_ATTACK_UP, E.HAZE, E.ROAR, E.CONVERSION,
  E.TOXIC, E.LIGHT_SCREEN, E.REST, E.SUPER_FANG,
  E.SPECIAL_DEFENSE_UP_2, E.CONFUSE, E.POISON, E.PARALYZE,
  E.LEECH_SEED, E.SPLASH, E.ATTACK_UP_2, E.ENCORE,
  E.CONVERSION_2, E.LOCK_ON, E.HEAL_BELL, E.MEAN_LOOK,
  E.NIGHTMARE, E.PROTECT, E.SKILL_SWAP, E.FORESIGHT,
  E.PERISH_SONG, E.SANDSTORM, E.ENDURE, E.SWAGGER,
  E.ATTRACT, E.SAFEGUARD, E.RAIN_DANCE, E.SUNNY_DAY,
  E.BELLY_DRUM, E.PSYCH_UP, E.FUTURE_SIGHT, E.FAKE_OUT,
  E.STOCKPILE, E.SPIT_UP, E.SWALLOW, E.HAIL,
  E.TORMENT, E.WILL_O_WISP, E.FOLLOW_ME, E.CHARGE,
  E.TRICK, E.ROLE_PLAY, E.INGRAIN, E.RECYCLE,
  E.KNOCK_OFF, E.SKILL_SWAP, E.IMPRISON, E.REFRESH,
  E.GRUDGE, E.TEETER_DANCE, E.MUD_SPORT, E.WATER_SPORT,
  E.DRAGON_DANCE, E.CAMOUFLAGE,
]);

// ── Thief encouraged hold effects (mapped to @pkmn/sim item names) ──

export const THIEF_ENCOURAGED_ITEMS = new Set([
  'chestoberry', 'lumberry', 'sitrusberry', 'leftovers',
  'brightpowder', 'lightball', 'thickclub',
]);

// ── Change self ability encouraged abilities ────────────────────────

export const ROLE_PLAY_ENCOURAGED_ABILITIES = new Set([
  'speedboost', 'battlearmor', 'sandveil', 'static',
  'flashfire', 'wonderguard', 'effectspore', 'swiftswim',
  'hugepower', 'raindish', 'cutecharm', 'shedskin',
  'marvelscale', 'purepower', 'chlorophyll', 'shielddust',
]);

// ── Trick item effects ──────────────────────────────────────────────

export const TRICK_CHOICE_ITEMS = new Set(['choiceband']);
export const TRICK_CONFUSE_ITEMS = new Set([
  'figyberry', 'wikiberry', 'magoberry', 'aguavberry',
  'iapapaberry', 'machobrace', 'choiceband',
]);

// ── Recycle encouraged items ────────────────────────────────────────

export const RECYCLE_ENCOURAGED_ITEMS = new Set([
  'chestoberry', 'lumberry', 'starfberry',
]);

// ── Setup first turn encouraged effects ─────────────────────────────

export const SETUP_FIRST_TURN_EFFECTS = new Set<E>([
  E.ATTACK_UP, E.DEFENSE_UP, E.SPEED_UP,
  E.SPECIAL_ATTACK_UP, E.SPECIAL_DEFENSE_UP,
  E.ACCURACY_UP, E.EVASION_UP,
  E.ATTACK_DOWN, E.DEFENSE_DOWN, E.SPEED_DOWN,
  E.SPECIAL_ATTACK_DOWN, E.SPECIAL_DEFENSE_DOWN,
  E.ACCURACY_DOWN, E.EVASION_DOWN,
  E.CONVERSION, E.LIGHT_SCREEN,
  E.SPECIAL_DEFENSE_UP_2, E.FOCUS_ENERGY, E.CONFUSE,
  E.ATTACK_UP_2, E.DEFENSE_UP_2, E.SPEED_UP_2,
  E.SPECIAL_ATTACK_UP_2, E.SPECIAL_DEFENSE_UP_2,
  E.ACCURACY_UP_2, E.EVASION_UP_2,
  E.ATTACK_DOWN_2, E.DEFENSE_DOWN_2, E.SPEED_DOWN_2,
  E.SPECIAL_ATTACK_DOWN_2, E.SPECIAL_DEFENSE_DOWN_2,
  E.ACCURACY_DOWN_2, E.EVASION_DOWN_2,
  E.REFLECT, E.POISON, E.PARALYZE,
  E.SUBSTITUTE, E.LEECH_SEED, E.MINIMIZE,
  E.CURSE, E.SWAGGER, E.CAMOUFLAGE, E.YAWN,
  E.DEFENSE_CURL, E.TORMENT, E.FLATTER,
  E.WILL_O_WISP, E.INGRAIN, E.IMPRISON,
  E.TEETER_DANCE, E.TICKLE, E.COSMIC_POWER,
  E.BULK_UP, E.CALM_MIND, E.CAMOUFLAGE,
]);

// ── Risky encouraged effects ────────────────────────────────────────

export const RISKY_EFFECTS = new Set<E>([
  E.SLEEP, E.EXPLOSION, E.MIRROR_MOVE, E.OHKO,
  E.HIGH_CRITICAL, E.CONFUSE, E.METRONOME, E.PSYWAVE,
  E.COUNTER, E.DESTINY_BOND, E.SWAGGER, E.ATTRACT,
  E.PRESENT, E.ALL_STATS_UP_HIT, E.BELLY_DRUM,
  E.MIRROR_COAT, E.FOCUS_PUNCH, E.REVENGE,
  E.TEETER_DANCE,
]);

// ── HP-aware discouraged effect tables ──────────────────────────────

export const HP_AWARE_DISCOURAGED_USER_HIGH = new Set<E>([
  E.EXPLOSION, E.RESTORE_HP, E.REST, E.DESTINY_BOND,
  E.FLAIL, E.ENDURE, E.MORNING_SUN, E.SYNTHESIS,
  E.MOONLIGHT, E.SOFTBOILED, E.MEMENTO, E.GRUDGE,
  E.OVERHEAT,
]);

export const HP_AWARE_DISCOURAGED_USER_MED = new Set<E>([
  E.EXPLOSION,
  E.ATTACK_UP, E.DEFENSE_UP, E.SPEED_UP,
  E.SPECIAL_ATTACK_UP, E.SPECIAL_DEFENSE_UP,
  E.ACCURACY_UP, E.EVASION_UP,
  E.ATTACK_DOWN, E.DEFENSE_DOWN, E.SPEED_DOWN,
  E.SPECIAL_ATTACK_DOWN, E.SPECIAL_DEFENSE_DOWN,
  E.ACCURACY_DOWN, E.EVASION_DOWN,
  E.BIDE, E.CONVERSION, E.LIGHT_SCREEN, E.MIST,
  E.FOCUS_ENERGY,
  E.ATTACK_UP_2, E.DEFENSE_UP_2, E.SPEED_UP_2,
  E.SPECIAL_ATTACK_UP_2, E.SPECIAL_DEFENSE_UP_2,
  E.ACCURACY_UP_2, E.EVASION_UP_2,
  E.ATTACK_DOWN_2, E.DEFENSE_DOWN_2, E.SPEED_DOWN_2,
  E.SPECIAL_ATTACK_DOWN_2, E.SPECIAL_DEFENSE_DOWN_2,
  E.ACCURACY_DOWN_2, E.EVASION_DOWN_2,
  E.CONVERSION_2, E.SAFEGUARD, E.BELLY_DRUM,
  E.TICKLE, E.COSMIC_POWER, E.BULK_UP,
  E.CALM_MIND, E.DRAGON_DANCE,
]);

export const HP_AWARE_DISCOURAGED_USER_LOW = new Set<E>([
  E.ATTACK_UP, E.DEFENSE_UP, E.SPEED_UP,
  E.SPECIAL_ATTACK_UP, E.SPECIAL_DEFENSE_UP,
  E.ACCURACY_UP, E.EVASION_UP,
  E.ATTACK_DOWN, E.DEFENSE_DOWN, E.SPEED_DOWN,
  E.SPECIAL_ATTACK_DOWN, E.SPECIAL_DEFENSE_DOWN,
  E.ACCURACY_DOWN, E.EVASION_DOWN,
  E.BIDE, E.CONVERSION, E.LIGHT_SCREEN, E.MIST,
  E.FOCUS_ENERGY,
  E.ATTACK_UP_2, E.DEFENSE_UP_2, E.SPEED_UP_2,
  E.SPECIAL_ATTACK_UP_2, E.SPECIAL_DEFENSE_UP_2,
  E.ACCURACY_UP_2, E.EVASION_UP_2,
  E.ATTACK_DOWN_2, E.DEFENSE_DOWN_2, E.SPEED_DOWN_2,
  E.SPECIAL_ATTACK_DOWN_2, E.SPECIAL_DEFENSE_DOWN_2,
  E.ACCURACY_DOWN_2, E.EVASION_DOWN_2,
  E.RAGE, E.CONVERSION_2, E.LOCK_ON, E.SAFEGUARD,
  E.BELLY_DRUM, E.PSYCH_UP, E.MIRROR_COAT,
  E.SOLAR_BEAM, E.ERUPTION,
  E.TICKLE, E.COSMIC_POWER, E.BULK_UP,
  E.CALM_MIND, E.DRAGON_DANCE,
]);

export const HP_AWARE_DISCOURAGED_TARGET_HIGH = new Set<E>([]);

export const HP_AWARE_DISCOURAGED_TARGET_MED = new Set<E>([
  E.ATTACK_UP, E.DEFENSE_UP, E.SPEED_UP,
  E.SPECIAL_ATTACK_UP, E.SPECIAL_DEFENSE_UP,
  E.ACCURACY_UP, E.EVASION_UP,
  E.ATTACK_DOWN, E.DEFENSE_DOWN, E.SPEED_DOWN,
  E.SPECIAL_ATTACK_DOWN, E.SPECIAL_DEFENSE_DOWN,
  E.ACCURACY_DOWN, E.EVASION_DOWN,
  E.MIST, E.FOCUS_ENERGY,
  E.ATTACK_UP_2, E.DEFENSE_UP_2, E.SPEED_UP_2,
  E.SPECIAL_ATTACK_UP_2, E.SPECIAL_DEFENSE_UP_2,
  E.ACCURACY_UP_2, E.EVASION_UP_2,
  E.ATTACK_DOWN_2, E.DEFENSE_DOWN_2, E.SPEED_DOWN_2,
  E.SPECIAL_ATTACK_DOWN_2, E.SPECIAL_DEFENSE_DOWN_2,
  E.ACCURACY_DOWN_2, E.EVASION_DOWN_2,
  E.POISON, E.PAIN_SPLIT, E.PERISH_SONG, E.SAFEGUARD,
  E.TICKLE, E.COSMIC_POWER, E.BULK_UP,
  E.CALM_MIND, E.DRAGON_DANCE,
]);

export const HP_AWARE_DISCOURAGED_TARGET_LOW = new Set<E>([
  E.SLEEP, E.EXPLOSION,
  E.ATTACK_UP, E.DEFENSE_UP, E.SPEED_UP,
  E.SPECIAL_ATTACK_UP, E.SPECIAL_DEFENSE_UP,
  E.ACCURACY_UP, E.EVASION_UP,
  E.ATTACK_DOWN, E.DEFENSE_DOWN, E.SPEED_DOWN,
  E.SPECIAL_ATTACK_DOWN, E.SPECIAL_DEFENSE_DOWN,
  E.ACCURACY_DOWN, E.EVASION_DOWN,
  E.BIDE, E.CONVERSION, E.TOXIC, E.LIGHT_SCREEN,
  E.OHKO, E.SUPER_FANG, E.SUPER_FANG,
  E.MIST, E.FOCUS_ENERGY, E.CONFUSE,
  E.ATTACK_UP_2, E.DEFENSE_UP_2, E.SPEED_UP_2,
  E.SPECIAL_ATTACK_UP_2, E.SPECIAL_DEFENSE_UP_2,
  E.ACCURACY_UP_2, E.EVASION_UP_2,
  E.ATTACK_DOWN_2, E.DEFENSE_DOWN_2, E.SPEED_DOWN_2,
  E.SPECIAL_ATTACK_DOWN_2, E.SPECIAL_DEFENSE_DOWN_2,
  E.ACCURACY_DOWN_2, E.EVASION_DOWN_2,
  E.POISON, E.PARALYZE, E.PAIN_SPLIT,
  E.CONVERSION_2, E.LOCK_ON, E.SPITE,
  E.PERISH_SONG, E.SWAGGER, E.FURY_CUTTER,
  E.ATTRACT, E.SAFEGUARD, E.PSYCH_UP,
  E.MIRROR_COAT, E.WILL_O_WISP,
  E.TICKLE, E.COSMIC_POWER, E.BULK_UP,
  E.CALM_MIND, E.DRAGON_DANCE,
]);

// ── Baton Pass encouraged moves ─────────────────────────────────────

export const BATON_PASS_SETUP_MOVES = new Set([
  'swordsdance', 'dragondance', 'calmmind',
]);
