#!/usr/bin/env node

/**
 * Patches @pkmn/sim to remove data files not needed for Gen 2 battle simulation.
 * Replaces learnsets, legality, text, and team-validator with empty stubs
 * in both CJS and ESM builds, reducing the browser bundle from ~10MB to ~2MB.
 *
 * Run automatically via postinstall, or manually: node scripts/patch-sim.cjs
 */

const fs = require('fs');
const path = require('path');

const simDir = path.join(__dirname, '..', 'node_modules', '@pkmn', 'sim');

if (!fs.existsSync(simDir)) {
  console.log('@pkmn/sim not installed, skipping patch.');
  process.exit(0);
}

let patched = 0;
let savedBytes = 0;

function stub(filePath, contents) {
  if (!fs.existsSync(filePath)) return;
  const current = fs.readFileSync(filePath, 'utf-8');
  if (current === contents) return;
  fs.writeFileSync(filePath, contents);
  const saved = current.length - contents.length;
  if (saved > 0) savedBytes += saved;
  console.log(`  ${path.relative(simDir, filePath)} (${(saved / 1024).toFixed(0)} KB)`);
  patched++;
}

function patchDir(baseDir, ext) {
  const isESM = ext === '.mjs';
  const learnStub = isESM
    ? 'export const Learnsets = {};'
    : '"use strict";\nexports.Learnsets = {};';
  const legalStub = isESM
    ? 'export const Legality = {};'
    : '"use strict";\nexports.Legality = {};';
  const textStub = isESM
    ? 'export const MovesText = {};\nexport const AbilitiesText = {};\nexport const ItemsText = {};\nexport const DefaultText = {};'
    : '"use strict";\nexports.MovesText = {}; exports.AbilitiesText = {}; exports.ItemsText = {}; exports.DefaultText = {};';
  const validStub = isESM
    ? 'export class TeamValidator {}\nexport class PokemonSources {}'
    : '"use strict";\nexports.TeamValidator = class {}; exports.PokemonSources = class {};';

  const dataDir = path.join(baseDir, 'data');
  stub(path.join(dataDir, `learnsets${ext}`), learnStub);
  stub(path.join(dataDir, `legality${ext}`), legalStub);

  const modsDir = path.join(dataDir, 'mods');
  if (fs.existsSync(modsDir)) {
    for (const mod of fs.readdirSync(modsDir)) {
      stub(path.join(modsDir, mod, `learnsets${ext}`), learnStub);
      stub(path.join(modsDir, mod, `legality${ext}`), legalStub);
    }
  }

  const textDir = path.join(dataDir, 'text');
  if (fs.existsSync(textDir)) {
    for (const file of fs.readdirSync(textDir)) {
      if (file.endsWith(ext)) {
        stub(path.join(textDir, file), textStub);
      }
    }
  }

  stub(path.join(baseDir, 'sim', `team-validator${ext}`), validStub);
}

console.log('Patching @pkmn/sim for browser...');
patchDir(path.join(simDir, 'build', 'cjs'), '.js');
patchDir(path.join(simDir, 'build', 'esm'), '.mjs');

if (patched > 0) {
  console.log(`Done — patched ${patched} files, saved ${(savedBytes / 1024 / 1024).toFixed(1)} MB.`);
} else {
  console.log('Already patched.');
}
