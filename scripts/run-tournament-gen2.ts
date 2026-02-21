import fs from 'fs';
import path from 'path';
import { BattleStreams, Teams } from '@pkmn/sim';
import { ScoredPlayerAI } from './ai-gen2/player.js';
import type { AIFlag } from './ai-gen2/scoring.js';
import type { SwitchFlag } from './ai-gen2/switch.js';
import type { ItemUseFlag, TrainerItem } from './ai-gen2/items.js';

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
  switchFlag: SwitchFlag;
  trainerItems: [TrainerItem, TrainerItem];
  itemUseFlag: ItemUseFlag;
}

interface BattleResult {
  player1: string;
  player2: string;
  outcome: 'p1' | 'p2' | 'tie' | 'error';
  turns: number;
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
  const team = trainer.pokemon.map(p => ({
    name: '',
    species: p.species,
    item: p.item ?? '',
    nature: '',
    evs: { hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 },
    ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
    moves: p.moves.length > 0
      ? p.moves.map(m => m.toLowerCase().replace(/\s+/g, ''))
      : ['tackle'],
    level: p.level,
    gender: '',
  }));
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
    t1.aiFlags as AIFlag[], t1.switchFlag,
    t1.trainerItems, t1.itemUseFlag,
  );
  const p2ai = new ScoredPlayerAI(
    streams.p2, battleStream, 'p2',
    t2.aiFlags as AIFlag[], t2.switchFlag,
    t2.trainerItems, t2.itemUseFlag,
  );

  void p1ai.start();
  void p2ai.start();

  void streams.omniscient.write(
    `>start ${JSON.stringify({ formatid: 'gen2customgame', seed })}\n` +
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

async function runTournament(suffix: string) {
  const dataDir = path.resolve(import.meta.dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const trainers: TrainerData[] = JSON.parse(
    fs.readFileSync(path.join(dataDir, `trainers-gen2${suffix}.json`), 'utf-8'),
  );

  const totalBattles = trainers.length * trainers.length;
  const outPath = path.join(dataDir, `battles-gen2${suffix}.json`);
  const checkpointPath = path.join(dataDir, `battles-gen2${suffix}.checkpoint.json`);

  // Resume from checkpoint if available
  let results: BattleResult[] = [];
  let startIdx = 0;
  if (fs.existsSync(checkpointPath)) {
    const cp = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
    results = cp.results;
    startIdx = cp.completed;
    console.log(`[gen2${suffix || ' normal'}] Resuming from checkpoint: ${startIdx}/${totalBattles} already done`);
  }

  console.log(`[gen2${suffix || ' normal'}] Running ${totalBattles} battles (${trainers.length} trainers)...`);

  let completed = startIdx;
  let errors = 0;
  const startTime = Date.now();
  const CHECKPOINT_INTERVAL = 10000;

  for (let idx = 0; idx < totalBattles; idx++) {
    if (idx < startIdx) continue;

    const i = Math.floor(idx / trainers.length);
    const j = idx % trainers.length;
    const t1 = trainers[i];
    const t2 = trainers[j];

    try {
      const result = await runBattle(t1, t2);
      results.push(result);
    } catch {
      errors++;
      results.push({
        player1: trainerId(t1),
        player2: trainerId(t2),
        outcome: 'error',
        turns: 0,
      });
    }
    completed++;

    if (completed % CHECKPOINT_INTERVAL === 0) {
      fs.writeFileSync(checkpointPath, JSON.stringify({ completed, results }));
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = ((completed / totalBattles) * 100).toFixed(1);
      console.log(`  ${pct}% (${completed}/${totalBattles}) - ${elapsed}s elapsed, ${errors} errors [saved]`);
    } else if (completed % 5000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = ((completed / totalBattles) * 100).toFixed(1);
      console.log(`  ${pct}% (${completed}/${totalBattles}) - ${elapsed}s elapsed, ${errors} errors`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Completed ${results.length} battles in ${elapsed}s (${errors} errors)`);

  fs.writeFileSync(outPath, JSON.stringify(results));

  // Clean up checkpoint
  if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);

  const fileSize = fs.statSync(outPath).size;
  console.log(`Wrote data/battles-gen2${suffix}.json (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'lv50') {
    await runTournament('-lv50');
  } else if (mode === 'normal') {
    await runTournament('');
  } else {
    await runTournament('');
    await runTournament('-lv50');
  }
}

main();
