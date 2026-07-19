/**
 * グループB: selfSwitch技(ボルトチェンジ/とんぼがえり等)を使った場合、交代自体が
 * 正しく完了するか検証する。
 */
import { applyTurn } from '../lib/engine/gt/bridge/apply-turn';
import { type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import { createBattleParticipant } from '../lib/types';
import type { CalcSpec, BattleParticipant, BattleFieldState } from '../lib/types';

function part(p: Partial<BattleParticipant> = {}): BattleParticipant { return { ...createBattleParticipant(), ...p }; }
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant> = {}): GtMember { return { refId, displayName: refId, calc, participant: part(p) }; }
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot { return { activeRefId, members }; }
function sc() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }
const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

const rotom: CalcSpec = { species: 'Rotom-Wash', itemId: 'Leftovers', abilityId: 'Levitate', natureId: 'Bold', evs: { h: 252, b: 252 }, moveIds: ['voltswitch', 'hydropump'] };
const garchomp: CalcSpec = { species: 'Garchomp', itemId: 'Rocky Helmet', abilityId: 'Rough Skin', natureId: 'Jolly', evs: { h: 252, b: 252 }, moveIds: ['earthquake', 'dragontail'] };
const bliss: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 }, moveIds: ['softboiled'] };
const mimikyu: CalcSpec = { species: 'Mimikyu', itemId: '', abilityId: 'Disguise', natureId: 'Jolly', evs: {}, moveIds: ['shadowsneak'] };

console.log('=== 1. switchOutToRefId指定ありで、ボルトチェンジ使用後に指定した控えへ交代する ===');
{
  const self = side('rotom', [member('rotom', rotom), member('gaba', garchomp), member('bliss', bliss)]);
  const opp = side('mimi', [member('mimi', mimikyu)]);
  const all = [...self.members, ...opp.members];
  const res = applyTurn({
    self, opp, field,
    calcByRef: new Map(all.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'voltswitch', switchOutToRefId: 'gaba' },
    oppAction: { kind: 'move', moveId: 'shadowsneak' },
  });
  console.log('  warning:', res.warning);
  console.log('  board.self.active.species:', res.board.self.active.species, ' refId:', res.board.self.active.refId);
  console.log('  ログ:', res.log.map((l) => l.text));
  check('warningが出ない', res.warning === undefined, `warning=${res.warning}`);
  check('指定した控え(ガブリアス)に交代が完了している', res.board.self.active.refId === 'gaba', `refId=${res.board.self.active.refId}`);
}

console.log('\n=== 2. switchOutToRefId未指定でも、フォールバックで自動的にどれかへ交代し警告なく完結する ===');
{
  const self = side('rotom', [member('rotom', rotom), member('gaba', garchomp), member('bliss', bliss)]);
  const opp = side('mimi', [member('mimi', mimikyu)]);
  const all = [...self.members, ...opp.members];
  const res = applyTurn({
    self, opp, field,
    calcByRef: new Map(all.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'voltswitch' },
    oppAction: { kind: 'move', moveId: 'shadowsneak' },
  });
  console.log('  warning:', res.warning);
  console.log('  board.self.active.refId:', res.board.self.active.refId, '(rotomのままでないことを期待)');
  check('warningが出ない(フォールバックで自動解決)', res.warning === undefined, `warning=${res.warning}`);
  check('交代が完了している(rotomのままでない)', res.board.self.active.refId !== 'rotom', `refId=${res.board.self.active.refId}`);
}

console.log('\n=== 3. 相手側がボルトチェンジ的な技を使った場合も同様に交代が完了する ===');
{
  // じめん単タイプのガブリアスにでんき技(voltswitch)は無効化されるため(テストミス)、
  // 無効化されない相手(みずタイプ)に変更する。
  const azumarill: CalcSpec = { species: 'Azumarill', itemId: 'Sitrus Berry', abilityId: 'Huge Power', natureId: 'Adamant', evs: { h: 252 }, moveIds: ['aquajet'] };
  const self = side('azu', [member('azu', azumarill)]);
  const opp = side('rotom2', [member('rotom2', rotom), member('bliss2', bliss)]);
  const all = [...self.members, ...opp.members];
  const res = applyTurn({
    self, opp, field,
    calcByRef: new Map(all.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'aquajet' },
    oppAction: { kind: 'move', moveId: 'voltswitch', switchOutToRefId: 'bliss2' },
  });
  console.log('  warning:', res.warning);
  console.log('  ログ:', res.log.map((l) => l.text));
  console.log('  board.opp.active.refId:', res.board.opp.active.refId);
  check('相手側もwarning無し', res.warning === undefined, `warning=${res.warning}`);
  check('相手側も指定した控えに交代完了', res.board.opp.active.refId === 'bliss2', `refId=${res.board.opp.active.refId}`);
}

console.log('\n=== 4. 通常の技(selfSwitchでない)には影響しない(退行確認) ===');
{
  const self = side('rotom', [member('rotom', rotom), member('gaba', garchomp)]);
  const opp = side('mimi', [member('mimi', mimikyu)]);
  const all = [...self.members, ...opp.members];
  const res = applyTurn({
    self, opp, field,
    calcByRef: new Map(all.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'hydropump' },
    oppAction: { kind: 'move', moveId: 'shadowsneak' },
  });
  check('通常技では交代が発生しない(rotomのまま)', res.board.self.active.refId === 'rotom', `refId=${res.board.self.active.refId}`);
  check('warningも出ない', res.warning === undefined, `warning=${res.warning}`);
}

console.log(`\n===== selfSwitch技修正スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
