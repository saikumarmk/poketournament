import fs from 'fs';
import path from 'path';
import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';

const POKECRYSTAL = path.resolve(import.meta.dirname, '..', 'pokecrystal');
const gens = new Generations(Dex);
const gen = gens.get(2);

interface PokemonData {
  species: string;
  level: number;
  moves: string[];
  item: string | null;
}

interface TrainerData {
  name: string;
  trainerClass: string;
  location: string;
  pokemon: PokemonData[];
  aiFlags: string[];
  switchFlag: 'SWITCH_OFTEN' | 'SWITCH_SOMETIMES' | 'SWITCH_RARELY' | null;
  trainerItems: [string | null, string | null];
  itemUseFlag: 'CONTEXT_USE' | 'ALWAYS_USE' | null;
}

interface MoveInfo {
  power: number;
  type: string;
  accuracy: number;
}

// ── ASM name resolution ──────────────────────────────────────────────

function asmToSpecies(asm: string): string {
  const cleaned = asm.replace(/__/g, ' ').replace(/_/g, ' ').trim();
  const exceptions: Record<string, string> = {
    'MR  MIME': 'Mr. Mime', 'MR MIME': 'Mr. Mime',
    'NIDORAN M': 'Nidoran-M', 'NIDORAN F': 'Nidoran-F',
    'FARFETCH D': "Farfetch'd", 'HO OH': 'Ho-Oh',
  };
  const upper = cleaned.toUpperCase();
  if (exceptions[upper]) return exceptions[upper];
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function asmToMove(asm: string): string {
  if (asm === 'NO_MOVE') return '';
  const cleaned = asm.replace(/_/g, ' ').trim();
  if (cleaned === 'PSYCHIC M') return 'Psychic';
  if (cleaned === 'ANCIENTPOWER') return 'Ancient Power';
  if (cleaned === 'DRAGONBREATH') return 'Dragon Breath';
  if (cleaned === 'DYNAMICPUNCH') return 'Dynamic Punch';
  if (cleaned === 'EXTREMESPEED') return 'Extreme Speed';
  if (cleaned === 'POISONPOWDER') return 'Poison Powder';
  if (cleaned === 'THUNDERPUNCH') return 'Thunder Punch';
  if (cleaned === 'SOLARBEAM') return 'Solar Beam';

  const move = gen.moves.get(cleaned.toLowerCase().replace(/\s+/g, ''));
  if (move) return move.name;

  return cleaned.split(' ').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

function asmToItem(asm: string): string | null {
  if (asm === 'NO_ITEM') return null;
  const cleaned = asm.replace(/_/g, ' ').trim().toLowerCase();
  const item = gen.items.get(cleaned.replace(/\s+/g, ''));
  if (item) return item.name;
  return cleaned.split(' ').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

// ── Parse trainer class constants ────────────────────────────────────

interface TrainerClassInfo {
  name: string;
  constNames: string[]; // ordered const names within this class
}

function parseTrainerConstants(): Map<number, TrainerClassInfo> {
  const data = fs.readFileSync(path.join(POKECRYSTAL, 'constants/trainer_constants.asm'), 'utf-8');
  const classes = new Map<number, TrainerClassInfo>();
  let idx = -1;
  let current: TrainerClassInfo | null = null;

  for (const line of data.split('\n')) {
    const classMatch = line.match(/^\s*trainerclass\s+(\w+)/);
    if (classMatch) {
      if (current && idx >= 0) classes.set(idx, current);
      idx++;
      current = { name: classMatch[1], constNames: [] };
      continue;
    }
    const constMatch = line.match(/^\s*const\s+(\w+)/);
    if (constMatch && current) {
      current.constNames.push(constMatch[1]);
    }
  }
  if (current && idx >= 0) classes.set(idx, current);
  return classes;
}

// ── Parse locations from map scripts ────────────────────────────────

function parseTrainerLocations(): Map<string, string> {
  const mapsDir = path.join(POKECRYSTAL, 'maps');
  const locationMap = new Map<string, string>();

  for (const file of fs.readdirSync(mapsDir)) {
    if (!file.endsWith('.asm')) continue;
    const mapName = file.replace('.asm', '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/(\d)([A-Z][a-z])/g, '$1 $2') // "1Floor" → "1 Floor" but not "1F"
      .replace(/([a-z])(\d)/g, '$1 $2')       // "Tower1" → "Tower 1"
      .replace(/B(\d+F)/g, 'B$1');             // keep "B1F", "B2F" etc. together

    const content = fs.readFileSync(path.join(mapsDir, file), 'utf-8');
    for (const line of content.split('\n')) {
      // Match: trainer CLASS, CONST_NAME, ... or loadtrainer CLASS, CONST_NAME
      const m = line.match(/(?:trainer|loadtrainer)\s+(\w+)\s*,\s*(\w+)/);
      if (m) {
        const constName = m[2];
        locationMap.set(constName, mapName);
      }
    }
  }

  return locationMap;
}

// ── Parse AI attributes ──────────────────────────────────────────────

interface ClassAttributes {
  aiFlags: string[];
  switchFlag: 'SWITCH_OFTEN' | 'SWITCH_SOMETIMES' | 'SWITCH_RARELY' | null;
  items: [string | null, string | null];
  itemUseFlag: 'CONTEXT_USE' | 'ALWAYS_USE' | null;
}

function parseAiAttributes(): Map<number, ClassAttributes> {
  const data = fs.readFileSync(path.join(POKECRYSTAL, 'data/trainers/attributes.asm'), 'utf-8');
  const attrs = new Map<number, ClassAttributes>();
  let classIdx = 0;
  let pendingItems: [string | null, string | null] = [null, null];
  let pendingAiFlags: string[] | null = null;

  for (const line of data.split('\n')) {
    const itemMatch = line.match(/^\s*db\s+(\w+),\s*(\w+)\s*;\s*items/);
    if (itemMatch) {
      pendingItems = [
        itemMatch[1] === 'NO_ITEM' ? null : itemMatch[1],
        itemMatch[2] === 'NO_ITEM' ? null : itemMatch[2],
      ];
      continue;
    }

    const aiMatch = line.match(/^\s*dw\s+(AI_[\w\s|]+)/);
    if (aiMatch) {
      pendingAiFlags = aiMatch[1].split('|').map(f => f.trim()).filter(f => f.startsWith('AI_'));
      continue;
    }

    const switchMatch = line.match(/^\s*dw\s+.*(SWITCH_\w+)/);
    if (switchMatch && pendingAiFlags) {
      const flag = switchMatch[1] as ClassAttributes['switchFlag'];
      const useFlag = line.includes('ALWAYS_USE') ? 'ALWAYS_USE' as const
        : line.includes('CONTEXT_USE') ? 'CONTEXT_USE' as const
        : null;
      attrs.set(classIdx, {
        aiFlags: pendingAiFlags,
        switchFlag: flag,
        items: pendingItems,
        itemUseFlag: useFlag,
      });
      pendingAiFlags = null;
      pendingItems = [null, null];
      classIdx++;
    }
  }
  return attrs;
}

// ── Parse parties ────────────────────────────────────────────────────

function parseParties(
  classMap: Map<number, TrainerClassInfo>,
  aiMap: Map<number, ClassAttributes>,
  locationMap: Map<string, string>,
): TrainerData[] {
  const data = fs.readFileSync(path.join(POKECRYSTAL, 'data/trainers/parties.asm'), 'utf-8');
  const lines = data.split('\n');
  const allTrainers: TrainerData[] = [];

  // Groups in parties.asm start at class 1 (TRAINER_NONE=0 has no group)
  let groupIdx = 1;
  let currentClassInfo: TrainerClassInfo | null = null;
  let currentGroupClassIdx = 0;

  let trainerType = 'TRAINERTYPE_NORMAL';
  let trainerName = '';
  let pokemon: PokemonData[] = [];
  let inTrainer = false;
  let trainerCount = 0; // 0-based index within this class group

  const locationCounts = new Map<string, number>();

  function emitTrainer() {
    if (!inTrainer || pokemon.length === 0 || !currentClassInfo) return;

    const constName = currentClassInfo.constNames[trainerCount] ?? '';
    const mapLocation = locationMap.get(constName) ?? '';

    let displayName = trainerName;
    let displayLocation = mapLocation || currentClassInfo.name;

    // For rivals, extract starter info from const name
    const starterMatch = constName.match(/RIVAL[12]_\d+_(CHIKORITA|CYNDAQUIL|TOTODILE)/);
    if (starterMatch) {
      const starter = starterMatch[1].charAt(0) + starterMatch[1].slice(1).toLowerCase();
      displayName = 'Silver';
      displayLocation = mapLocation ? `${mapLocation} (${starter})` : starter;
    } else if (currentClassInfo.name === 'RIVAL1' || currentClassInfo.name === 'RIVAL2') {
      displayName = 'Silver';
    }

    // Ensure unique name+location combos by appending a letter suffix
    const key = `${displayName}|${displayLocation}`;
    const count = (locationCounts.get(key) ?? 0) + 1;
    locationCounts.set(key, count);
    if (count > 1) {
      displayLocation = `${displayLocation} ${String.fromCharCode(64 + count)}`; // A, B, C...
    }

    const classAttrs = aiMap.get(currentGroupClassIdx);
    allTrainers.push({
      name: displayName,
      trainerClass: currentClassInfo.name,
      location: displayLocation,
      pokemon,
      aiFlags: classAttrs?.aiFlags ?? [],
      switchFlag: classAttrs?.switchFlag ?? null,
      trainerItems: classAttrs?.items ?? [null, null],
      itemUseFlag: classAttrs?.itemUseFlag ?? null,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Group label
    const groupMatch = lines[i].match(/^(\w+Group):$/);
    if (groupMatch) {
      currentGroupClassIdx = groupIdx;
      currentClassInfo = classMap.get(groupIdx) ?? { name: `Class${groupIdx}`, constNames: [] };
      groupIdx++;
      trainerCount = 0;
      continue;
    }

    // Trainer name line: db "NAME@", TRAINERTYPE_*
    const nameMatch = line.match(/^db\s+"([^@]*)@"\s*,\s*(TRAINERTYPE_\w+)/);
    if (nameMatch) {
      emitTrainer();
      trainerName = nameMatch[1] === '?' ? (currentClassInfo?.name ?? 'Unknown') : nameMatch[1];
      trainerType = nameMatch[2];
      pokemon = [];
      inTrainer = true;
      continue;
    }

    // End marker
    if (line === 'db -1 ; end') {
      emitTrainer();
      inTrainer = false;
      pokemon = [];
      trainerCount++;
      continue;
    }

    if (!inTrainer) continue;

    // Pokemon line
    const pokeLine = line.replace(/;.*$/, '').trim();
    if (!pokeLine.startsWith('db ')) continue;
    const parts = pokeLine.slice(3).split(',').map(s => s.trim());
    if (parts.length < 2) continue;

    const level = parseInt(parts[0], 10);
    if (isNaN(level)) continue;
    const species = asmToSpecies(parts[1]);

    let item: string | null = null;
    let moves: string[] = [];

    if (trainerType === 'TRAINERTYPE_NORMAL') {
      // db level, species
    } else if (trainerType === 'TRAINERTYPE_MOVES') {
      // db level, species, 4 moves
      moves = parts.slice(2, 6).map(asmToMove).filter(m => m !== '');
    } else if (trainerType === 'TRAINERTYPE_ITEM') {
      // db level, species, item
      item = asmToItem(parts[2] ?? 'NO_ITEM');
    } else if (trainerType === 'TRAINERTYPE_ITEM_MOVES') {
      // db level, species, item, 4 moves
      item = asmToItem(parts[2] ?? 'NO_ITEM');
      moves = parts.slice(3, 7).map(asmToMove).filter(m => m !== '');
    }

    pokemon.push({ species, level, moves, item });
  }

  return allTrainers;
}

// ── Parse moves ──────────────────────────────────────────────────────

function parseMoves(): Record<string, MoveInfo> {
  const data = fs.readFileSync(path.join(POKECRYSTAL, 'data/moves/moves.asm'), 'utf-8');
  const movesData: Record<string, MoveInfo> = {};

  for (const line of data.split('\n')) {
    const m = line.match(/^\s*move\s+(\w+)\s*,\s*\w+\s*,\s*(\d+)\s*,\s*(\w+)\s*,\s*(\d+)/);
    if (!m) continue;
    const name = asmToMove(m[1]);
    const power = parseInt(m[2], 10);
    const type = m[3].charAt(0).toUpperCase() + m[3].slice(1).toLowerCase();
    const accuracy = parseInt(m[4], 10);
    movesData[name] = { power, type, accuracy };
  }

  return movesData;
}

// ── Parse learnsets ──────────────────────────────────────────────────

function normalizeSpeciesKey(name: string): string {
  const s = gen.species.get(name);
  return s ? s.name : name;
}

function parseLearnsets(): Map<string, [number, string][]> {
  const data = fs.readFileSync(path.join(POKECRYSTAL, 'data/pokemon/evos_attacks.asm'), 'utf-8');
  const learnsets = new Map<string, [number, string][]>();
  let currentSpecies = '';
  let inMoves = false;

  const LABEL_SPECIES: Record<string, string> = {
    MrMime: 'Mr. Mime', FarfetchD: "Farfetch'd",
    NidoranF: 'Nidoran-F', NidoranM: 'Nidoran-M',
    HoOh: 'Ho-Oh',
  };

  for (const line of data.split('\n')) {
    const labelMatch = line.match(/^(\w+)EvosAttacks:/);
    if (labelMatch) {
      const raw = labelMatch[1];
      currentSpecies = LABEL_SPECIES[raw] ?? normalizeSpeciesKey(raw);
      inMoves = false;
      continue;
    }

    if (line.trim() === 'db 0 ; no more evolutions') {
      inMoves = true;
      if (!learnsets.has(currentSpecies)) {
        learnsets.set(currentSpecies, []);
      }
      continue;
    }

    if (line.trim() === 'db 0 ; no more level-up moves') {
      inMoves = false;
      continue;
    }

    if (inMoves && currentSpecies) {
      const m = line.trim().match(/^db\s+(\d+)\s*,\s*(\w+)/);
      if (m) {
        const level = parseInt(m[1], 10);
        const move = asmToMove(m[2]);
        if (move) {
          learnsets.get(currentSpecies)!.push([level, move]);
        }
      }
    }
  }

  return learnsets;
}

// ── Populate moves for TRAINERTYPE_NORMAL trainers ───────────────────

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
      poke.moves = learned.slice(-4);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────

function generate(setLevel: number | null, suffix: string) {
  const classMap = parseTrainerConstants();
  const aiMap = parseAiAttributes();
  const locationMap = parseTrainerLocations();
  const trainers = parseParties(classMap, aiMap, locationMap);
  const movesData = parseMoves();
  const learnsets = parseLearnsets();

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
    path.join(outDir, `trainers-gen2${suffix}.json`),
    JSON.stringify(trainers, null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, 'moves-gen2.json'),
    JSON.stringify(movesData, null, 2),
  );

  console.log(`Wrote ${trainers.length} Gen 2 trainers to data/trainers-gen2${suffix}.json`);
  console.log(`Wrote ${Object.keys(movesData).length} Gen 2 moves to data/moves-gen2.json`);

  const noMoves = trainers.filter(t => t.pokemon.some(p => p.moves.length === 0));
  if (noMoves.length) {
    console.log(`Warning: ${noMoves.length} trainers have Pokemon with no moves`);
  }
}

function main() {
  generate(null, '');
  generate(50, '-lv50');
}

main();
