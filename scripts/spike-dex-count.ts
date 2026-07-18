import { getChampionsSpecies, getSpecies } from '../lib/calc/dex.ts';

const all = getChampionsSpecies();
const megas = all.filter((s) => s.isMega);
console.log('総種族数:', all.length, '内メガ:', megas.length);

for (const name of ['Eelektross-Mega', 'Staraptor-Mega', 'Scrafty-Mega', 'Barbaracle-Mega', 'Falinks-Mega', 'Metagross-Mega']) {
  const s = getSpecies(name);
  console.log(name.padEnd(18), s ? `OK types=${s.types.join('/')} item=${s.requiredItem}` : 'MISSING');
}
