import { Dex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';

const gens = new Generations(Dex);
const gen9 = gens.get(9);

const items = [
  'Choice Scarf', 'Rocky Helmet', 'Life Orb', 'Metagrossite', 'Lucarionite',
  'Leftovers', 'Assault Vest', 'Choice Band', 'Choice Specs', 'Focus Sash',
];
const abilities = [
  'Rough Skin', 'Sand Stream', 'Clear Body', 'Electric Surge', 'Disguise',
  'Tough Claws', 'Justified', 'Inner Focus', 'Adaptability',
];
const natures = ['Jolly', 'Impish', 'Timid', 'Modest', 'Adamant', 'Bold', 'Careful'];

for (const i of items) console.log('item', i.padEnd(20), gen9.items.get(i) ? 'OK' : 'MISSING');
for (const a of abilities) console.log('ability', a.padEnd(20), gen9.abilities.get(a) ? 'OK' : 'MISSING');
for (const n of natures) console.log('nature', n.padEnd(20), gen9.natures.get(n) ? 'OK' : 'MISSING');

const gen7 = gens.get(7);
console.log('--- gen7 fallback ---');
for (const i of ['Metagrossite', 'Lucarionite', 'Blazikenite', 'Charizardite X']) {
  console.log('item(gen7)', i.padEnd(20), gen7.items.get(i) ? 'OK' : 'MISSING');
}
