import { Dex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';

const gens = new Generations(Dex);
const gen7 = gens.get(7);

// gen7（メガが存在する世代）からメガ種族データを引けるか
for (const name of ['Metagross-Mega', 'Blaziken-Mega', 'Lucario-Mega', 'Charizard-Mega-X']) {
  const s = gen7.species.get(name);
  console.log(name, s ? { types: s.types, baseStats: s.baseStats, ability: s.abilities, requiredItem: (s as any).requiredItem } : 'NOT FOUND');
}
let megaCount = 0;
for (const s of gen7.species) if (s.name.includes('-Mega')) megaCount++;
console.log('gen7 dex内のメガ種族数:', megaCount);
