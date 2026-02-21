import fs from 'fs';
import path from 'path';
import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';

const POKERED = path.resolve(import.meta.dirname, '..', 'pokered');

interface PokemonData {
  species: string;
  level: number;
  moves: string[];
}

interface TrainerData {
  name: string;
  location: string;
  pokemon: PokemonData[];
  modifiers: number[];
}

interface TrainerClassData {
  name: string;
  trainers: TrainerData[];
  modifiers: number[];
}

// ── ASM name → @pkmn/data ID mapping ──────────────────────────────────

const gens = new Generations(Dex);
const gen = gens.get(1);

const SPECIES_MAP = new Map<string, string>();
for (const species of gen.species) {
  SPECIES_MAP.set(species.name.toUpperCase().replace(/[^A-Z]/g, ''), species.name);
  SPECIES_MAP.set(species.id.toUpperCase(), species.name);
}
SPECIES_MAP.set('NIDORAN_M', 'Nidoran-M');
SPECIES_MAP.set('NIDORAN_F', 'Nidoran-F');
SPECIES_MAP.set('NIDORANM', 'Nidoran-M');
SPECIES_MAP.set('NIDORANF', 'Nidoran-F');
SPECIES_MAP.set('MR_MIME', 'Mr. Mime');
SPECIES_MAP.set('MRMIME', 'Mr. Mime');
SPECIES_MAP.set('FARFETCHD', "Farfetch'd");

const MOVE_MAP = new Map<string, string>();
for (const move of gen.moves) {
  MOVE_MAP.set(move.name.toUpperCase().replace(/[^A-Z0-9]/g, '_'), move.name);
  MOVE_MAP.set(move.id.toUpperCase(), move.name);
}
MOVE_MAP.set('PSYCHIC_M', 'Psychic');
MOVE_MAP.set('SONICBOOM', 'Sonic Boom');
MOVE_MAP.set('VICEGRIP', 'Vise Grip');
MOVE_MAP.set('THUNDERSHOCK', 'Thunder Shock');
MOVE_MAP.set('POISONPOWDER', 'Poison Powder');
MOVE_MAP.set('THUNDERPUNCH', 'Thunder Punch');

function resolveSpecies(asmName: string): string {
  const cleaned = asmName.toUpperCase().trim();
  const resolved = SPECIES_MAP.get(cleaned);
  if (resolved) return resolved;
  const titleCase = cleaned.charAt(0) + cleaned.slice(1).toLowerCase();
  const byTitle = gen.species.get(titleCase);
  if (byTitle) return byTitle.name;
  const byId = gen.species.get(cleaned.toLowerCase());
  if (byId) return byId.name;
  throw new Error(`Unknown species: ${asmName}`);
}

function resolveMove(asmName: string): string {
  const cleaned = asmName.toUpperCase().trim();
  const resolved = MOVE_MAP.get(cleaned);
  if (resolved) return resolved;
  const byId = gen.moves.get(cleaned.toLowerCase().replace(/_/g, ''));
  if (byId) return byId.name;
  throw new Error(`Unknown move: ${asmName}`);
}

// ── Parse move_choices.asm ─────────────────────────────────────────────

function parseMoveChoices(data: string): number[][] {
  const results: number[][] = [];
  for (const line of data.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('move_choices')) continue;

    const commentIdx = trimmed.indexOf(';');
    const code = commentIdx >= 0 ? trimmed.slice(0, commentIdx) : trimmed;
    const argsStr = code.replace('move_choices', '').trim();

    if (!argsStr) {
      results.push([]);
    } else {
      results.push(argsStr.split(',').map(s => parseInt(s.trim(), 10)));
    }
  }
  return results;
}

// ── Parse parties.asm ──────────────────────────────────────────────────

