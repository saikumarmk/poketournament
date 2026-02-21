import fs from 'fs';
import path from 'path';
import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';

const POKEEMERALD = path.resolve(import.meta.dirname, '..', 'pokeemerald');
const gens = new Generations(Dex);
const gen = gens.get(3);

interface PokemonData {
  species: string;
  level: number;
  moves: string[];
  item: string | null;
  iv: number;
}

interface TrainerData {
  name: string;
  trainerClass: string;
  location: string;
  pokemon: PokemonData[];
  aiFlags: string[];
  items: (string | null)[];
  doubleBattle: boolean;
}

// ── Constant-to-name resolution ──────────────────────────────────────

const SPECIES_EXCEPTIONS: Record<string, string> = {
  NIDORAN_F: 'Nidoran-F',
  NIDORAN_M: 'Nidoran-M',
  FARFETCHD: "Farfetch'd",
  MR_MIME: 'Mr. Mime',
  HO_OH: 'Ho-Oh',
};

function speciesConstToName(constant: string): string {
  const raw = constant.replace(/^SPECIES_/, '');
  if (SPECIES_EXCEPTIONS[raw]) return SPECIES_EXCEPTIONS[raw];
  const cleaned = raw.replace(/_/g, ' ').trim();
  const species = gen.species.get(cleaned.toLowerCase().replace(/\s+/g, ''));
  if (species) return species.name;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function moveConstToName(constant: string): string | null {
  if (constant === 'MOVE_NONE') return null;
  const raw = constant.replace(/^MOVE_/, '').replace(/_/g, ' ').trim();
  const move = gen.moves.get(raw.toLowerCase().replace(/\s+/g, ''));
  if (move) return move.name;
  return raw.split(' ').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

function itemConstToName(constant: string): string | null {
  if (constant === 'ITEM_NONE') return null;
  const raw = constant.replace(/^ITEM_/, '').replace(/_/g, ' ').trim();
  const item = gen.items.get(raw.toLowerCase().replace(/\s+/g, ''));
  if (item) return item.name;
  return raw.split(' ').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

function trainerClassToName(constant: string): string {
  return constant
    .replace(/^TRAINER_CLASS_/, '')
    .replace(/_\d+$/, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ── Parse AI flags from bitmask expression ───────────────────────────

const AI_FLAG_NAMES: Record<number, string> = {
  0: 'AI_SCRIPT_CHECK_BAD_MOVE',
  1: 'AI_SCRIPT_TRY_TO_FAINT',
  2: 'AI_SCRIPT_CHECK_VIABILITY',
  3: 'AI_SCRIPT_SETUP_FIRST_TURN',
  4: 'AI_SCRIPT_RISKY',
  5: 'AI_SCRIPT_PREFER_POWER_EXTREMES',
  6: 'AI_SCRIPT_PREFER_BATON_PASS',
  7: 'AI_SCRIPT_DOUBLE_BATTLE',
  8: 'AI_SCRIPT_HP_AWARE',
  9: 'AI_SCRIPT_TRY_SUNNY_DAY_START',
  29: 'AI_SCRIPT_ROAMING',
  30: 'AI_SCRIPT_SAFARI',
  31: 'AI_SCRIPT_FIRST_BATTLE',
};

function parseAiFlags(expr: string): string[] {
  const trimmed = expr.trim();
  if (trimmed === '0') return [];
  return trimmed
    .split('|')
    .map(f => f.trim())
    .filter(f => f.startsWith('AI_SCRIPT_'));
}

// ── Parse trainer_parties.h ──────────────────────────────────────────

interface RawPartyMon {
  iv: number;
  lvl: number;
  species: string;
  heldItem: string | null;
  moves: string[];
}

interface RawParty {
  structType: 'NoItemDefaultMoves' | 'NoItemCustomMoves' | 'ItemDefaultMoves' | 'ItemCustomMoves';
  mons: RawPartyMon[];
}

function parseTrainerParties(): Map<string, RawParty> {
  const data = fs.readFileSync(path.join(POKEEMERALD, 'src/data/trainer_parties.h'), 'utf-8');
  const parties = new Map<string, RawParty>();

  const partyBlockRe = /static\s+const\s+struct\s+TrainerMon(\w+)\s+(sParty_\w+)\[\]\s*=\s*\{([\s\S]*?)^\};/gm;
  let match;
  while ((match = partyBlockRe.exec(data)) !== null) {
    const structType = match[1] as RawParty['structType'];
    const partyName = match[2];
    const body = match[3];

    const mons: RawPartyMon[] = [];
    // Handle one level of brace nesting (the .moves = {...} field)
    const monBlockRe = /\{((?:[^{}]|\{[^{}]*\})*)\}/g;
    let monMatch;
    while ((monMatch = monBlockRe.exec(body)) !== null) {
      const monBody = monMatch[1];
      const iv = parseInt(monBody.match(/\.iv\s*=\s*(\d+)/)![1], 10);
      const lvl = parseInt(monBody.match(/\.lvl\s*=\s*(\d+)/)![1], 10);
      const species = monBody.match(/\.species\s*=\s*(SPECIES_\w+)/)![1];

      let heldItem: string | null = null;
      const itemMatch = monBody.match(/\.heldItem\s*=\s*(ITEM_\w+)/);
      if (itemMatch) {
        heldItem = itemMatch[1];
      }

      let moves: string[] = [];
      const movesMatch = monBody.match(/\.moves\s*=\s*\{([^}]+)\}/);
      if (movesMatch) {
        moves = movesMatch[1]
          .split(',')
          .map(m => m.trim())
          .filter(m => m.length > 0);
      }

      mons.push({ iv, lvl, species, heldItem, moves });
    }

    parties.set(partyName, { structType, mons });
  }

  return parties;
}

// ── Parse trainers.h ─────────────────────────────────────────────────

interface RawTrainer {
  constName: string;
  trainerClass: string;
  trainerName: string;
  items: string[];
  doubleBattle: boolean;
  aiFlags: string[];
  partyName: string;
}

function parseTrainers(): RawTrainer[] {
  const data = fs.readFileSync(path.join(POKEEMERALD, 'src/data/trainers.h'), 'utf-8');
  const trainers: RawTrainer[] = [];

  const trainerRe = /\[(TRAINER_\w+)\]\s*=\s*\{([\s\S]*?)\},?\s*(?=\[TRAINER_|\};)/g;
  let match;
  while ((match = trainerRe.exec(data)) !== null) {
    const constName = match[1];
    const body = match[2];

    if (constName === 'TRAINER_NONE') continue;

    const classMatch = body.match(/\.trainerClass\s*=\s*(TRAINER_CLASS_\w+)/);
    const nameMatch = body.match(/\.trainerName\s*=\s*_\("([^"]*)"\)/);
    const doubleBattleMatch = body.match(/\.doubleBattle\s*=\s*(TRUE|FALSE)/);
    const aiFlagsMatch = body.match(/\.aiFlags\s*=\s*([^,\n]+)/);

    const itemsMatch = body.match(/\.items\s*=\s*\{([^}]*)\}/);
    const items: string[] = [];
    if (itemsMatch && itemsMatch[1].trim()) {
      for (const item of itemsMatch[1].split(',')) {
        const trimmed = item.trim();
        if (trimmed && trimmed !== 'ITEM_NONE') {
          items.push(trimmed);
        }
      }
    }

    const partyMatch = body.match(/\.party\s*=\s*(?:NO_ITEM_DEFAULT_MOVES|NO_ITEM_CUSTOM_MOVES|ITEM_DEFAULT_MOVES|ITEM_CUSTOM_MOVES)\((sParty_\w+)\)/);

    if (!classMatch || !nameMatch || !partyMatch) continue;

    trainers.push({
      constName,
      trainerClass: classMatch[1],
      trainerName: nameMatch[1],
      items,
      doubleBattle: doubleBattleMatch?.[1] === 'TRUE',
      aiFlags: parseAiFlags(aiFlagsMatch?.[1] ?? '0'),
      partyName: partyMatch[1],
    });
  }

  return trainers;
}

// ── Parse trainer locations from map scripts ─────────────────────────

function mapDirToReadableName(dir: string): string {
  return dir
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/(\d)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/\bB(\d+F)\b/g, 'B$1');
}

function parseTrainerLocations(): Map<string, string> {
  const mapsDir = path.join(POKEEMERALD, 'data/maps');
  const locationMap = new Map<string, string>();

  for (const dir of fs.readdirSync(mapsDir)) {
    const scriptsPath = path.join(mapsDir, dir, 'scripts.inc');
    if (!fs.existsSync(scriptsPath)) continue;

    const mapName = mapDirToReadableName(dir);
    const content = fs.readFileSync(scriptsPath, 'utf-8');

    const trainerRe = /trainerbattle(?:_\w+)?\s+(?:TRAINER_BATTLE_\w+\s*,\s*)?(TRAINER_\w+)/g;
    let m;
    while ((m = trainerRe.exec(content)) !== null) {
      const trainerConst = m[1];
      if (!locationMap.has(trainerConst)) {
        locationMap.set(trainerConst, mapName);
      }
    }
  }

  // Propagate locations between base trainers and rematch variants
  // e.g., TRAINER_ROSE_1 → Route 117, so TRAINER_ROSE_2..5 → Route 117
  // Also works if only _2 has a location (propagates back to _1 and forward)
  const grouped = new Map<string, { idx: number; constName: string }[]>();
  for (const [constName] of locationMap) {
    const m = constName.match(/^(TRAINER_.+?)_(\d+)$/);
    if (!m) continue;
    const group = grouped.get(m[1]) ?? [];
    group.push({ idx: parseInt(m[2], 10), constName });
    grouped.set(m[1], group);
  }
  for (const [base, entries] of grouped) {
    const known = entries.find(e => locationMap.has(e.constName));
    if (!known) continue;
    const location = locationMap.get(known.constName)!;
    for (let i = 1; i <= 6; i++) {
      const name = `${base}_${i}`;
      if (!locationMap.has(name)) {
        locationMap.set(name, location);
      }
    }
  }

  return locationMap;
}

// ── Parse learnsets ──────────────────────────────────────────────────

function parseLearnsets(): Map<string, [number, string][]> {
  const data = fs.readFileSync(path.join(POKEEMERALD, 'src/data/pokemon/level_up_learnsets.h'), 'utf-8');
  const learnsets = new Map<string, [number, string][]>();

  const blockRe = /static\s+const\s+u16\s+s(\w+)LevelUpLearnset\[\]\s*=\s*\{([\s\S]*?)\};/g;
  let match;
  while ((match = blockRe.exec(data)) !== null) {
    const rawSpecies = match[1];
    const body = match[2];

    const LABEL_SPECIES: Record<string, string> = {
      MrMime: 'Mr. Mime',
      Farfetchd: "Farfetch'd",
      NidoranF: 'Nidoran-F',
      NidoranM: 'Nidoran-M',
      HoOh: 'Ho-Oh',
    };

    let speciesName = LABEL_SPECIES[rawSpecies];
    if (!speciesName) {
      const species = gen.species.get(rawSpecies.toLowerCase());
      speciesName = species ? species.name : rawSpecies;
    }

    const moves: [number, string][] = [];
    const moveRe = /LEVEL_UP_MOVE\(\s*(\d+)\s*,\s*(MOVE_\w+)\s*\)/g;
    let moveMatch;
    while ((moveMatch = moveRe.exec(body)) !== null) {
      const level = parseInt(moveMatch[1], 10);
      const moveName = moveConstToName(moveMatch[2]);
      if (moveName) {
        moves.push([level, moveName]);
      }
    }

    learnsets.set(speciesName, moves);
  }

  return learnsets;
}

// ── Populate default moves from learnsets ────────────────────────────

function populateLevelUpMoves(
  trainers: TrainerData[],
  learnsets: Map<string, [number, string][]>,
): void {
  for (const trainer of trainers) {
    for (const poke of trainer.pokemon) {
      if (poke.moves.length > 0) continue;

      const moves = learnsets.get(poke.species);
      if (!moves) continue;

      const learned = moves
        .filter(([lvl]) => lvl <= poke.level)
        .map(([, m]) => m);
      // Deduplicate (some learnsets have repeated entries at different levels)
      const unique: string[] = [];
      for (const m of learned) {
        const idx = unique.indexOf(m);
        if (idx !== -1) unique.splice(idx, 1);
        unique.push(m);
      }
      poke.moves = unique.slice(-4);
    }
  }
}

// ── Assemble final trainer data ──────────────────────────────────────

function assembleTrainers(
  rawTrainers: RawTrainer[],
  parties: Map<string, RawParty>,
  locationMap: Map<string, string>,
): TrainerData[] {
  const trainers: TrainerData[] = [];
  const locationCounts = new Map<string, number>();

  for (const raw of rawTrainers) {
    const party = parties.get(raw.partyName);
    if (!party) {
      console.warn(`Party not found: ${raw.partyName} for ${raw.constName}`);
      continue;
    }

    const pokemon: PokemonData[] = party.mons.map(mon => ({
      species: speciesConstToName(mon.species),
      level: mon.lvl,
      moves: mon.moves
        .map(moveConstToName)
        .filter((m): m is string => m !== null),
      item: mon.heldItem ? itemConstToName(mon.heldItem) : null,
      iv: mon.iv,
    }));

    const trainerClass = trainerClassToName(raw.trainerClass);
    const displayName = raw.trainerName || trainerClass;
    const mapLocation = locationMap.get(raw.constName) ?? '';
    let displayLocation = mapLocation || raw.constName
      .replace(/^TRAINER_/, '')
      .replace(/_/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    const key = `${displayName}|${displayLocation}`;
    const count = (locationCounts.get(key) ?? 0) + 1;
    locationCounts.set(key, count);
    if (count > 1) {
      displayLocation = `${displayLocation} ${String.fromCharCode(64 + count)}`;
    }

    const items: (string | null)[] = raw.items.map(itemConstToName);

    trainers.push({
      name: displayName,
      trainerClass,
      location: displayLocation,
      pokemon,
      aiFlags: raw.aiFlags,
      items,
      doubleBattle: raw.doubleBattle,
    });
  }

  return trainers;
}

// ── Main ─────────────────────────────────────────────────────────────

function generate(setLevel: number | null, suffix: string) {
  const parties = parseTrainerParties();
  const rawTrainers = parseTrainers();
  const locationMap = parseTrainerLocations();
  const learnsets = parseLearnsets();

  const trainers = assembleTrainers(rawTrainers, parties, locationMap);

  if (setLevel !== null) {
    for (const t of trainers) {
      for (const p of t.pokemon) {
        p.level = setLevel;
      }
    }
  }

  populateLevelUpMoves(trainers, learnsets);

  const outDir = path.resolve(import.meta.dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, `trainers-gen3${suffix}.json`),
    JSON.stringify(trainers, null, 2),
  );

  console.log(`Wrote ${trainers.length} Gen 3 trainers to data/trainers-gen3${suffix}.json`);

  const noMoves = trainers.filter(t => t.pokemon.some(p => p.moves.length === 0));
  if (noMoves.length) {
    console.log(`Warning: ${noMoves.length} trainers have Pokemon with no moves`);
    for (const t of noMoves.slice(0, 5)) {
      const bad = t.pokemon.filter(p => p.moves.length === 0);
      console.log(`  ${t.name} (${t.location}): ${bad.map(p => `${p.species} Lv${p.level}`).join(', ')}`);
    }
  }

  const withItems = trainers.filter(t => t.items.length > 0);
  console.log(`  ${withItems.length} trainers have battle items`);

  const withAI = trainers.filter(t => t.aiFlags.length > 1);
  console.log(`  ${withAI.length} trainers have advanced AI (beyond CHECK_BAD_MOVE)`);
}

function main() {
  generate(null, '');
  generate(50, '-lv50');
}

main();
