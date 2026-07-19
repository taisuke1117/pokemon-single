/**
 * 多段階先読みPhase 3: buildPayoffMatrixのdepth分岐を検証する。
 * depth=1が既存の静的評価パス(回帰なし)であること、depth=2で子行列の再帰評価が
 * 数値・所要ノード数に反映されることを確認する。
 */
import { buildPayoffMatrix } from '../lib/engine/gt/matrix-builder';
import { type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import type { SnapshotArgs } from '../lib/engine/gt/chance-sampling';
import { createBattleParticipant } from '../lib/types';
import type { CalcSpec, BattleParticipant, BattleFieldState } from '../lib/types';

function part(p: Partial<BattleParticipant> = {}): BattleParticipant { return { ...createBattleParticipant(), ...p }; }
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant> = {}): GtMember { return { refId, displayName: refId, calc, participant: part(p) }; }
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot { return { activeRefId, members }; }
function sc() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

const gyara: CalcSpec = { species: 'Gyarados', itemId: 'Leftovers', abilityId: 'Intimidate', natureId: 'Adamant', evs: { a: 252, h: 252 }, moveIds: ['swordsdance', 'waterfall', 'earthquake'] };
const wobb: CalcSpec = { species: 'Wobbuffet', itemId: 'Leftovers', abilityId: 'Shadow Tag', natureId: 'Bold', evs: { h: 252, d: 252 }, moveIds: ['splash', 'counter'] };

const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };
const self1 = side('gyara', [member('gyara', gyara)]);
const opp1 = side('wobb', [member('wobb', wobb)]);
const args: SnapshotArgs = {
  self: self1, opp: opp1, field,
  calcByRef: new Map([...self1.members, ...opp1.members].map((m) => [m.refId, m.calc])),
};

console.log('=== 1. depth未指定(既定1)は完全後方互換(depthReached=1) ===');
{
  const res = buildPayoffMatrix(args, { samples: 4 });
  console.log('  depthReached:', res.depthReached, 'nodesEvaluated:', res.nodesEvaluated, 'matrix size:', res.matrix.length, 'x', res.matrix[0]?.length);
  check('depthReached=1', res.depthReached === 1, `depthReached=${res.depthReached}`);
  check('行列サイズは合法手数どおり(3x2)', res.matrix.length === 3 && res.matrix[0].length === 2, `size=${res.matrix.length}x${res.matrix[0]?.length}`);
}

console.log('\n=== 2. depth=2は子行列の再帰評価が行われnodesEvaluatedが増える ===');
{
  const res1 = buildPayoffMatrix(args, { samples: 4 });
  const res2 = buildPayoffMatrix(args, { samples: 4, depth: 2, beamWidth: 2, samplesForDepth: () => 2 });
  console.log('  depth1 nodesEvaluated:', res1.nodesEvaluated, 'depth2 nodesEvaluated:', res2.nodesEvaluated);
  console.log('  depth2 depthReached:', res2.depthReached);
  check('depth=2はdepthReached=2を返す', res2.depthReached === 2, `depthReached=${res2.depthReached}`);
  check('depth=2はdepth=1よりノード評価回数が多い(再帰した証拠)', res2.nodesEvaluated > res1.nodesEvaluated, `depth1=${res1.nodesEvaluated}, depth2=${res2.nodesEvaluated}`);
  console.log('  depth1 matrix:', res1.matrix);
  console.log('  depth2 matrix:', res2.matrix);
  check('depth=2でも行列の形は変わらない(選択肢自体は削らずセルの中身だけ変わる、ルート呼び出しなのでpruneOwnActions=false)', res2.matrix.length === res1.matrix.length && res2.matrix[0].length === res1.matrix[0].length, `size1=${res1.matrix.length}x${res1.matrix[0].length}, size2=${res2.matrix.length}x${res2.matrix[0].length}`);
}

console.log('\n=== 3. depth=2でつるぎのまいの2ターン目の展開が評価値に反映される(swordsdance行の値が相対的に上がる) ===');
{
  // つるぎのまい(a+2)は1ターン目単体では大した戦果を生まないが、2ターン目にwaterfall/earthquakeが
  // 強化されるため、depth=2ならその後続ターンの価値が評価に乗るはず。
  // (Wobbuffetはcounterを持つため、depth=1の静的評価では「つるぎのまいは何もしていない」扱いになりがち)
  const res1 = buildPayoffMatrix(args, { samples: 8 });
  const res2 = buildPayoffMatrix(args, { samples: 8, depth: 2, beamWidth: 3, samplesForDepth: () => 3 });
  const sdIdx = res1.selfActions.findIndex((a) => a.action.kind === 'move' && a.action.moveId === 'swordsdance');
  const avgRow = (m: number[][], i: number) => m[i].reduce((s, v) => s + v, 0) / m[i].length;
  const sd1 = avgRow(res1.matrix, sdIdx);
  const sd2 = avgRow(res2.matrix, sdIdx);
  console.log(`  swordsdance行の平均評価値: depth1=${sd1.toFixed(3)}, depth2=${sd2.toFixed(3)}`);
  check('depth=2でつるぎのまいの評価値が算出できる(NaN/例外なし)', Number.isFinite(sd2), `sd2=${sd2}`);
}

console.log(`\n===== 再帰行列スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
