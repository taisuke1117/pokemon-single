import { calcDamage, getStats } from '../lib/calc/damage.ts';

// メガストーン(Metagrossite)を指定してもエラーにならないか、実数値が変わるかを確認
try {
  const withItem = getStats({ species: 'Metagross-Mega', item: 'Metagrossite', nature: 'Jolly', evs: { spe: 252 } });
  console.log('with Metagrossite item Spe:', withItem.spe);
} catch (e) {
  console.log('with item ERROR:', String(e));
}

const withoutItem = getStats({ species: 'Metagross-Mega', nature: 'Jolly', evs: { spe: 252 } });
console.log('without item Spe:', withoutItem.spe);

const r = calcDamage(
  { species: 'Metagross-Mega', item: 'Metagrossite', nature: 'Jolly', evs: { atk: 252 } },
  { species: 'Garchomp', nature: 'Jolly', evs: { hp: 4 } },
  'Meteor Mash',
);
console.log(r.desc);
