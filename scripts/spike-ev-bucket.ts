/**
 * C1検証: EVバケット推定ロジックが、0振り/252振りで結果が明確に分かれるケースを正しく判定できるか。
 * 実行: npx tsx scripts/spike-ev-bucket.ts
 */
import { summarizeOpponentInference } from '../lib/engine/infer';
import { createBattleParticipant, type BattleState, type CalcSpec, type MoveObservation, type OpponentSlot } from '../lib/types';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

// 無振りガブのげんしのちから: コイキングのHP EVで観測ダメージが変わる
// (中立性格代表での0振り想定60-71.6%, 252振り想定44.9-53.5%。重ならず100%以下に収まる)組み合わせ。
const garchomp: CalcSpec = { species: 'Garchomp', abilityId: 'Rough Skin', natureId: 'Hardy', evs: {}, moveIds: ['ancientpower'] };

const slot: OpponentSlot = {
  id: 'o1', query: 'コイキング', resolvedName: 'コイキング', species: 'Magikarp', types: ['みず'], rank: 900,
  spreads: [{ name: '通常', prob: 1, item: '', itemId: '', ability: 'すいすい', abilityId: 'Swift Swim', nature: 'ずぶとい', natureId: 'Bold', evs: {} }],
  moveUsage: [],
};

function summarize(observedPct: number) {
  const obs: MoveObservation = {
    turn: 1, attackerSide: 'self', moveId: 'Ancient Power',
    defenderHpPercentBefore: 100, defenderHpPercentAfter: 100 - observedPct,
    wasCrit: false, selfMemberId: 's1', oppSlotId: 'o1',
  };
  const state: BattleState = {
    turn: 1, selfActiveMemberId: 's1', oppActiveSlotId: 'o1',
    self: {}, opponent: { o1: createBattleParticipant() },
    field: { isTrickRoom: false, selfSide: { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }, oppSide: { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false } },
    observations: [obs],
  };
  return summarizeOpponentInference('o1', [obs], { s1: garchomp }, slot, state.opponent.o1);
}

// げんしのちからは実は特殊技(岩タイプだが分類はSpecial)なのでspecialBulkに反映される。
// EVバケット判定は「特防(SpD)単体」のEVを振って判定する(既存inferFromObservationの設計を踏襲)。
// SpD0振り想定: 60-71.6%。SpD252振り想定: 33.7-40%。この2つは重ならないレンジ。
console.log('=== 大ダメージ(0振り想定レンジ内) ===');
const r1 = summarize(65); // 65%減(0振り想定レンジ内のみ)
console.log('  specialBulk =', r1?.evEstimate.specialBulk);
check('高ダメージ観測でspecialBulk=low(振り無し寄り)と判定', r1?.evEstimate.specialBulk === 'low', `specialBulk=${r1?.evEstimate.specialBulk}`);

console.log('\n=== 低ダメージ(252振り想定レンジ内) ===');
const r2 = summarize(37); // 37%減(252振り想定レンジ内のみ)
console.log('  specialBulk =', r2?.evEstimate.specialBulk);
check('低ダメージ観測でspecialBulk=high(振り有り寄り)と判定', r2?.evEstimate.specialBulk === 'high', `specialBulk=${r2?.evEstimate.specialBulk}`);

check('両者が異なるbucketに分かれる(EVの多寡で判定が変わる)', r1?.evEstimate.specialBulk !== r2?.evEstimate.specialBulk, `r1=${r1?.evEstimate.specialBulk} r2=${r2?.evEstimate.specialBulk}`);

console.log(`\n===== EVバケットスパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
