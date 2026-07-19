/**
 * グループC中労力: いやしのねがい(Healing Wish)/げつのひかり(Lunar Dance)が
 * 「使用者が瀕死になり、控えへ交代→その控えが全回復する」まで正しく往復するか検証する。
 */
import { applyTurn } from '../lib/engine/gt/bridge/apply-turn';
import { applyResolvedBoard } from '../lib/engine/gt/bridge/board-to-state';
import { type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
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

const jirachi: CalcSpec = { species: 'Jirachi', itemId: 'Leftovers', abilityId: 'Serene Grace', natureId: 'Timid', evs: { s: 252 }, moveIds: ['healingwish'] };
const garchomp: CalcSpec = { species: 'Garchomp', itemId: 'Leftovers', natureId: 'Jolly', evs: { h: 4 }, moveIds: ['dragonclaw'], status: 'brn' };
const wobb: CalcSpec = { species: 'Wobbuffet', itemId: 'Leftovers', abilityId: 'Shadow Tag', natureId: 'Bold', evs: { h: 252 }, moveIds: ['splash'] };

console.log('=== 1. いやしのねがい使用→使用者は瀕死、次の控えが全回復する ===');
{
  const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };
  // jirachiをHP50%・controlledで開始し、healingwish使用後に瀕死→garchompへ交代→garchompが全回復(火傷も治る)するか見る
  const self1 = side('jirachi', [
    member('jirachi', jirachi, { currentHpPercent: 30 }),
    member('garchomp', garchomp, { currentHpPercent: 40, status: 'brn' }),
  ]);
  const opp1 = side('wobb', [member('wobb', wobb)]);
  const all1 = [...self1.members, ...opp1.members];
  const res1 = applyTurn({
    self: self1, opp: opp1, field,
    calcByRef: new Map(all1.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all1.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'healingwish', switchOutToRefId: 'garchomp' },
    oppAction: { kind: 'move', moveId: 'splash' },
  });
  console.log('  ターン1ログ:', res1.log.map((l) => l.text));
  console.log('  ターン1後 self.active.refId:', res1.board.self.active.refId, 'hpPercent:', res1.board.self.active.hpPercent, 'status:', res1.board.self.active.status);

  check('使用後、場のアクティブがgarchompに切り替わっている', res1.board.self.active.refId === 'garchomp', `refId=${res1.board.self.active.refId}`);
  check('garchompのHPが全回復(100%)している', res1.board.self.active.hpPercent === 100, `hpPercent=${res1.board.self.active.hpPercent}`);
  check('garchompの火傷が治っている', !res1.board.self.active.status, `status=${res1.board.self.active.status}`);

  const state1 = emptyState(field, 'jirachi', 'wobb');
  const patch1 = applyResolvedBoard(state1, res1.board);
  console.log('  patch1.field.selfSide.switchHealMoveId:', patch1.field.selfSide.switchHealMoveId);
  check('発動後はswitchHealMoveIdが消費されundefinedに戻る', patch1.field.selfSide.switchHealMoveId === undefined, `switchHealMoveId=${patch1.field.selfSide.switchHealMoveId}`);
}

console.log(`\n===== いやしのねがいスパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
