/**
 * タスク#43検証: activeが配列の先頭でない場合、交代先ラベル・existProbByRefブレンド処理が
 * 正しい控えを指すか(修正前は「今場に出ている個体に交代」という誤ったラベルになっていた)。
 */
import { buildPayoffMatrix } from '../lib/engine/gt/matrix-builder';
import type { GtMember, GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import { createBattleParticipant } from '../lib/types';
import type { CalcSpec, BattleParticipant, BattleFieldState } from '../lib/types';

function part(p: Partial<BattleParticipant> = {}): BattleParticipant { return { ...createBattleParticipant(), ...p }; }
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant> = {}): GtMember {
  return { refId, displayName: refId, calc, participant: part(p) };
}
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot { return { activeRefId, members }; }
function sc() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }
const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

const garchomp: CalcSpec = { species: 'Garchomp', itemId: 'Focus Sash', abilityId: 'Rough Skin', natureId: 'Jolly', evs: { a: 252, s: 252 }, moveIds: ['earthquake'] };
const dragapult: CalcSpec = { species: 'Dragapult', itemId: 'Choice Specs', abilityId: 'Infiltrator', natureId: 'Timid', evs: { c: 252, s: 252 }, moveIds: ['dracometeor'] };
const iron: CalcSpec = { species: 'Iron Hands', itemId: 'Booster Energy', abilityId: 'Quark Drive', natureId: 'Adamant', evs: { h: 252, a: 252 }, moveIds: ['drainpunch'] };
const bliss: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 }, moveIds: ['softboiled'] };

console.log('=== activeが配列の中間(index=1)にいる場合の交代ラベル ===');
{
  // members配列順: A(garchomp, refId='a'), B(dragapult, refId='b'=active), C(iron, refId='c')
  const self = side('b', [
    member('a', garchomp),
    member('b', dragapult),
    member('c', iron),
  ]);
  const opp = side('bliss', [member('bliss', bliss)]);
  const result = buildPayoffMatrix({
    self, opp, field,
    calcByRef: new Map([['a', garchomp], ['b', dragapult], ['c', iron], ['bliss', bliss]]),
  });
  const switchLabels = result.selfActions.filter((a) => a.action.kind === 'switch').map((a) => a.label);
  console.log('  交代先ラベル一覧:', switchLabels);
  check('activeであるdragapult(b)自身への交代が選択肢に無い', !switchLabels.some((l) => l.includes('→b')), `labels=${switchLabels}`);
  check('garchomp(a)への交代がラベルに存在', switchLabels.some((l) => l.includes('→a')), `labels=${switchLabels}`);
  check('iron(c)への交代がラベルに存在', switchLabels.some((l) => l.includes('→c')), `labels=${switchLabels}`);
  check('交代先ラベルが2件(a,cのみ)', switchLabels.length === 2, `count=${switchLabels.length}`);
}

console.log(`\n===== 交代ラベル修正スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
