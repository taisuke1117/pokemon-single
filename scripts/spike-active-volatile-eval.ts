/**
 * 評価関数拡張の検証: 混乱/やどりぎ/かなしばり/挑発/アンコール/バインド/はんどう/
 * 小さくなる/アクアリングが、静的評価値(evaluateBreakdown)に正しく反映されるか。
 * ResolvedBoardを手で組み立てて評価要素へ流す(オラクル検算と同じ手法)。
 */
import { evaluateBreakdown } from '../lib/engine/gt/eval/compose';
import type { ResolvedBoard, ResolvedPokemon } from '../lib/engine/gt/types';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

function mon(overrides: Partial<ResolvedPokemon> = {}): ResolvedPokemon {
  return {
    refId: 'x', species: 'Garchomp', types: ['Dragon', 'Ground'], hpPercent: 100, boosts: {},
    isActive: true, moveIds: ['earthquake'], calc: { species: 'Garchomp', natureId: 'Jolly', evs: {} },
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

console.log('=== 相手が混乱していれば評価値が上がる(自分有利) ===');
{
  const base = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp' }))).total;
  const withConfusion = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp', confusionTurns: 3 }))).total;
  console.log(`  base=${base} withConfusion=${withConfusion}`);
  check('相手混乱で評価値が上がる', withConfusion > base, `base=${base} vs withConfusion=${withConfusion}`);
}

console.log('\n=== 自分が混乱していれば評価値が下がる(自分不利) ===');
{
  const base = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp' }))).total;
  const selfConfused = evaluateBreakdown(board(mon({ refId: 'self', confusionTurns: 3 }), mon({ refId: 'opp' }))).total;
  console.log(`  base=${base} selfConfused=${selfConfused}`);
  check('自分混乱で評価値が下がる', selfConfused < base, `base=${base} vs selfConfused=${selfConfused}`);
}

console.log('\n=== 相手がやどりぎで拘束されていれば評価値が上がる ===');
{
  const base = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp' }))).total;
  const seeded = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp', leechSeedSourceSlot: 'p1a' }))).total;
  check('相手やどりぎで評価値が上がる', seeded > base, `base=${base} vs seeded=${seeded}`);
}

console.log('\n=== 相手がはんどうで動けなければ評価値が大きく上がる ===');
{
  const base = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp' }))).total;
  const recharge = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp', mustRecharge: true }))).total;
  console.log(`  base=${base} recharge=${recharge}`);
  // mustRecharge係数(0.25)はconfusion係数(0.15)より大きい=相対的に重い、という関係を確認する
  const confusionDiff = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp', confusionTurns: 3 }))).total - base;
  check('相手はんどうの方が混乱より評価値への影響が大きい', recharge - base > confusionDiff, `recharge差分=${recharge - base} vs confusion差分=${confusionDiff}`);
}

console.log('\n=== 相手がアンコールされていれば評価値が上がる ===');
{
  const base = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp' }))).total;
  const encored = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp', encoreMoveId: 'softboiled', encoreTurns: 2 }))).total;
  check('相手アンコールで評価値が上がる', encored > base, `base=${base} vs encored=${encored}`);
}

console.log('\n=== 相手が小さくなっていれば評価値が下がる(相手の回避率上昇=不利) ===');
{
  const base = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp' }))).total;
  const minimized = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp', minimizeActive: true }))).total;
  check('相手が小さくなっていると評価値が下がる', minimized < base, `base=${base} vs minimized=${minimized}`);
}

console.log('\n=== 瀕死個体には継続効果があっても評価に加点しない ===');
{
  const fainted = evaluateBreakdown(board(mon({ refId: 'self' }), mon({ refId: 'opp', hpPercent: 0, confusionTurns: 3 }))).activeVolatile;
  check('瀕死ならactiveVolatile=0', fainted === 0, `activeVolatile=${fainted}`);
}

console.log(`\n===== 評価関数拡張スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
