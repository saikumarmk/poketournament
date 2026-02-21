import fs from 'fs';
import path from 'path';

interface TrainerData {
  name: string;
  location: string;
  pokemon: { species: string; level: number; moves: string[]; item?: string | null }[];
  modifiers?: number[];
  trainerClass?: string;
  aiFlags?: string[];
  switchFlag?: string | null;
  trainerItems?: [string | null, string | null];
  itemUseFlag?: string | null;
}

interface BattleResult {
  player1: string;
  player2: string;
  outcome: 'p1' | 'p2' | 'tie' | 'error';
  turns: number;
}

interface RankedTrainer {
  name: string;
  location: string;
  id: string;
  elo: number;
  win: number;
  loss: number;
  draw: number;
  bestWin: { id: string; elo: number } | null;
  worstLoss: { id: string; elo: number } | null;
  pokemon: { species: string; level: number; moves: string[]; item?: string | null }[];
  modifiers?: number[];
  trainerClass?: string;
  aiFlags?: string[];
  switchFlag?: string | null;
  trainerItems?: [string | null, string | null];
  itemUseFlag?: string | null;
}

/**
 * Logistic-regression Elo via gradient descent on log-loss.
 * Replaces sklearn's LogisticRegression from the Python version.
 */
function computeElo(
  battles: BattleResult[],
  trainerIds: string[],
): number[] {
  const N = trainerIds.length;
  const idxMap = new Map<string, number>();
  trainerIds.forEach((id, i) => idxMap.set(id, i));

  const theta = new Float64Array(N);
  const lr = 0.1;
  const iterations = 1000;
  const lambda = 0.0001;

  const data: [number, number, number][] = [];
  for (const b of battles) {
    const i = idxMap.get(b.player1);
    const j = idxMap.get(b.player2);
    if (i === undefined || j === undefined) continue;
    if (b.outcome === 'error') continue;

    if (b.outcome === 'p1') {
      data.push([i, j, 1]);
    } else if (b.outcome === 'p2') {
      data.push([i, j, 0]);
    } else {
      data.push([i, j, 1]);
      data.push([i, j, 0]);
    }
  }

  if (data.length === 0) {
    return Array.from(theta).map(() => 1500);
  }

  for (let iter = 0; iter < iterations; iter++) {
    const grad = new Float64Array(N);
    for (const [i, j, y] of data) {
      const diff = theta[i] - theta[j];
      const sigmoid = 1 / (1 + Math.exp(-diff));
      const error = sigmoid - y;
      grad[i] += error;
      grad[j] -= error;
    }
    for (let k = 0; k < N; k++) {
      grad[k] += lambda * theta[k];
      theta[k] -= lr * grad[k] / data.length;
    }
  }

  return Array.from(theta).map(t => t * 173 + 1500);
}

