import { calcDamage, getStats } from '../lib/calc/damage.ts';

console.log('--- 新規メガ: メガシビルドン(Eelektross-Mega) の実数値 ---');
try {
  const stats = getStats({ species: 'Eelektross-Mega', nature: 'Modest', evs: { spa: 252 } });
  console.log(JSON.stringify(stats));
} catch (e) {
  console.log('ERROR:', String(e));
}

console.log('--- 新規メガ: メガスターミー(Starmie-Mega) が ガブリアスを殴る ---');
try {
  const r = calcDamage(
    { species: 'Starmie-Mega', item: 'Starminite', nature: 'Timid', evs: { spa: 252 } },
    { species: 'Garchomp', nature: 'Jolly', evs: { hp: 4 } },
    'Hydro Pump',
  );
  console.log(r.desc);
} catch (e) {
  console.log('ERROR:', String(e));
}

console.log('--- 新規メガ: メガスタラプター(Staraptor-Mega, Contrary) が つるぎのまい後に殴る想定 ---');
try {
  const r2 = calcDamage(
    { species: 'Staraptor-Mega', ability: 'Contrary', nature: 'Adamant', evs: { atk: 252 } },
    { species: 'Hippowdon', nature: 'Impish', evs: { hp: 252, def: 4 } },
    'Close Combat',
  );
  console.log(r2.desc);
} catch (e) {
  console.log('ERROR:', String(e));
}
