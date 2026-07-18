/**
 * タスク#40検証: trapped(交代不可)が正しく読み出されるか。
 *
 * 判明した重要な事実: こだわり系アイテムは「技」を縛るだけで「交代」自体は禁止しない
 * （ポケモンの実際のルール上、こだわりロック中でも自由に交代できる）。trapped=true になるのは
 * 「くろいまなざし」「ありじごく」等の交代封じ技/特性のみ。choiceLockedMoveIdとtrappedは無関係。
 * （実測確認済み: こだわりバンドで技はdisabled化されるがtrappedはfalseのまま）
 */
import { applyTurn } from '../lib/engine/gt/bridge/apply-turn';
import { type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import { createBattleParticipant } from '../lib/types';
import type { CalcSpec, BattleParticipant, BattleFieldState } from '../lib/types';

function part(p: Partial<BattleParticipant>): BattleParticipant { return { ...createBattleParticipant(), ...p }; }
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant> = {}): GtMember { return { refId, displayName: refId, calc, participant: part(p) }; }
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot { return { activeRefId, members }; }
function sc() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }
const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

const chomp: CalcSpec = { species: 'Garchomp', itemId: 'Choice Band', abilityId: 'Rough Skin', natureId: 'Adamant', evs: { a: 252, h: 4 }, moveIds: ['ironhead', 'dragonclaw'] };
const bliss: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 }, moveIds: ['meanlook', 'softboiled'] };

console.log('=== こだわり技を撃っただけでは trapped は付かない（技の絞り込みのみ） ===');
{
  const self = side('chomp', [member('chomp', chomp)]);
  const opp = side('bliss', [member('bliss', bliss)]);
  const allMembers = [...self.members, ...opp.members];
  const res = applyTurn({
    self, opp, field,
    calcByRef: new Map(allMembers.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(allMembers.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'ironhead' },
    oppAction: { kind: 'move', moveId: 'softboiled' },
    selfObserved: { wasCrit: false, hpPercentAfter: 60 },
  });
  console.log('  trapped:', res.board.self.active.trapped, 'choiceLockedMoveId:', res.board.self.active.choiceLockedMoveId);
  check('choiceLockedMoveIdは付くがtrappedは付かない', res.board.self.active.trapped === undefined && res.board.self.active.choiceLockedMoveId === 'ironhead', `trapped=${res.board.self.active.trapped} locked=${res.board.self.active.choiceLockedMoveId}`);
}

console.log('\n=== くろいまなざし(交代封じ技)を受けると trapped=true になる ===');
{
  const self = side('chomp', [member('chomp', chomp)]);
  const opp = side('bliss', [member('bliss', bliss)]);
  const allMembers = [...self.members, ...opp.members];
  const res = applyTurn({
    self, opp, field,
    calcByRef: new Map(allMembers.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(allMembers.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'ironhead' },
    oppAction: { kind: 'move', moveId: 'meanlook' },
  });
  console.log('  trapped:', res.board.self.active.trapped);
  check('くろいまなざしを受けたら trapped=true', res.board.self.active.trapped === true, `trapped=${res.board.self.active.trapped}`);
}

console.log(`\n===== trappedスパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