function calculate(suffix: string) {
  const inputDir = path.resolve(import.meta.dirname, '..', 'data');
  const outDir = path.resolve(import.meta.dirname, '..', 'public', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  const trainers: TrainerData[] = JSON.parse(
    fs.readFileSync(path.join(inputDir, `trainers${suffix}.json`), 'utf-8'),
  );
  const battles: BattleResult[] = JSON.parse(
    fs.readFileSync(path.join(inputDir, `battles${suffix}.json`), 'utf-8'),
  );

  const trainerIds = trainers.map(t => `${t.name}-${t.location}`);

  const stats = new Map<string, { win: number; loss: number; draw: number }>();
  for (const id of trainerIds) {
    stats.set(id, { win: 0, loss: 0, draw: 0 });
  }

  for (const b of battles) {
    const s1 = stats.get(b.player1);
    const s2 = stats.get(b.player2);
    if (!s1 || !s2) continue;
    if (b.outcome === 'p1') { s1.win++; s2.loss++; }
    else if (b.outcome === 'p2') { s1.loss++; s2.win++; }
    else if (b.outcome === 'tie') { s1.draw++; s2.draw++; }
  }

  console.log(`[${suffix || 'normal'}] Computing Elo from ${battles.length} battles across ${trainers.length} trainers...`);
  const elos = computeElo(battles, trainerIds);

  const eloMap = new Map<string, number>();
  trainerIds.forEach((id, i) => eloMap.set(id, elos[i]));

  // Compute best win and worst loss for each trainer
  const bestWins = new Map<string, { id: string; elo: number }>();
  const worstLosses = new Map<string, { id: string; elo: number }>();

  for (const b of battles) {
    if (b.outcome === 'error' || b.outcome === 'tie') continue;
    if (b.player1 === b.player2) continue;

    const winnerId = b.outcome === 'p1' ? b.player1 : b.player2;
    const loserId = b.outcome === 'p1' ? b.player2 : b.player1;
    const winnerElo = eloMap.get(winnerId) ?? 1500;
    const loserElo = eloMap.get(loserId) ?? 1500;

    // Best win: opponent with highest Elo that this trainer beat
    const currentBest = bestWins.get(winnerId);
    if (!currentBest || loserElo > currentBest.elo) {
      bestWins.set(winnerId, { id: loserId, elo: Math.round(loserElo * 100) / 100 });
    }

    // Worst loss: opponent with lowest Elo that this trainer lost to
    const currentWorst = worstLosses.get(loserId);
    if (!currentWorst || winnerElo < currentWorst.elo) {
      worstLosses.set(loserId, { id: winnerId, elo: Math.round(winnerElo * 100) / 100 });
    }
  }

  const rankings: RankedTrainer[] = trainers.map((t, i) => {
    const id = trainerIds[i];
    const s = stats.get(id)!;
    return {
      name: t.name,
      location: t.location,
      id,
      elo: Math.round(elos[i] * 100) / 100,
      win: s.win,
      loss: s.loss,
      draw: s.draw,
      bestWin: bestWins.get(id) ?? null,
      worstLoss: worstLosses.get(id) ?? null,
      pokemon: t.pokemon,
      ...(t.modifiers !== undefined ? { modifiers: t.modifiers } : {}),
      ...(t.trainerClass !== undefined ? { trainerClass: t.trainerClass } : {}),
      ...(t.aiFlags !== undefined ? { aiFlags: t.aiFlags } : {}),
      ...(t.switchFlag !== undefined ? { switchFlag: t.switchFlag } : {}),
      ...(t.trainerItems !== undefined ? { trainerItems: t.trainerItems } : {}),
      ...(t.itemUseFlag !== undefined ? { itemUseFlag: t.itemUseFlag } : {}),
    };
  });

  rankings.sort((a, b) => b.elo - a.elo);

  fs.writeFileSync(
    path.join(outDir, `rankings${suffix}.json`),
    JSON.stringify(rankings),
  );

  // Indexed flat matchup matrix: ids[i] is trainer, data[i*N+j] = [w,l,d] for i vs j
  const N = trainerIds.length;
  const idxMap = new Map<string, number>();
  trainerIds.forEach((id, i) => idxMap.set(id, i));

  const flat: [number, number, number][] = new Array(N * N);
  for (let k = 0; k < flat.length; k++) flat[k] = [0, 0, 0];

  for (const b of battles) {
    if (b.outcome === 'error') continue;
    const i = idxMap.get(b.player1);
    const j = idxMap.get(b.player2);
    if (i === undefined || j === undefined || i === j) continue;

    if (b.outcome === 'p1') {
      flat[i * N + j][0]++;
      flat[j * N + i][1]++;
    } else if (b.outcome === 'p2') {
      flat[i * N + j][1]++;
      flat[j * N + i][0]++;
    } else {
      flat[i * N + j][2]++;
      flat[j * N + i][2]++;
    }
  }

  fs.writeFileSync(
    path.join(outDir, `matchups${suffix}.json`),
    JSON.stringify({ idx: trainerIds, data: flat }),
  );

  const rankSize = fs.statSync(path.join(outDir, `rankings${suffix}.json`)).size;
  const matchSize = fs.statSync(path.join(outDir, `matchups${suffix}.json`)).size;
  console.log(`Wrote rankings${suffix}.json (${(rankSize / 1024).toFixed(0)} KB), matchups${suffix}.json (${(matchSize / 1024).toFixed(0)} KB)`);
  console.log('\nTop 10:');
  for (const r of rankings.slice(0, 10)) {
    console.log(`  ${r.elo.toFixed(0).padStart(5)} | ${r.name} (${r.location}) — W:${r.win} L:${r.loss} D:${r.draw}`);
  }
  console.log('\nBottom 5:');
  for (const r of rankings.slice(-5)) {
    console.log(`  ${r.elo.toFixed(0).padStart(5)} | ${r.name} (${r.location}) — W:${r.win} L:${r.loss} D:${r.draw}`);
  }
}

function main() {
  const gen = process.argv[2] ?? 'gen1';
  const inputDir = path.resolve(import.meta.dirname, '..', 'data');
  const suffixes = gen === 'gen2' ? ['-gen2', '-gen2-lv50'] : ['', '-lv50'];
  for (const suffix of suffixes) {
    if (!fs.existsSync(path.join(inputDir, `battles${suffix}.json`))) {
      console.log(`Skipping ${suffix || 'normal'} — no battles file found`);
      continue;
    }
    calculate(suffix);
  }
}

main();
