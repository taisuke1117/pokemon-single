/**
 * 相手の技のうち、判明済みでない(採用率で埋めただけの)技が自分に対して非常に有効な場合、
 * ナッシュ均衡がその1手に確率を集中させてしまう問題への対応を検証する。
 * moveExistProbByRefで低い存在確率(採用率)を与えると、その技のセル評価値が
 * 「その技を持っていない場合」の代替値とブレンドされ、極端な集中が緩和されることを確認する。
 */
import { buildPayoffMatrix } from '../lib/engine/gt/matrix-builder';
import { solveNash } from '../lib/engine/gt/solve/nash';
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

// 自分: 飛行/水複合(かみなりに4倍弱点) — 相手のthunderboltがあれば確定圏、無ければ他の無害技で拮抗する
const self1poke: CalcSpec = { species: 'Gyarados', itemId: 'Leftovers', abilityId: 'Intimidate', natureId: 'Bold', evs: { h: 252, b: 252 }, moveIds: ['waterfall', 'icefang'] };
// 相手: thunderbolt(自分に激烈に有効)+無害技3つ。thunderboltは「採用率で埋めただけ」の想定(判明していない)。
const opp1poke: CalcSpec = { species: 'Raichu', itemId: 'Leftovers', natureId: 'Timid', evs: { c: 252, s: 252 }, moveIds: ['thunderbolt', 'tackle', 'growl', 'charm'] };

const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };
const self1 = side('gyara', [member('gyara', self1poke)]);
const opp1 = side('raichu', [member('raichu', opp1poke)]);

console.log('=== 1. moveExistProbByRef未指定なら、雷が確定枠として扱われnashが集中しがち ===');
{
  const args: SnapshotArgs = {
    self: self1, opp: opp1, field,
    calcByRef: new Map([...self1.members, ...opp1.members].map((m) => [m.refId, m.calc])),
  };
  const payoff = buildPayoffMatrix(args, { samples: 16 });
  const nash = solveNash(payoff.matrix);
  const thunderIdx = payoff.oppActions.findIndex((a) => a.action.kind === 'move' && a.action.moveId === 'thunderbolt');
  console.log('  oppActions:', payoff.oppActions.map((a) => a.label));
  console.log('  oppMix:', nash.oppMix.map((v) => v.toFixed(3)));
  console.log('  thunderbolt(存在確率デフォルト=1)への確率:', nash.oppMix[thunderIdx]?.toFixed(3));
  check('雷技への集中度が高い(ベースラインとして記録するだけ、成否判定なし)', true, `p=${nash.oppMix[thunderIdx]}`);
}

console.log('\n=== 2. moveExistProbByRefで雷の存在確率を低く(0.1)すると、集中が緩和される ===');
{
  const moveExistProbByRef = new Map<string, Map<string, number>>([
    ['raichu', new Map([['thunderbolt', 0.1]])],
  ]);
  const args: SnapshotArgs = {
    self: self1, opp: opp1, field,
    calcByRef: new Map([...self1.members, ...opp1.members].map((m) => [m.refId, m.calc])),
    moveExistProbByRef,
  };
  const argsNoProb: SnapshotArgs = {
    self: self1, opp: opp1, field,
    calcByRef: new Map([...self1.members, ...opp1.members].map((m) => [m.refId, m.calc])),
  };
  const payoffNoProb = buildPayoffMatrix(argsNoProb, { samples: 16 });
  const payoff = buildPayoffMatrix(args, { samples: 16 });
  const thunderIdx = payoff.oppActions.findIndex((a) => a.action.kind === 'move' && a.action.moveId === 'thunderbolt');
  console.log('  存在確率無し matrix row0(自分のwaterfall視点):', payoffNoProb.matrix[0].map((v) => v.toFixed(2)));
  console.log('  存在確率0.1 matrix row0(自分のwaterfall視点):', payoff.matrix[0].map((v) => v.toFixed(2)));
  const cellNoProb = payoffNoProb.matrix[0][thunderIdx];
  const cellWithProb = payoff.matrix[0][thunderIdx];
  console.log(`  thunderboltセルの値: 存在確率無し=${cellNoProb.toFixed(3)}, 存在確率0.1=${cellWithProb.toFixed(3)}`);
  check(
    '存在確率0.1を与えるとthunderboltセルの評価(自分視点)が改善する(他技とブレンドされ極端な不利が緩和)',
    cellWithProb > cellNoProb,
    `noProb=${cellNoProb.toFixed(3)}, withProb=${cellWithProb.toFixed(3)}`,
  );

  const nash = solveNash(payoff.matrix);
  const nashNoProb = solveNash(payoffNoProb.matrix);
  console.log('  oppMix(存在確率無し):', nashNoProb.oppMix.map((v) => v.toFixed(3)));
  console.log('  oppMix(存在確率0.1):', nash.oppMix.map((v) => v.toFixed(3)));
  check(
    '存在確率0.1を与えるとナッシュ均衡でのthunderbolt選択確率が下がる(極端な集中が緩和)',
    nash.oppMix[thunderIdx] <= nashNoProb.oppMix[thunderIdx],
    `noProb=${nashNoProb.oppMix[thunderIdx].toFixed(3)}, withProb=${nash.oppMix[thunderIdx].toFixed(3)}`,
  );
}

console.log('\n=== 3. 存在確率1(判明済み相当)を明示指定した場合は元のまま変化しない ===');
{
  const moveExistProbByRef = new Map<string, Map<string, number>>([
    ['raichu', new Map([['thunderbolt', 1]])],
  ]);
  const args: SnapshotArgs = {
    self: self1, opp: opp1, field,
    calcByRef: new Map([...self1.members, ...opp1.members].map((m) => [m.refId, m.calc])),
    moveExistProbByRef,
  };
  const argsNoProb: SnapshotArgs = {
    self: self1, opp: opp1, field,
    calcByRef: new Map([...self1.members, ...opp1.members].map((m) => [m.refId, m.calc])),
  };
  const payoff = buildPayoffMatrix(args, { samples: 8 });
  const payoffNoProb = buildPayoffMatrix(argsNoProb, { samples: 8 });
  const thunderIdx = payoff.oppActions.findIndex((a) => a.action.kind === 'move' && a.action.moveId === 'thunderbolt');
  // p>=1はブレンド処理自体がスキップされる(matrix-builder.tsのif (p === undefined || p >= 1) return;)ので完全一致するはず
  check(
    '存在確率1指定はブレンドをスキップし元の評価値と一致する',
    Math.abs(payoff.matrix[0][thunderIdx] - payoffNoProb.matrix[0][thunderIdx]) < 0.001,
    `withP1=${payoff.matrix[0][thunderIdx].toFixed(4)}, noProb=${payoffNoProb.matrix[0][thunderIdx].toFixed(4)}`,
  );
}

console.log(`\n===== 技存在確率ブレンドスパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