function parseTrainerParties(data: string): TrainerClassData[] {
  const trainerClasses: TrainerClassData[] = [];
  let current: TrainerClassData | null = null;
  let currentLocation: string | null = null;
  let displayName = '';
  const locationCounts: Record<string, number> = {};

  for (const line of data.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.endsWith(':') && !trimmed.startsWith(';') &&
        !trimmed.startsWith('table_width') && !trimmed.startsWith('dw') &&
        !trimmed.startsWith('assert') && !trimmed.startsWith('db') &&
        !trimmed.startsWith('MACRO') && !trimmed.startsWith('ENDM') &&
        !trimmed.startsWith('DEF') && !trimmed.startsWith('IF') &&
        !trimmed.startsWith('ENDC')) {
      if (current) trainerClasses.push(current);
      const label = trimmed.slice(0, -1);
      displayName = label.endsWith('Data') ? label.slice(0, -4) : label;

      if (label === 'TrainerDataPointers') {
        current = null;
        continue;
      }

      current = { name: displayName, trainers: [], modifiers: [] };
      currentLocation = null;
      Object.keys(locationCounts).forEach(k => delete locationCounts[k]);
      continue;
    }

    if (trimmed.startsWith(';') && current) {
      currentLocation = trimmed.slice(1).trim();
      continue;
    }

    if (trimmed.startsWith('db') && current) {
      const rawLine = trimmed.slice(2).trim();
      const commentIdx = rawLine.indexOf(';');
      const dataStr = (commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine).trim();
      const tokens = dataStr.split(',').map(s => s.trim()).filter(Boolean);

      const pokemon: PokemonData[] = [];

      if (tokens[0] !== '$FF') {
        const level = tokens[0].startsWith('$')
          ? parseInt(tokens[0].slice(1), 16)
          : parseInt(tokens[0], 10);

        for (let i = 1; i < tokens.length; i++) {
          if (tokens[i] === '0') break;
          pokemon.push({ species: resolveSpecies(tokens[i]), level, moves: [] });
        }
      } else {
        for (let i = 1; i < tokens.length - 1; i += 2) {
          if (tokens[i] === '0') break;
          const level = tokens[i].startsWith('$')
            ? parseInt(tokens[i].slice(1), 16)
            : parseInt(tokens[i], 10);
          pokemon.push({ species: resolveSpecies(tokens[i + 1]), level, moves: [] });
        }
      }

      if (pokemon.length === 0) continue;

      let locName = currentLocation ?? current.name;
      if (locationCounts[locName] === undefined) {
        locationCounts[locName] = 0;
      }
      locationCounts[locName]++;
      const suffix = String.fromCharCode(64 + locationCounts[locName]);
      locName = `${locName}-${suffix}`;

      current.trainers.push({
        name: displayName,
        location: locName,
        pokemon,
        modifiers: [],
      });
    }
  }
  if (current) trainerClasses.push(current);
  return trainerClasses;
}

// ── Parse evos_moves.asm (learnsets) ───────────────────────────────────

function parseLearnsets(data: string): Map<string, [number, string][]> {
  const learnsets = new Map<string, [number, string][]>();
  let currentPokemon: string | null = null;
  let parsingLearnset = false;

  for (const line of data.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.endsWith('EvosMoves:')) {
      currentPokemon = trimmed.replace('EvosMoves:', '');
      learnsets.set(currentPokemon, []);
      parsingLearnset = false;
      continue;
    }

    if (trimmed.startsWith('; Learnset')) {
      parsingLearnset = true;
      continue;
    }

    if (parsingLearnset && trimmed.startsWith('db') && currentPokemon) {
      const rawData = trimmed.slice(2).trim().split(',').map(s => s.trim());
      for (let i = 0; i < rawData.length - 1; i += 2) {
        const level = rawData[i].trim();
        const move = rawData[i + 1].trim();
        if (level === '0') {
          parsingLearnset = false;
          break;
        }
        if (move !== 'NO_MOVE') {
          const lvl = parseInt(level, 10);
          learnsets.get(currentPokemon)!.push([lvl, move]);
        }
      }
    }
  }
  return learnsets;
}

// ── Parse base_stats/*.asm (level 1 moves) ─────────────────────────────

function parseLevel1Moves(baseStatsDir: string): Map<string, string[]> {
  const level1Moves = new Map<string, string[]>();

  for (const filename of fs.readdirSync(baseStatsDir)) {
    if (!filename.endsWith('.asm')) continue;
    const content = fs.readFileSync(path.join(baseStatsDir, filename), 'utf-8');
    let currentPokemon: string | null = null;

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      const spriteMatch = trimmed.match(/dw (\w+)PicFront,/);
      if (spriteMatch) {
        currentPokemon = spriteMatch[1];
      }

      if (trimmed.includes('level 1 learnset') && currentPokemon) {
        const movesPart = trimmed.split('; level 1 learnset')[0].trim();
        if (movesPart.startsWith('db')) {
          const moves = movesPart.slice(2).trim().split(',')
            .map(s => s.trim())
            .filter(m => m !== 'NO_MOVE' && /^[A-Z_]+$/.test(m));
          if (moves.length > 0) {
            level1Moves.set(currentPokemon, moves);
          }
        }
        break;
      }
    }
  }
  return level1Moves;
}

// ── Parse moves.asm ────────────────────────────────────────────────────

interface MoveInfo {
  power: number;
  type: string;
  accuracy: number;
}

function parseMoves(data: string): Map<string, MoveInfo> {
  const moves = new Map<string, MoveInfo>();
  for (const line of data.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('move ')) continue;
    const parts = trimmed.split(',').map(s => s.trim());
    const name = parts[0].split(/\s+/)[1];
    const power = parseInt(parts[2], 10);
    const moveType = parts[3].replace('_TYPE', '');
    const accuracy = parseInt(parts[4].replace(/\s*percent/, ''), 10);
    moves.set(name, {
      power,
      type: moveType.charAt(0).toUpperCase() + moveType.slice(1).toLowerCase(),
      accuracy,
    });
  }
  return moves;
}

