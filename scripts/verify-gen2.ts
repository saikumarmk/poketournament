import { BattleStreams, Teams, RandomPlayerAI } from '@pkmn/sim';

async function main() {
  const p1Team = Teams.pack([
    {
      name: '', species: 'Typhlosion', item: 'Charcoal', nature: '',
      evs: { hp: 252, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
      moves: ['flamethrower', 'thunderpunch', 'earthquake', 'swift'],
      level: 50, gender: '',
    },
    {
      name: '', species: 'Ampharos', item: 'Leftovers', nature: '',
      evs: { hp: 252, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
      moves: ['thunderbolt', 'firepunch', 'thunderwave', 'lightscreen'],
      level: 50, gender: '',
    },
  ]);

  const p2Team = Teams.pack([
    {
      name: '', species: 'Feraligatr', item: 'Mystic Water', nature: '',
      evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 },
      ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
      moves: ['surf', 'icepunch', 'earthquake', 'slash'],
      level: 50, gender: '',
    },
    {
      name: '', species: 'Espeon', item: 'Leftovers', nature: '',
      evs: { hp: 252, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },
      ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
      moves: ['psychic', 'shadowball', 'morningsun', 'bite'],
      level: 50, gender: '',
    },
  ]);

  console.log('Teams packed successfully');

  const streams = BattleStreams.getPlayerStreams(
    new BattleStreams.BattleStream(),
  );

  const spec = { formatid: 'gen2ou', seed: [1, 2, 3, 4] as [number, number, number, number] };

  const p1ai = new RandomPlayerAI(streams.p1);
  const p2ai = new RandomPlayerAI(streams.p2);

  void p1ai.start();
  void p2ai.start();

  void streams.omniscient.write(
    `>start ${JSON.stringify(spec)}\n>player p1 ${JSON.stringify({ name: 'P1', team: p1Team })}\n>player p2 ${JSON.stringify({ name: 'P2', team: p2Team })}`,
  );

  let turn = 0;
  let winner: string | null = null;
  const faints: string[] = [];
  const moves: string[] = [];

  for await (const chunk of streams.omniscient) {
    for (const line of chunk.split('\n')) {
      if (line.startsWith('|turn|')) {
        turn = parseInt(line.split('|')[2], 10);
      }
      if (line.startsWith('|win|')) {
        winner = line.split('|')[2];
      }
      if (line.startsWith('|faint|')) {
        faints.push(line.trim());
      }
      if (line.startsWith('|move|') && moves.length < 20) {
        moves.push(line.trim());
      }
    }
    if (winner) break;
  }

  console.log(`\nBattle ended after ${turn} turns. Winner: ${winner}`);
  console.log(`\nFirst moves:`);
  for (const m of moves.slice(0, 10)) {
    console.log(' ', m);
  }
  console.log(`\nFaints (${faints.length}):`);
  for (const f of faints) {
    console.log(' ', f);
  }
  console.log('\nGen 2 battle simulation via @pkmn/sim PASSED.');
}

main().catch(e => {
  console.error('Gen 2 test failed:', e.message);
  process.exit(1);
});
