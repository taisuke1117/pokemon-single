/**
 * タイプ・特性変化が評価関数(evaluateBreakdown経由のダメージ計算)に正しく反映されるか検証する。
 * ResolvedBoardを手で組み立てて評価要素へ流す(オラクル検算と同じ手法)。
 */
import { evaluateBreakdown } from '../lib/engine/gt/eval/compose';
import type { ResolvedBoard, ResolvedPokemon } from '../lib/engine/gt/types';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

function mon(overrides: Partial<ResolvedPokemon> = {}): ResolvedPokemon {
  return {
    refId: 'x', species: 'Garchomp', types: ['Dragon', 'Ground'], hpPercent: 100, boosts: {},
    isActive: true, moveIds: ['earthquake'], calc: { species: 'Garchomp', natureId: 'Jolly', evs: { a: 252, s: 252 } },
    existProbability: 1,
    ...overrides,
  };
}
function emptySc() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }
function board(selfActive: ResolvedPokemon, oppActive: ResolvedPokemon): ResolvedBoard {
  return {
    self: { active: selfActive, bench: [], side: emptySc() },
    opp: { active: oppActive, bench: [], side: emptySc() },
    field: { isTrickRoom: false },
    turn: 1,
    ended: false,
  };
}

console.log('=== みずびたしでガブリアスをみずタイプにすると、こおり技への耐性が評価(facingThreat)に反映される ===');
{
  const attacker: ResolvedPokemon = mon({ refId: 'ice', species: 'Ninetales-Alola', types: ['Ice'], calc: { species: 'Ninetales-Alola', natureId: 'Timid', evs: { c: 252, s: 252 } }, moveIds: ['icebeam'] });
  const gaba = mon({ refId: 'gaba' });
  const gabaSoaked = mon({ refId: 'gaba', typesOverride: ['Water'] });

  const before = evaluateBreakdown(board(attacker, gaba));
  const after = evaluateBreakdown(board(attacker, gabaSoaked));
  console.log(`  みずびたし前 facingThreat=${before.facingThreat} / みずびたし後 facingThreat=${after.facingThreat}`);
  // みずびたし前は確定KO(facingThreat=最大値0.4)、後は弱点解消でダメージ量ベースの連続評価に変わる
  // ため値が変化する(先後関係も絡むため単純な増減方向までは断定しない、変化自体を確認する)。
  check('みずびたし前後でfacingThreatの値が変わる(タイプ変化が計算に反映されている)', after.facingThreat !== before.facingThreat, `before=${before.facingThreat} after=${after.facingThreat}`);
}

console.log('\n=== トレースでいかく持ちの特性をコピーしても、ダメージ計算に反映される(特性の効果を確認) ===');
{
  // 「もらいび」を持つ相手に炎技を打つと、通常は無効化される。currentAbilityIdが正しく
  // ダメージ計算(@smogon/calc)に渡っていれば、無効化されることを確認できる。
  const attacker: ResolvedPokemon = mon({ refId: 'fire', species: 'Charizard', types: ['Fire', 'Flying'], calc: { species: 'Charizard', abilityId: 'Blaze', natureId: 'Timid', evs: { c: 252, s: 252 } }, moveIds: ['flamethrower'] });
  const normalMon = mon({ refId: 'norm', species: 'Blissey', types: ['Normal'], calc: { species: 'Blissey', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 } } });
  // currentAbilityIdはboard-snapshot.tsがDexで正式表記に変換してから保存する設計なので、
  // ここでも正式表記("Flash Fire")で指定する(小文字IDのままだと@smogon/calcが解決できない)。
  const flashFireMon = mon({ refId: 'norm', species: 'Blissey', types: ['Normal'], calc: { species: 'Blissey', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 } }, currentAbilityId: 'Flash Fire' });

  const before = evaluateBreakdown(board(attacker, normalMon));
  const after = evaluateBreakdown(board(attacker, flashFireMon));
  console.log(`  もらいび無し facingThreat=${before.facingThreat} / もらいび有り(currentAbilityId) facingThreat=${after.facingThreat}`);
  check('currentAbilityId(もらいび)で炎技が無効化されfacingThreatが変わる', after.facingThreat !== before.facingThreat, `before=${before.facingThreat} after=${after.facingThreat}`);
}

console.log(`\n===== 評価関数へのタイプ・特性反映スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