// ── Correct Pokemon names for lookup ───────────────────────────────────

function correctPokemonName(name: string): string {
  const exceptions: Record<string, string> = {
    Mr_mime: 'MrMime', Nidoran_f: 'NidoranF', Nidoran_m: 'NidoranM',
    NidoranF: 'NidoranF', NidoranM: 'NidoranM', MrMime: 'MrMime',
    Farfetchd: 'Farfetchd',
  };
  return exceptions[name] ?? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

// ── Combine level 1 + learnset moves ───────────────────────────────────

function combineMoves(
  learnset: Map<string, [number, string][]>,
  level1: Map<string, string[]>,
): Map<string, [number, string][]> {
  const combined = new Map<string, [number, string][]>();
  for (const [pokemon, moves] of level1) {
    combined.set(pokemon, moves.map(m => [1, m]));
  }
  for (const [pokemon, moves] of learnset) {
    const existing = combined.get(pokemon) ?? [];
    combined.set(pokemon, [...existing, ...moves]);
  }
  return combined;
}

// ── Populate trainer moves ─────────────────────────────────────────────

function populateTrainerMoves(
  trainerClasses: TrainerClassData[],
  levelupMoves: Map<string, [number, string][]>,
  moveNameMap: Map<string, string>,
): void {
  for (const tc of trainerClasses) {
    for (const trainer of tc.trainers) {
      for (const pokemon of trainer.pokemon) {
        const speciesKey = correctPokemonName(
          pokemon.species.replace(/[^a-zA-Z]/g, ''),
        );
        const moves = levelupMoves.get(speciesKey);
        if (!moves) continue;

        const learnedMoves = moves
          .filter(([lvl]) => lvl <= pokemon.level)
          .map(([, moveName]) => {
            const resolved = moveNameMap.get(moveName);
            if (!resolved) return resolveMove(moveName);
            return resolveMove(resolved);
          });

        pokemon.moves = learnedMoves.slice(-4);
      }
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────

function generate(setLevel: number | null, suffix: string) {
  const partiesAsm = fs.readFileSync(path.join(POKERED, 'data/trainers/parties.asm'), 'utf-8');
  const moveChoicesAsm = fs.readFileSync(path.join(POKERED, 'data/trainers/move_choices.asm'), 'utf-8');
  const evosMovesAsm = fs.readFileSync(path.join(POKERED, 'data/pokemon/evos_moves.asm'), 'utf-8');
  const movesAsm = fs.readFileSync(path.join(POKERED, 'data/moves/moves.asm'), 'utf-8');
  const baseStatsDir = path.join(POKERED, 'data/pokemon/base_stats');

  const moveChoices = parseMoveChoices(moveChoicesAsm);
  const trainerClasses = parseTrainerParties(partiesAsm);

  for (let i = 0; i < trainerClasses.length; i++) {
    const mods = moveChoices[i] ?? [];
    trainerClasses[i].modifiers = mods;
    for (const trainer of trainerClasses[i].trainers) {
      trainer.modifiers = mods;
    }
  }

  const asmMoves = parseMoves(movesAsm);
  const movesData: Record<string, MoveInfo> = {};
  const moveNameMap = new Map<string, string>();
  for (const [asmName, info] of asmMoves) {
    const resolved = resolveMove(asmName);
    movesData[resolved] = info;
    moveNameMap.set(asmName, resolved);
  }

  const learnsets = parseLearnsets(evosMovesAsm);
  const level1Moves = parseLevel1Moves(baseStatsDir);
  const rawCombined = combineMoves(learnsets, level1Moves);

  const levelupMoves = new Map<string, [number, string][]>();
  for (const [pokemon, moves] of rawCombined) {
    levelupMoves.set(pokemon, moves.map(([lvl, move]) => [lvl, move]));
  }

  // If set-level mode, override all pokemon levels before populating moves
  if (setLevel !== null) {
    for (const tc of trainerClasses) {
      for (const trainer of tc.trainers) {
        for (const pokemon of trainer.pokemon) {
          pokemon.level = setLevel;
        }
      }
    }
  }

  populateTrainerMoves(trainerClasses, levelupMoves, moveNameMap);

  const allTrainers: TrainerData[] = [];
  for (const tc of trainerClasses) {
    for (const trainer of tc.trainers) {
      allTrainers.push(trainer);
    }
  }

  const outDir = path.resolve(import.meta.dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, `trainers${suffix}.json`),
    JSON.stringify(allTrainers, null, 2),
  );
  fs.writeFileSync(
    path.join(outDir, 'moves.json'),
    JSON.stringify(movesData, null, 2),
  );

  console.log(`Wrote ${allTrainers.length} trainers to data/trainers${suffix}.json`);
  console.log(`Wrote ${Object.keys(movesData).length} moves to data/moves.json`);
}

function main() {
  // Generate normal mode
  generate(null, '');
  // Generate level 50 mode
  generate(50, '-lv50');
}

main();
