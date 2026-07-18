import { calcDamage, getStats } from '../lib/calc/damage.ts';
import { getChampionsSpecies, getSpecies } from '../lib/calc/dex.ts';

console.log('=== 種族データ ===');
const all = getChampionsSpecies();
const megas = all.filter((s) => s.isMega);
console.log('総種族数:', all.length, '/ うちメガ:', megas.length);
console.log('メガメタグロス:', JSON.stringify(getSpecies('Metagross-Mega')));

console.log('\n=== ダメ計（レベル50想定） ===');
const r1 = calcDamage(
  { species: 'Garchomp', item: 'Choice Scarf', nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 } },
  { species: 'Hippowdon', nature: 'Impish', evs: { hp: 252, def: 252 } },
  'Earthquake',
);
console.log(`ガブ→カバルドン: ${r1.minPct}-${r1.maxPct}% / ${r1.koText}`);

const r2 = calcDamage(
  { species: 'Metagross-Mega', nature: 'Jolly', evs: { atk: 252, spe: 252 } },
  { species: 'Garchomp', nature: 'Jolly', evs: { spe: 252, hp: 4 } },
  'Meteor Mash',
);
console.log(`メガメタ→ガブ: ${r2.minPct}-${r2.maxPct}% / ${r2.koText}`);

console.log('\n=== 素早さ実数値(Lv50) ===');
console.log(
  'スカーフようきガブ Spe:',
  getStats({ species: 'Garchomp', item: 'Choice Scarf', nature: 'Jolly', evs: { spe: 252 } }).spe,
);
console.log(
  'メガメタグロス Spe:',
  getStats({ species: 'Metagross-Mega', nature: 'Jolly', evs: { spe: 252 } }).spe,
);
