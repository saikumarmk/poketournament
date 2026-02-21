/**
 * Worker thread for Gen 3 tournament battles.
 * Receives battle assignments via workerData, runs them, posts results back.
 */
import { parentPort, workerData } from 'worker_threads';
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

interface WorkerInput {
  trainers: TrainerData[];
  battleIndices: [number, number][];
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

async function main() {
  const { trainers, battleIndices } = workerData as WorkerInput;
  const results: BattleResult[] = [];
  let errors = 0;

  for (const [i, j] of battleIndices) {
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

    if (results.length % 500 === 0) {
      parentPort!.postMessage({ type: 'progress', count: results.length, errors });
    }
  }

  parentPort!.postMessage({ type: 'done', results, errors });
}

main();
