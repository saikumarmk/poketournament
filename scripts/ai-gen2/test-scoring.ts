/**
 * Smoke tests for the Gen 2 AI scoring + switching system.
 */
import { BattleStreams, Teams } from '@pkmn/sim';
import { ScoredPlayerAI } from './player.js';
import type { AIFlag } from './scoring.js';
import type { SwitchFlag } from './switch.js';

interface MonSpec {
  species: string;
  level: number;
  moves: string[];
  item?: string;
}

interface TestCase {
  name: string;
  p1: MonSpec[];
  p2: MonSpec[];
  p1Flags: AIFlag[];
  p2Flags: AIFlag[];
  p1Switch?: SwitchFlag;
  p2Switch?: SwitchFlag;
}

function packTeam(mons: MonSpec[]): string | null {
  return Teams.pack(mons.map(m => ({
    name: '', species: m.species, item: m.item ?? '',
    nature: '', gender: '',
    evs: { hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 },
    ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
    moves: m.moves, level: m.level,
  })));
}

async function runTest(tc: TestCase): Promise<string> {
  const battleStream = new BattleStreams.BattleStream();
  const streams = BattleStreams.getPlayerStreams(battleStream);

  const p1ai = new ScoredPlayerAI(
    streams.p1, battleStream, 'p1', tc.p1Flags, tc.p1Switch ?? null,
  );
  const p2ai = new ScoredPlayerAI(
    streams.p2, battleStream, 'p2', tc.p2Flags, tc.p2Switch ?? null,
  );

  void p1ai.start();
  void p2ai.start();

  void streams.omniscient.write(
    `>start ${JSON.stringify({ formatid: 'gen2customgame', seed: [42, 42, 42, 42] })}\n` +
    `>player p1 ${JSON.stringify({ name: 'P1', team: packTeam(tc.p1) })}\n` +
    `>player p2 ${JSON.stringify({ name: 'P2', team: packTeam(tc.p2) })}`,
  );

  let winner: string | null = null;
  let turn = 0;
  let switches = 0;

  for await (const chunk of streams.omniscient) {
    for (const line of chunk.split('\n')) {
      if (line.startsWith('|turn|')) turn = parseInt(line.split('|')[2], 10);
      if (line.startsWith('|win|')) winner = line.split('|')[2];
      if (line === '|tie' || line.startsWith('|tie|')) winner = 'tie';
      if (line.startsWith('|switch|')) switches++;
    }
    if (winner) break;
    if (turn > 200) { winner = 'timeout'; break; }
  }

  return `${tc.name}: ${winner ?? 'no result'} in ${turn} turns (${switches} switches)`;
}

