/**
 * Phase 0 技術検証スパイク
 * 目的: @smogon/calc + @pkmn/dex で
 *   (1) gen9 の通常ダメ計が動くか
 *   (2) チャンピオンズで復活した「メガシンカ」を扱えるか
 * を確認し、差分パッチの要否を判断する。
 */
import { Generations, Pokemon, Move, calculate } from '@smogon/calc';

const gen9 = Generations.get(9);
const gen7 = Generations.get(7);

function inspectSpecies(gen: any, name: string) {
  try {
    const s = gen.species.get(name);
    if (!s) return { name, exists: false };
    const bst = Object.values(s.baseStats as Record<string, number>).reduce(
      (a, b) => a + b,
      0,
    );
    return { name, exists: true, types: s.types, baseStats: s.baseStats, bst };
  } catch (e) {
    return { name, exists: false, error: String(e) };
  }
}

console.log('=== (1) 種族データ存在チェック ===');
for (const [gen, label] of [
  [gen9, 'gen9'],
  [gen7, 'gen7'],
] as const) {
  for (const name of [
    'Garchomp',
    'Metagross-Mega',
    'Blaziken-Mega',
    'Lucario-Mega',
    'Charizard-Mega-X',
  ]) {
    console.log(label, JSON.stringify(inspectSpecies(gen, name)));
  }
}

console.log('\n=== (2) gen9 通常ダメ計: 準速スカーフガブ じしん → 特化カバルドン ===');
try {
  const atk = new Pokemon(gen9, 'Garchomp', {
    item: 'Choice Scarf',
    nature: 'Jolly',
    evs: { atk: 252, spe: 252, hp: 4 },
  });
  const def = new Pokemon(gen9, 'Hippowdon', {
    nature: 'Impish',
    evs: { hp: 252, def: 252 },
  });
  const res = calculate(gen9, atk, def, new Move(gen9, 'Earthquake'));
  console.log(res.desc());
} catch (e) {
  console.log('通常ダメ計エラー:', String(e));
}

console.log('\n=== (3) メガのダメ計を試す（存在した gen で） ===');
for (const [gen, label] of [
  [gen9, 'gen9'],
  [gen7, 'gen7'],
] as const) {
  try {
    const atk = new Pokemon(gen, 'Metagross-Mega', {
      nature: 'Jolly',
      evs: { atk: 252, spe: 252 },
    });
    const def = new Pokemon(gen, 'Garchomp', {
      nature: 'Jolly',
      evs: { hp: 4, spe: 252 },
    });
    const res = calculate(gen, atk, def, new Move(gen, 'Meteor Mash'));
    console.log(label, res.desc());
  } catch (e) {
    console.log(label, 'メガダメ計エラー:', String(e));
  }
}
