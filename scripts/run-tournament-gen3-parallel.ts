/**
 * Parallel orchestrator for Gen 3 tournament.
 * Spawns N child tsx processes via spawn(), each handling a shard of battles.
 * Merges results when all shards complete.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const NUM_SHARDS = os.cpus().length;

function parseArgs(): { limit: string | null; mode: string } {
  const args = process.argv.slice(2);
  let limit: string | null = null;
  let mode = 'all';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = args[i + 1];
      i++;
    } else if (args[i] === 'lv50') {
      mode = 'lv50';
    } else if (args[i] === 'normal') {
      mode = 'normal';
    }
  }

  return { limit, mode };
}

async function runSharded(suffix: string, limit: string | null) {
  const dataDir = path.resolve(import.meta.dirname, '..', 'data');
  const npxPath = 'npx';
  const scriptPath = path.resolve(import.meta.dirname, 'run-tournament-gen3.ts');

  console.log(`\n=== Gen 3${suffix} tournament: ${NUM_SHARDS} parallel shards ===\n`);
  const startTime = Date.now();

  const promises = Array.from({ length: NUM_SHARDS }, (_, i) => {
    return new Promise<void>((resolve, reject) => {
      const childArgs = ['tsx', scriptPath, suffix === '-lv50' ? 'lv50' : 'normal', '--shard', `${i}/${NUM_SHARDS}`];
      if (limit) childArgs.push('--limit', limit);

      const child = spawn(npxPath, childArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: path.resolve(import.meta.dirname, '..'),
      });

      child.stdout.on('data', (data: Buffer) => {
        process.stdout.write(`[shard ${i}] ${data}`);
      });
      child.stderr.on('data', (data: Buffer) => {
        const msg = data.toString();
        if (msg.includes('Error') || msg.includes('error')) {
          process.stderr.write(`[shard ${i} err] ${data}`);
        }
      });

      child.on('exit', code => {
        if (code === 0) resolve();
        else reject(new Error(`Shard ${i} exited with code ${code}`));
      });
      child.on('error', reject);
    });
  });

  const results = await Promise.allSettled(promises);
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    console.warn(`\n${failures.length} shard(s) failed (data may still be available):`);
    failures.forEach(f => console.warn(`  ${(f as PromiseRejectedResult).reason}`));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${NUM_SHARDS - failures.length}/${NUM_SHARDS} shards complete in ${elapsed}s. Merging...`);

  const allResults: any[] = [];
  for (let i = 0; i < NUM_SHARDS; i++) {
    const shardPath = path.join(dataDir, `battles-gen3${suffix}.shard${i}.json`);
    if (fs.existsSync(shardPath)) {
      const shardResults = JSON.parse(fs.readFileSync(shardPath, 'utf-8'));
      allResults.push(...shardResults);
      fs.unlinkSync(shardPath);
    }
  }

  const outPath = path.join(dataDir, `battles-gen3${suffix}.json`);
  fs.writeFileSync(outPath, JSON.stringify(allResults));
  const fileSize = fs.statSync(outPath).size;
  const errors = allResults.filter((r: any) => r.outcome === 'error').length;
  console.log(`Merged ${allResults.length} battles (${errors} errors) -> data/battles-gen3${suffix}.json (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
}

async function main() {
  const { limit, mode } = parseArgs();

  if (mode === 'lv50') {
    await runSharded('-lv50', limit);
  } else if (mode === 'normal') {
    await runSharded('', limit);
  } else {
    await runSharded('', limit);
    await runSharded('-lv50', limit);
  }
}

main();
