/**
 * グループC高労力→評価関数拡張へ格下げ: みらいよち/はめつのねがいが
 * 「使用ターン→1ターン後(まだ発動しない)→2ターン後(発動)」まで正しく往復するか検証する。
 */
import { applyTurn } from '../lib/engine/gt/bridge/apply-turn';
import { applyResolvedBoard } from '../lib/engine/gt/bridge/board-to-state';
import { type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import { evaluateBreakdown } from '../lib/engine/gt/eval/compose';
import { createBattleParticipant } from '../lib/types';
import type { CalcSpec, BattleParticipant, BattleFieldState, BattleState } from '../lib/types';

function part(p: Partial<BattleParticipant> = {}): BattleParticipant { return { ...createBattleParticipant(), ...p }; }
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant> = {}): GtMember { return { refId, displayName: refId, calc, participant: part(p) }; }
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot { return { activeRefId, members }; }
function sc(overrides: Partial<ReturnType<typeof scBase>> = {}) { return { ...scBase(), ...overrides }; }
function scBase() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

function emptyState(f: BattleFieldState, selfId: string, oppId: string): BattleState {
  return { turn: 1, selfActiveMemberId: selfId, oppActiveSlotId: oppId, self: {}, opponent: {}, field: f, observations: [] };
}

const jirachi: CalcSpec = { species: 'Jirachi', itemId: 'Leftovers', abilityId: 'Serene Grace', natureId: 'Timid', evs: { s: 252, c: 252 }, moveIds: ['futuresight', 'splash'] };
const wobb: CalcSpec = { species: 'Wobbuffet', itemId: 'Leftovers', abilityId: 'Shadow Tag', natureId: 'Bold', evs: { h: 252, d: 252 }, moveIds: ['splash'] };

console.log('=== 1. みらいよち使用→1ターン後は未発動→2ターン後に発動する ===');
{
  const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };
  const self1 = side('jirachi', [member('jirachi', jirachi)]);
  const opp1 = side('wobb', [member('wobb', wobb)]);
  const all1 = [...self1.members, ...opp1.members];
  const res1 = applyTurn({
    self: self1, opp: opp1, field,
    calcByRef: new Map(all1.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all1.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'futuresight' },
    oppAction: { kind: 'move', moveId: 'splash' },
  });
  console.log('  ターン1後 opp.side.futureAttackPending:', res1.board.opp.side.futureAttackPending);
  check(
    '使用直後、相手側にturnsRemaining:2で記録される',
    res1.board.opp.side.futureAttackPending?.turnsRemaining === 2 && res1.board.opp.side.futureAttackPending.moveId === 'futuresight',
    `futureAttackPending=${JSON.stringify(res1.board.opp.side.futureAttackPending)}`,
  );

  const eval1 = evaluateBreakdown(res1.board);
  console.log('  ターン1後 pendingAttack評価値:', eval1.pendingAttack);
  check('評価値に反映され、相手に発動予定なので自分にプラス', eval1.pendingAttack > 0, `pendingAttack=${eval1.pendingAttack}`);

  const state1 = emptyState(field, 'jirachi', 'wobb');
  const patch1 = applyResolvedBoard(state1, res1.board);
  console.log('  patch1.field.oppSide.futureAttackPending:', patch1.field.oppSide.futureAttackPending);

  // ターン2: turnsRemaining 2→1へデクリメントされ、まだ発動しない
  const self2 = side('jirachi', [member('jirachi', jirachi, patch1.self['jirachi'])]);
  const opp2 = side('wobb', [member('wobb', wobb, patch1.opponent['wobb'])]);
  const field2: BattleFieldState = { ...field, selfSide: patch1.field.selfSide, oppSide: patch1.field.oppSide };
  const all2 = [...self2.members, ...opp2.members];
  const res2 = applyTurn({
    self: self2, opp: opp2, field: field2,
    calcByRef: new Map(all2.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all2.map((m) => [m.refId, m.calc.species])),
    turn: 2,
    selfAction: { kind: 'move', moveId: 'splash' },
    oppAction: { kind: 'move', moveId: 'splash' },
  });
  console.log('  ターン2ログ:', res2.log.map((l) => l.text));
  console.log('  ターン2後 opp.active.hpPercent:', res2.board.opp.active.hpPercent, '(まだ発動しないので100のまま)');
  check('ターン2終了時点ではまだ発動しない(HP変化なし)', res2.board.opp.active.hpPercent === 100, `hpPercent=${res2.board.opp.active.hpPercent}`);

  const state2 = emptyState(field, 'jirachi', 'wobb');
  const patch2 = applyResolvedBoard({ ...state1, field: field2 }, res2.board);
  console.log('  patch2.field.oppSide.futureAttackPending:', patch2.field.oppSide.futureAttackPending);
  check('ターン2後、turnsRemainingが1にデクリメントされている', patch2.field.oppSide.futureAttackPending?.turnsRemaining === 1, `futureAttackPending=${JSON.stringify(patch2.field.oppSide.futureAttackPending)}`);

  // ターン3: turnsRemaining=1をsimへ注入→残留処理で発動
  const self3 = side('jirachi', [member('jirachi', jirachi, patch2.self['jirachi'])]);
  const opp3 = side('wobb', [member('wobb', wobb, patch2.opponent['wobb'])]);
  const field3: BattleFieldState = { ...field, selfSide: patch2.field.selfSide, oppSide: patch2.field.oppSide };
  const all3 = [...self3.members, ...opp3.members];
  const res3 = applyTurn({
    self: self3, opp: opp3, field: field3,
    calcByRef: new Map(all3.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all3.map((m) => [m.refId, m.calc.species])),
    turn: 3,
    selfAction: { kind: 'move', moveId: 'splash' },
    oppAction: { kind: 'move', moveId: 'splash' },
  });
  console.log('  ターン3ログ:', res3.log.map((l) => l.text));
  console.log('  ターン3後 opp.active.hpPercent:', res3.board.opp.active.hpPercent, '(発動していれば減っているはず)');
  check('ターン3で発動しダメージが入る', res3.board.opp.active.hpPercent < 100, `hpPercent=${res3.board.opp.active.hpPercent}`);

  const patch3 = applyResolvedBoard({ ...state1, field: field3 }, res3.board);
  console.log('  patch3.field.oppSide.futureAttackPending:', patch3.field.oppSide.futureAttackPending);
  check('発動後はfutureAttackPendingが消費されundefinedに戻る', patch3.field.oppSide.futureAttackPending === undefined, `futureAttackPending=${JSON.stringify(patch3.field.oppSide.futureAttackPending)}`);
}

console.log(`\n===== みらいよちスパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
