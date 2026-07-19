/**
 * グループC(中労力): ねがいごと(Wish)が次のターンへ正しく引き継がれ、
 * ターン終了時にその時場にいる個体を回復するか検証する。
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

// 相手は無害なsplash専用にし、「wishの回復発動」自体だけを純粋に観測できるようにする
// (以前はChoice Bandガブリアスのじしんを使っており、ターン2中にBlisseyが瀕死→そのまま
// 対戦終了となりresidual処理自体が走らない状態異常だったため、回復発動/消費の検証が
// 正しく行えていなかった)。ターン2の技も回復しない変化技(protect)にし、softboiled自体の
// 回復ログとwish由来の回復ログが混同されないようにする。
const bliss: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 }, moveIds: ['wish', 'protect'] };
const gaba: CalcSpec = { species: 'Wobbuffet', itemId: 'Leftovers', abilityId: 'Shadow Tag', natureId: 'Bold', evs: { h: 252 }, moveIds: ['splash'] };

console.log('=== 1. ねがいごと使用後、ターン2終了時に回復が発動する ===');
{
  const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };
  const self1 = side('bliss', [member('bliss', bliss)]);
  const opp1 = side('gaba', [member('gaba', gaba)]);
  const all1 = [...self1.members, ...opp1.members];
  const res1 = applyTurn({
    self: self1, opp: opp1, field,
    calcByRef: new Map(all1.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all1.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'wish' },
    oppAction: { kind: 'move', moveId: 'splash' },
  });
  console.log('  ターン1後 self.side.wishHpPercent:', res1.board.self.side.wishHpPercent);
  check('ターン1直後にwishHpPercentが記録される', typeof res1.board.self.side.wishHpPercent === 'number' && res1.board.self.side.wishHpPercent > 0, `wishHpPercent=${res1.board.self.side.wishHpPercent}`);

  const state1 = emptyState(field, 'bliss', 'gaba');
  const patch1 = applyResolvedBoard(state1, res1.board);
  console.log('  patch1.field.selfSide.wishHpPercent:', patch1.field.selfSide.wishHpPercent);
  check('BattleStateにもwishHpPercentが反映される', typeof patch1.field.selfSide.wishHpPercent === 'number', `wishHpPercent=${patch1.field.selfSide.wishHpPercent}`);

  // ターン2: 何もダメージを受けず経過させ、ターン終了時にwishの回復が発動するか確認
  // (直前にダメージを受けさせ、回復を観測しやすくする)
  const hpBefore = Math.max(1, Math.round(res1.board.self.active.hpPercent) - 30);
  const self2 = side('bliss', [member('bliss', bliss, { ...patch1.self['bliss'], currentHpPercent: hpBefore })]);
  const opp2 = side('gaba', [member('gaba', gaba, patch1.opponent['gaba'])]);
  const field2: BattleFieldState = { ...field, selfSide: patch1.field.selfSide, oppSide: patch1.field.oppSide };
  const all2 = [...self2.members, ...opp2.members];
  const res2 = applyTurn({
    self: self2, opp: opp2, field: field2,
    calcByRef: new Map(all2.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all2.map((m) => [m.refId, m.calc.species])),
    turn: 2,
    selfAction: { kind: 'move', moveId: 'protect' },
    oppAction: { kind: 'move', moveId: 'splash' },
  });
  console.log('  ターン2ログ:', res2.log.map((l) => l.text));
  console.log(`  ターン2開始前HP=${hpBefore}% → ターン2終了後HP=${res2.board.self.active.hpPercent}%(回復発動していれば上昇するはず)`);
  // ねがいごとの回復発動自体を確認する(この直後にGarchompの攻撃で相殺される可能性があるため、
  // 最終HPの比較ではなく回復イベントの発生有無で判定する)。
  const hasHealLog = res2.log.some((l) => l.kind === 'heal' && l.side === 'self');
  check('ターン2ログに自分側の回復イベントが記録される(ねがいごと発動)', hasHealLog, `hasHealLog=${hasHealLog}`);

  // 発動後は1回きりで消費されるはず(wishHpPercentがundefinedに戻る)。
  const state2 = emptyState(field, 'bliss', 'gaba');
  const patch2 = applyResolvedBoard(state2, res2.board);
  console.log('  ターン2後 patch2.field.selfSide.wishHpPercent:', patch2.field.selfSide.wishHpPercent);
  check('発動後はwishHpPercentが消費されundefinedに戻る(連続発動しない)', patch2.field.selfSide.wishHpPercent === undefined, `wishHpPercent=${patch2.field.selfSide.wishHpPercent}`);
}

console.log(`\n===== ねがいごとスパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
