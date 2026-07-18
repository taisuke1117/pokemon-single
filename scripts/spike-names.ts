import { getSpecies } from '../lib/calc/dex.ts';

const candidates = [
  'Garchomp',
  'Mimikyu',
  'Hippowdon',
  'Metagross-Mega',
  'Bellibolt',
  'Lucario-Mega',
  'Flutter Mane',
  'Kingambit',
  'Urshifu-Rapid-Strike',
  'Roaring Moon',
  'Charizard-Mega-X',
  'Blaziken-Mega',
];

for (const name of candidates) {
  const s = getSpecies(name);
  console.log(name.padEnd(24), s ? `OK  types=${s.types.join('/')}` : 'MISSING');
}