const TESTS: TestCase[] = [
  {
    name: '1v1 Type advantage (AI_TYPES)',
    p1: [{ species: 'Typhlosion', level: 50, moves: ['flamethrower', 'thunderpunch', 'earthquake', 'smokescreen'] }],
    p2: [{ species: 'Feraligatr', level: 50, moves: ['surf', 'icebeam', 'slash', 'screech'] }],
    p1Flags: ['AI_BASIC', 'AI_TYPES'],
    p2Flags: ['AI_BASIC', 'AI_TYPES'],
  },
  {
    name: '1v1 Smart + Offensive (full flags)',
    p1: [{ species: 'Alakazam', level: 50, moves: ['psychic', 'thunderpunch', 'recover', 'disable'] }],
    p2: [{ species: 'Gengar', level: 50, moves: ['shadowball', 'thunderbolt', 'hypnosis', 'dreameater'] }],
    p1Flags: ['AI_BASIC', 'AI_TYPES', 'AI_SMART', 'AI_OFFENSIVE'],
    p2Flags: ['AI_BASIC', 'AI_TYPES', 'AI_SMART', 'AI_OFFENSIVE'],
  },
  {
    name: '3v3 Switching (SWITCH_OFTEN)',
    p1: [
      { species: 'Charizard', level: 50, moves: ['flamethrower', 'earthquake', 'slash', 'smokescreen'] },
      { species: 'Vaporeon', level: 50, moves: ['surf', 'icebeam', 'acidarmor', 'rest'] },
      { species: 'Jolteon', level: 50, moves: ['thunderbolt', 'thunderwave', 'doublekick', 'pinmissile'] },
    ],
    p2: [
      { species: 'Blastoise', level: 50, moves: ['surf', 'icebeam', 'earthquake', 'raindance'] },
      { species: 'Arcanine', level: 50, moves: ['flamethrower', 'extremespeed', 'crunch', 'irontail'] },
      { species: 'Exeggutor', level: 50, moves: ['psychic', 'gigadrain', 'sleeppowder', 'explosion'] },
    ],
    p1Flags: ['AI_BASIC', 'AI_TYPES', 'AI_SMART', 'AI_AGGRESSIVE'],
    p2Flags: ['AI_BASIC', 'AI_TYPES', 'AI_SMART', 'AI_AGGRESSIVE'],
    p1Switch: 'SWITCH_OFTEN',
    p2Switch: 'SWITCH_OFTEN',
  },
  {
    name: '3v3 Switching (SWITCH_SOMETIMES)',
    p1: [
      { species: 'Charizard', level: 50, moves: ['flamethrower', 'earthquake', 'slash', 'smokescreen'] },
      { species: 'Vaporeon', level: 50, moves: ['surf', 'icebeam', 'acidarmor', 'rest'] },
      { species: 'Jolteon', level: 50, moves: ['thunderbolt', 'thunderwave', 'doublekick', 'pinmissile'] },
    ],
    p2: [
      { species: 'Blastoise', level: 50, moves: ['surf', 'icebeam', 'earthquake', 'raindance'] },
      { species: 'Arcanine', level: 50, moves: ['flamethrower', 'extremespeed', 'crunch', 'irontail'] },
      { species: 'Exeggutor', level: 50, moves: ['psychic', 'gigadrain', 'sleeppowder', 'explosion'] },
    ],
    p1Flags: ['AI_BASIC', 'AI_TYPES', 'AI_SMART', 'AI_AGGRESSIVE'],
    p2Flags: ['AI_BASIC', 'AI_TYPES', 'AI_SMART', 'AI_AGGRESSIVE'],
    p1Switch: 'SWITCH_SOMETIMES',
    p2Switch: 'SWITCH_SOMETIMES',
  },
  {
    name: '6v6 Full team (gym leader flags)',
    p1: [
      { species: 'Meganium', level: 40, moves: ['razorleaf', 'bodyslam', 'poisonpowder', 'synthesis'] },
      { species: 'Ampharos', level: 40, moves: ['thunderpunch', 'firepunch', 'thunderwave', 'thunder'] },
      { species: 'Quagsire', level: 40, moves: ['earthquake', 'surf', 'sludgebomb', 'amnesia'] },
    ],
    p2: [
      { species: 'Pidgeot', level: 44, moves: ['return', 'mudslap', 'whirlwind', 'mirrorcoat'] },
      { species: 'Alakazam', level: 46, moves: ['psychic', 'thunderpunch', 'reflect', 'recover'] },
      { species: 'Exeggutor', level: 46, moves: ['psychic', 'gigadrain', 'leechseed', 'explosion'] },
    ],
    p1Flags: ['AI_BASIC', 'AI_SETUP', 'AI_SMART', 'AI_AGGRESSIVE', 'AI_CAUTIOUS', 'AI_STATUS', 'AI_RISKY'],
    p2Flags: ['AI_BASIC', 'AI_SETUP', 'AI_SMART', 'AI_AGGRESSIVE', 'AI_CAUTIOUS', 'AI_STATUS', 'AI_RISKY'],
    p1Switch: 'SWITCH_SOMETIMES',
    p2Switch: 'SWITCH_OFTEN',
  },
];

async function main() {
  console.log('Running AI scoring smoke tests...\n');
  for (const tc of TESTS) {
    const result = await runTest(tc);
    console.log(`  ${result}`);
  }
  console.log('\nAll tests completed.');
}

main().catch(console.error);
