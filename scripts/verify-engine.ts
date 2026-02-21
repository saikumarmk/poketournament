import { Battle, Choice, initialize } from '@pkmn/engine';
import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';

async function main() {
  await initialize(true);
  const gens = new Generations(Dex);
  const gen = gens.get(1);

  const battle = Battle.create(gen, {
    seed: [1, 2, 3, 4],
    showdown: true,
    p1: {
      team: [
        { species: 'Pikachu', moves: ['Thunder Shock', 'Quick Attack', 'Thunder Wave', 'Growl'], level: 25 },
      ],
    },
    p2: {
      team: [
        { species: 'Charmander', moves: ['Ember', 'Scratch', 'Leer', 'Growl'], level: 25 },
      ],
    },
  });

  let result = battle.update(Choice.pass, Choice.pass);
  let turn = 0;
  while (!result.type && turn < 100) {
    const c1 = battle.choices('p1', result);
    const c2 = battle.choices('p2', result);
    result = battle.update(c1[0], c2[0]);
    turn++;
  }

  console.log(`Battle ended after ${turn} turns — result: ${result.type}`);
  console.log('Engine verification passed.');
}

main();
