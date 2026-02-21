import fs from 'fs';
import path from 'path';
import { Battle, Choice, initialize } from '@pkmn/engine';
import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';
import { advanceBattle } from './ai/choice.js';
import { buildModifierMap, modifierMap } from './ai/modifiers.js';

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

interface BattleResult {
  player1: string;
  player2: string;
  outcome: 'p1' | 'p2' | 'tie' | 'error';
  turns: number;
}

const MAX_TURNS = 1000;

function trainerId(t: TrainerData): string {
  return `${t.name}-${t.location}`;
}

function runBattle(
  gen: ReturnType<Generations['get']>,
  trainer1: TrainerData,
  trainer2: TrainerData,
): BattleResult {
  const team1 = trainer1.pokemon.map(p => ({
    species: p.species,
    level: p.level,
    moves: p.moves,
  }));
  const team2 = trainer2.pokemon.map(p => ({
    species: p.species,
    level: p.level,
    moves: p.moves,
  }));

  const battle = Battle.create(gen, {
    seed: [
      hashCode(trainerId(trainer1)) & 0xFFFF,
      hashCode(trainerId(trainer2)) & 0xFFFF,
      (hashCode(trainerId(trainer1)) >> 16) & 0xFFFF,
      (hashCode(trainerId(trainer2)) >> 16) & 0xFFFF,
    ],
    showdown: true,
    p1: { team: team1 },
    p2: { team: team2 },
  });

  let result = battle.update(Choice.pass, Choice.pass);
  let turns = 0;

  while (!result.type && turns < MAX_TURNS) {
    result = advanceBattle(battle, result, trainer1, trainer2, modifierMap);
    turns++;
  }

  let outcome: BattleResult['outcome'];
  if (!result.type || turns >= MAX_TURNS) {
    outcome = 'tie';
  } else if (result.type === 'win') {
    outcome = 'p1';
  } else if (result.type === 'lose') {
    outcome = 'p2';
  } else if (result.type === 'tie') {
    outcome = 'tie';
  } else {
    outcome = 'error';
  }

  return {
    player1: trainerId(trainer1),
    player2: trainerId(trainer2),
    outcome,
    turns,
  };
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash;
}

async function runTournament(suffix: string) {
  const gens = new Generations(Dex);
  const gen = gens.get(1);

  const dataDir = path.resolve(import.meta.dirname, '..', 'data');
  const trainers: TrainerData[] = JSON.parse(
    fs.readFileSync(path.join(dataDir, `trainers${suffix}.json`), 'utf-8'),
  );
  const movesData = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'moves.json'), 'utf-8'),
  );

  buildModifierMap(movesData);

  const totalBattles = trainers.length * trainers.length;
  console.log(`[${suffix || 'normal'}] Running ${totalBattles} battles (${trainers.length} trainers)...`);

  const results: BattleResult[] = [];
  let completed = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const t1 of trainers) {
    for (const t2 of trainers) {
      try {
        const result = runBattle(gen, t1, t2);
        results.push(result);
      } catch (e) {
        errors++;
        results.push({
          player1: trainerId(t1),
          player2: trainerId(t2),
          outcome: 'error',
          turns: 0,
        });
      }
      completed++;
      if (completed % 5000 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const pct = ((completed / totalBattles) * 100).toFixed(1);
        console.log(`  ${pct}% (${completed}/${totalBattles}) - ${elapsed}s elapsed`);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Completed ${results.length} battles in ${elapsed}s (${errors} errors)`);

  fs.writeFileSync(
    path.join(dataDir, `battles${suffix}.json`),
    JSON.stringify(results),
  );

  const fileSize = fs.statSync(path.join(dataDir, `battles${suffix}.json`)).size;
  console.log(`Wrote data/battles${suffix}.json (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
}

async function main() {
  await initialize(true);
  await runTournament('');
  await runTournament('-lv50');
}

main();
