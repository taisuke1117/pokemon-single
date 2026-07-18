/**
 * タスク#42検証: TurnActionSpecでmegaを指定した場合、applyTurn出力のmegaActiveが正しく立ち、
 * board-to-stateでmegaUsedへ反映されるか。
 * （テラスタルはこの対戦環境で使用しないため対象外。legal-moves.tsで選択肢自体を列挙しない）
 */
import { PRNG } from '@pkmn/sim';
import { applyTurn } from '../lib/engine/gt/bridge/apply-turn';
import { applyResolvedBoard } from '../lib/engine/gt/bridge/board-to-state';
import { buildBattleFromSnapshot, type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import { enumerateLegalActions } from '../lib/engine/gt/legal-moves';
import { createBattleParticipant } from '../lib/types';
import type { CalcSpec, BattleParticipant, BattleFieldState, BattleState } from '../lib/types';

function part(p: Partial<BattleParticipant>): BattleParticipant { return { ...createBattleParticipant(), ...p }; }
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant> = {}): GtMember { return { refId, displayName: refId, calc, participant: part(p) }; }
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot { return { activeRefId, members }; }
function sc() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }
const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

const metagross: CalcSpec = { species: 'Metagross-Mega', itemId: 'Metagrossite', abilityId: 'Tough Claws', natureId: 'Jolly', evs: { a: 252, s: 252 }, moveIds: ['meteormash'] };
const bliss: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 }, moveIds: ['softboiled'] };

console.log('=== mega:true指定でメガ化し、次盤面のmegaUsedに反映される ===');
{
  const self = side('meta', [member('meta', metagross, { megaUsed: false })]);
  const opp = side('bliss', [member('bliss', bliss)]);
  const allMembers = [...self.members, ...opp.members];
  const res = applyTurn({
    self, opp, field,
    calcByRef: new Map(allMembers.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(allMembers.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'meteormash', mega: true },
    oppAction: { kind: 'move', moveId: 'softboiled' },
  });
  const state: BattleState = { turn: 1, selfActiveMemberId: 'meta', oppActiveSlotId: 'bliss', self: { meta: part({ megaUsed: false }) }, opponent: {}, field, observations: [] };
  const patch = applyResolvedBoard(state, res.board);
  console.log('  species:', res.board.self.active.species, 'megaActive:', res.board.self.active.megaActive, 'patch.megaUsed:', patch.self.meta.megaUsed);
  check('メガ化しspeciesがMetagross-Megaになる', res.board.self.active.species === 'Metagross-Mega', `species=${res.board.self.active.species}`);
  check('board-to-stateでmegaUsed:trueに反映される', patch.self.meta.megaUsed === true, `megaUsed=${patch.self.meta.megaUsed}`);
}

console.log('\n=== megaUsed:trueなら選択肢からメガオプションが消える ===');
{
  const self = side('meta', [member('meta', metagross, { megaUsed: true })]);
  const opp = side('bliss', [member('bliss', bliss)]);
  const battle = buildBattleFromSnapshot(self, opp, field, PRNG.generateSeed());
  const actions = enumerateLegalActions(battle, 'p1');
  const megaActions = actions.filter((a) => a.kind === 'move' && a.mega);
  console.log('  メガ付き選択肢の数:', megaActions.length);
  check('megaUsed:trueならメガ選択肢が0件', megaActions.length === 0, `count=${megaActions.length}`);
}

console.log(`\n===== メガアクションスパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
