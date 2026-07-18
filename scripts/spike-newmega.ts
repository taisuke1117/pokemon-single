import { Dex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';

const gens = new Generations(Dex);

const candidates = [
  'Raichu-Mega', 'Staraptor-Mega', 'Pyroar-Mega', 'Eelektross-Mega',
  'Malamar-Mega', 'Drapion-Mega', 'Dragalge-Mega', 'Tyrantrum-Mega',
  'Zoroark-Mega', 'Torkoal-Mega',
];

for (let g = 6; g <= 9; g++) {
  const gen = gens.get(g);
  for (const name of candidates) {
    const s = gen.species.get(name);
    if (s) console.log(`gen${g}`, name, 'FOUND', s.types);
  }
}
console.log('--- 見つからなかったもの ---');
const gen9 = gens.get(9);
for (const name of candidates) {
  const foundAny = [6,7,8,9].some(g => gens.get(g).species.get(name));
  if (!foundAny) console.log(name, 'NOT FOUND in any gen 6-9');
}

// dex package自体のバージョンとメガ総数(gen7)を再確認
console.log('--- @pkmn/dex package version ---');
console.log(require('@pkmn/dex/package.json').version);
