/**
 * あくび(Yawn)の2ターン往復検証。
 * @pkmn/simでのyawnはvolatileStatus(duration:2)で、そのターン終了時のupkeepでduration 2→1、
 * さらに次のターン終了時にduration 1→0となりtrySetStatus('slp')が発火する
 * (2ターン後=「あくびを受けた次のターンの終わり」に眠る、が正しい仕様)。
 * GTエンジンは毎ターンBattleを作り直す設計なので、このvolatile状態をBattleStateへ保存し
 * 次ターンのBattle構築時に再注入しないと、あくびの効果自体が次ターンで消えてしまう。
 * yawnActiveフィールドの追加でこれを修正した後の往復を、applyTurn+applyResolvedBoardという
 * 実運用と同じ経路で検証する。
 */
import { applyTurn } from '../lib/engine/gt/bridge/apply-turn';
import { applyResolvedBoard } from '../lib/engine/gt/bridge/board-to-state';
import { type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import { createBattleParticipant } from '../lib/types';
import type { CalcSpec, BattleParticipant, BattleFieldState, BattleState } from '../lib/types';

function part(p: Partial<BattleParticipant> = {}): BattleParticipant { return { ...createBattleParticipant(), ...p }; }
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant> = {}): GtMember { return { refId, displayName: refId, calc, participant: part(p) }; }
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot { return { activeRefId, members }; }
function sc() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }
const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

function emptyState(f: BattleFieldState, selfId: string, oppId: string): BattleState {
  return { turn: 1, selfActiveMemberId: selfId, oppActiveSlotId: oppId, self: {}, opponent: {}, field: f, observations: [] };
}

const hippo: CalcSpec = { species: 'Hippowdon', itemId: 'Rocky Helmet', abilityId: 'Sand Stream', natureId: 'Careful', evs: { h: 252, d: 252 }, moveIds: ['yawn', 'earthquake'] };
const mimikyu: CalcSpec = { species: 'Mimikyu', itemId: 'Life Orb', abilityId: 'Disguise', natureId: 'Jolly', evs: { a: 252, s: 252 }, moveIds: ['playrough', 'shadowsneak'] };

console.log('=== あくび使用(ターン1) → BattleStateへ反映 → 次ターン(applyTurn再構築)で眠りになるか ===');
{
  // ターン1: あくびを当てる
  const self1 = side('hippo', [member('hippo', hippo)]);
  const opp1 = side('mimi', [member('mimi', mimikyu)]);
  const all1 = [...self1.members, ...opp1.members];
  const res1 = applyTurn({
    self: self1, opp: opp1, field,
    calcByRef: new Map(all1.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all1.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'yawn' },
    oppAction: { kind: 'move', moveId: 'shadowsneak' },
  });
  console.log('  ターン1直後 opp.status:', res1.board.opp.active.status, ' yawnActive:', res1.board.opp.active.yawnActive);
  check('ターン1直後は眠らない(仕様通り)', res1.board.opp.active.status === undefined, `status=${res1.board.opp.active.status}`);
  check('ターン1直後にyawnActiveが立つ', res1.board.opp.active.yawnActive === true, `yawnActive=${res1.board.opp.active.yawnActive}`);

  const state1 = emptyState(field, 'hippo', 'mimi');
  const patch1 = applyResolvedBoard(state1, res1.board);
  console.log('  BattleState反映後 opponent.mimi.yawnActive:', patch1.opponent['mimi']?.yawnActive);
  check('BattleStateにもyawnActive=true反映', patch1.opponent['mimi']?.yawnActive === true, `yawnActive=${patch1.opponent['mimi']?.yawnActive}`);

  // ターン2: BattleStateから再構築(実運用のadvanceTurnと同じ経路)し、何もせず経過させる
  const self2 = side('hippo', [member('hippo', hippo, patch1.self['hippo'])]);
  const opp2 = side('mimi', [member('mimi', mimikyu, patch1.opponent['mimi'])]);
  const all2 = [...self2.members, ...opp2.members];
  const res2 = applyTurn({
    self: self2, opp: opp2, field,
    calcByRef: new Map(all2.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all2.map((m) => [m.refId, m.calc.species])),
    turn: 2,
    selfAction: { kind: 'move', moveId: 'earthquake' },
    oppAction: { kind: 'move', moveId: 'shadowsneak' },
  });
  console.log('  ターン2終了後 opp.status:', res2.board.opp.active.status);
  check('【修正確認】ターン2の終わりに正しく眠りになる', res2.board.opp.active.status === 'slp', `status=${res2.board.opp.active.status}`);
}

console.log('\n=== 対照: あくびを使わなければ眠らない(過剰反応チェック) ===');
{
  const self1 = side('hippo', [member('hippo', hippo)]);
  const opp1 = side('mimi', [member('mimi', mimikyu)]);
  const all1 = [...self1.members, ...opp1.members];
  const res1 = applyTurn({
    self: self1, opp: opp1, field,
    calcByRef: new Map(all1.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all1.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'earthquake' },
    oppAction: { kind: 'move', moveId: 'shadowsneak' },
  });
  const state1 = emptyState(field, 'hippo', 'mimi');
  const patch1 = applyResolvedBoard(state1, res1.board);
  const self2 = side('hippo', [member('hippo', hippo, patch1.self['hippo'])]);
  const opp2 = side('mimi', [member('mimi', mimikyu, patch1.opponent['mimi'])]);
  const all2 = [...self2.members, ...opp2.members];
  const res2 = applyTurn({
    self: self2, opp: opp2, field,
    calcByRef: new Map(all2.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all2.map((m) => [m.refId, m.calc.species])),
    turn: 2,
    selfAction: { kind: 'move', moveId: 'earthquake' },
    oppAction: { kind: 'move', moveId: 'shadowsneak' },
  });
  check('あくび未使用なら眠らない', res2.board.opp.active.status === undefined, `status=${res2.board.opp.active.status}`);
}

console.log(`\n===== あくび2ターン往復スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
