import fs from 'fs';
import path from 'path';
import { BattleStreams, Teams } from '@pkmn/sim';
import { ScoredPlayerAI } from './ai-gen3/player.js';
import type { AIFlag } from './ai-gen3/scoring.js';

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

interface BattleResult {
  player1: string;
  player2: string;
  outcome: 'p1' | 'p2' | 'tie' | 'error';
  turns: number;
}

function parseArgs(): { limit: number | null; mode: string; shard: [number, number] | null } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let mode = 'all';
  let shard: [number, number] | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--shard' && args[i + 1]) {
      const [idx, total] = args[i + 1].split('/').map(Number);
      shard = [idx, total];
      i++;
    } else if (args[i] === 'lv50') {
      mode = 'lv50';
    } else if (args[i] === 'normal') {
      mode = 'normal';
    }
  }

  return { limit, mode, shard };
}

function trainerId(t: TrainerData): string {
  return `${t.name}-${t.location}`;
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash;
}

function buildTeam(trainer: TrainerData): string | null {
  const team = trainer.pokemon.map(p => {
    const realIV = Math.floor(p.iv * 31 / 255);
    return {
      name: '',
      species: p.species,
      item: p.item ?? '',
      nature: '',
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: { hp: realIV, atk: realIV, def: realIV, spa: realIV, spd: realIV, spe: realIV },
      moves: p.moves.length > 0
        ? p.moves.map(m => m.toLowerCase().replace(/\s+/g, ''))
        : ['tackle'],
      level: p.level,
      gender: '',
      ability: '',
    };
  });
  return Teams.pack(team);
}

async function runBattle(
  t1: TrainerData,
  t2: TrainerData,
): Promise<BattleResult> {
  const team1 = buildTeam(t1);
  const team2 = buildTeam(t2);

  const seed: [number, number, number, number] = [
    hashCode(trainerId(t1)) & 0xFFFF,
    hashCode(trainerId(t2)) & 0xFFFF,
    (hashCode(trainerId(t1)) >> 16) & 0xFFFF,
    (hashCode(trainerId(t2)) >> 16) & 0xFFFF,
  ];

  const battleStream = new BattleStreams.BattleStream();
  const streams = BattleStreams.getPlayerStreams(battleStream);

  const p1ai = new ScoredPlayerAI(
    streams.p1, battleStream, 'p1',
    t1.aiFlags as AIFlag[],
    t1.items,
  );
  const p2ai = new ScoredPlayerAI(
    streams.p2, battleStream, 'p2',
    t2.aiFlags as AIFlag[],
    t2.items,
  );

  void p1ai.start();
  void p2ai.start();

  void streams.omniscient.write(
    `>start ${JSON.stringify({ formatid: 'gen3customgame', seed })}\n` +
    `>player p1 ${JSON.stringify({ name: 'P1', team: team1 })}\n` +
    `>player p2 ${JSON.stringify({ name: 'P2', team: team2 })}`,
  );

  let winner: string | null = null;
  let turn = 0;
  let tied = false;

  for await (const chunk of streams.omniscient) {
    for (const line of chunk.split('\n')) {
      if (line.startsWith('|turn|')) {
        turn = parseInt(line.split('|')[2], 10);
      }
      if (line.startsWith('|win|')) {
        winner = line.split('|')[2];
      }
      if (line === '|tie' || line.startsWith('|tie|')) {
        tied = true;
      }
    }
    if (winner || tied) break;
    if (turn > 500) {
      battleStream.destroy();
      break;
    }
  }

  let outcome: BattleResult['outcome'];
  if (winner === 'P1') outcome = 'p1';
  else if (winner === 'P2') outcome = 'p2';
  else outcome = 'tie';

  return {
    player1: trainerId(t1),
    player2: trainerId(t2),
    outcome,
    turns: turn,
  };
}

async function runTournament(suffix: string, limit: number | null, shard: [number, number] | null) {
  const dataDir = path.resolve(import.meta.dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  let trainers: TrainerData[] = JSON.parse(
    fs.readFileSync(path.join(dataDir, `trainers-gen3${suffix}.json`), 'utf-8'),
  );

  trainers = trainers.filter(t => !t.doubleBattle);

  if (limit !== null && limit < trainers.length) {
    trainers = trainers.slice(0, limit);
    console.log(`[gen3${suffix}] Limited to ${trainers.length} trainers`);
  }

  // Build all battle pairs
  const allPairs: [number, number][] = [];
  for (let i = 0; i < trainers.length; i++) {
    for (let j = 0; j < trainers.length; j++) {
      if (i !== j) allPairs.push([i, j]);
    }
  }

  // If sharded, only take our slice
  let pairs = allPairs;
  const shardLabel = shard ? ` shard ${shard[0]}/${shard[1]}` : '';
  if (shard) {
    const [idx, total] = shard;
    const chunkSize = Math.ceil(allPairs.length / total);
    const start = idx * chunkSize;
    const end = Math.min(start + chunkSize, allPairs.length);
    pairs = allPairs.slice(start, end);
  }

  const totalBattles = pairs.length;
  const outPath = shard
    ? path.join(dataDir, `battles-gen3${suffix}.shard${shard[0]}.json`)
    : path.join(dataDir, `battles-gen3${suffix}.json`);

  console.log(`[gen3${suffix}${shardLabel}] Running ${totalBattles} battles (${trainers.length} trainers)...`);

  const results: BattleResult[] = [];
  let errors = 0;
  const startTime = Date.now();

  for (let b = 0; b < pairs.length; b++) {
    const [i, j] = pairs[b];
    try {
      const result = await runBattle(trainers[i], trainers[j]);
      results.push(result);
    } catch {
      errors++;
      results.push({
        player1: trainerId(trainers[i]),
        player2: trainerId(trainers[j]),
        outcome: 'error',
        turns: 0,
      });
    }

    if ((b + 1) % 5000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = (((b + 1) / totalBattles) * 100).toFixed(1);
      console.log(`  [${shardLabel.trim() || 'gen3' + suffix}] ${pct}% (${b + 1}/${totalBattles}) - ${elapsed}s, ${errors} err`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[gen3${suffix}${shardLabel}] Done: ${results.length} battles in ${elapsed}s (${errors} errors)`);

  fs.writeFileSync(outPath, JSON.stringify(results));
}

async function main() {
  const { limit, mode, shard } = parseArgs();

  if (mode === 'lv50') {
    await runTournament('-lv50', limit, shard);
  } else if (mode === 'normal') {
    await runTournament('', limit, shard);
  } else {
    await runTournament('', limit, shard);
    await runTournament('-lv50', limit, shard);
  }
}

main();
