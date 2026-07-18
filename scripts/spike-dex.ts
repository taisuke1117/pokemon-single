import { Dex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';

const gens = new Generations(Dex);
const gen9 = gens.get(9);

for (const name of ['Garchomp', 'Metagross-Mega', 'Blaziken-Mega']) {
  const s = gen9.species.get(name);
  console.log(name, s ? { types: s.types, baseStats: s.baseStats, ability: s.abilities } : 'NOT FOUND');
}
// メガ一覧の件数（gen9 dexにメガが含まれるか）
let megaCount = 0;
for (const s of gen9.species) if (s.name.includes('-Mega')) megaCount++;
console.log('gen9 dex内のメガ種族数:', megaCount);
