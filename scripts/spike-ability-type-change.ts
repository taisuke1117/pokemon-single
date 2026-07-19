/**
 * グループC(低労力): トレース/なりきり等の特性変化、みずびたし等のタイプ変化が
 * 次ターンへ正しく引き継がれるか検証する。
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

const porygon: CalcSpec = { species: 'Porygon2', itemId: 'Eviolite', abilityId: 'Trace', natureId: 'Bold', evs: { h: 252, b: 252 }, moveIds: ['icebeam', 'softboiled'] };
const gyarados: CalcSpec = { species: 'Gyarados', itemId: 'Leftovers', abilityId: 'Intimidate', natureId: 'Adamant', evs: { h: 252, a: 252 }, moveIds: ['waterfall'] };
const azumarill: CalcSpec = { species: 'Azumarill', itemId: 'Sitrus Berry', abilityId: 'Huge Power', natureId: 'Adamant', evs: { h: 252, a: 252 }, moveIds: ['soak', 'aquajet'] };
const garchomp: CalcSpec = { species: 'Garchomp', itemId: 'Rocky Helmet', abilityId: 'Rough Skin', natureId: 'Jolly', evs: { h: 252, b: 252 }, moveIds: ['earthquake'] };

console.log('=== 1. トレース: 相手の特性(いかく)をコピーし、次ターンへ引き継がれるか ===');
{
  const self1 = side('p2', [member('p2', porygon)]);
  const opp1 = side('gyara', [member('gyara', gyarados)]);
  const all1 = [...self1.members, ...opp1.members];
  const res1 = applyTurn({
    self: self1, opp: opp1, field,
    calcByRef: new Map(all1.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all1.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'softboiled' },
    oppAction: { kind: 'move', moveId: 'waterfall' },
  });
  console.log('  ターン1後 self.currentAbilityId:', res1.board.self.active.currentAbilityId);
  check('ターン1でトレースが発動しintimidateをコピーする', res1.board.self.active.currentAbilityId === 'Intimidate', `currentAbilityId=${res1.board.self.active.currentAbilityId}`);

  const state1 = emptyState(field, 'p2', 'gyara');
  const patch1 = applyResolvedBoard(state1, res1.board);
  console.log('  patch1.self.p2.abilityOverride:', patch1.self['p2']?.abilityOverride);
  check('BattleStateにabilityOverride=intimidateが反映される', patch1.self['p2']?.abilityOverride === 'Intimidate', `abilityOverride=${patch1.self['p2']?.abilityOverride}`);

  const self2 = side('p2', [member('p2', porygon, patch1.self['p2'])]);
  const opp2 = side('gyara', [member('gyara', gyarados, patch1.opponent['gyara'])]);
  const all2 = [...self2.members, ...opp2.members];
  const res2 = applyTurn({
    self: self2, opp: opp2, field,
    calcByRef: new Map(all2.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all2.map((m) => [m.refId, m.calc.species])),
    turn: 2,
    selfAction: { kind: 'move', moveId: 'softboiled' },
    oppAction: { kind: 'move', moveId: 'waterfall' },
  });
  console.log('  ターン2後 self.currentAbilityId:', res2.board.self.active.currentAbilityId);
  check('ターン2でもintimidateのまま引き継がれる', res2.board.self.active.currentAbilityId === 'Intimidate', `currentAbilityId=${res2.board.self.active.currentAbilityId}`);
}

console.log('\n=== 2. みずびたし: 相手をみずタイプにし、次ターンへ引き継がれるか(こおり技の4倍弱点が消える) ===');
{
  // garchomp(ドラゴン/じめん)はこおりタイプに4倍弱点。みずびたしでみずタイプ単体になれば
  // こおり技は等倍になるはず(4倍弱点の解消)。この方が「タイプが変わった」ことを明確に検証できる。
  const self1 = side('azu', [member('azu', azumarill)]);
  const opp1 = side('gaba', [member('gaba', garchomp)]);
  const all1 = [...self1.members, ...opp1.members];
  const res1 = applyTurn({
    self: self1, opp: opp1, field,
    calcByRef: new Map(all1.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all1.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'soak' },
    oppAction: { kind: 'move', moveId: 'earthquake' },
  });
  console.log('  ターン1後 opp.typesOverride:', res1.board.opp.active.typesOverride);
  check('ターン1でみずびたしが発動しWaterタイプになる', JSON.stringify(res1.board.opp.active.typesOverride) === JSON.stringify(['Water']), `typesOverride=${JSON.stringify(res1.board.opp.active.typesOverride)}`);

  const state1 = emptyState(field, 'azu', 'gaba');
  const patch1 = applyResolvedBoard(state1, res1.board);

  // ターン2(みずびたし引き継ぎあり): こおり技を撃つ
  const self2 = side('azu', [member('azu', { ...azumarill, moveIds: ['icebeam'] }, patch1.self['azu'])]);
  const opp2 = side('gaba', [member('gaba', garchomp, patch1.opponent['gaba'])]);
  const all2 = [...self2.members, ...opp2.members];
  const res2 = applyTurn({
    self: self2, opp: opp2, field,
    calcByRef: new Map(all2.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all2.map((m) => [m.refId, m.calc.species])),
    turn: 2,
    selfAction: { kind: 'move', moveId: 'icebeam' },
    oppAction: { kind: 'move', moveId: 'earthquake' },
  });
  console.log('  ターン2(みずびたし引き継ぎ)後 opp HP:', res2.board.opp.active.hpPercent);

  // 対照: みずびたし無しでこおり技を撃った場合(4倍弱点で大ダメージのはず)
  const self2b = side('azu', [member('azu', { ...azumarill, moveIds: ['icebeam'] })]);
  const opp2b = side('gaba', [member('gaba', garchomp)]);
  const all2b = [...self2b.members, ...opp2b.members];
  const res2b = applyTurn({
    self: self2b, opp: opp2b, field,
    calcByRef: new Map(all2b.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all2b.map((m) => [m.refId, m.calc.species])),
    turn: 2,
    selfAction: { kind: 'move', moveId: 'icebeam' },
    oppAction: { kind: 'move', moveId: 'earthquake' },
  });
  console.log('  対照(みずびたし無し)後 opp HP:', res2b.board.opp.active.hpPercent);
  check('みずびたし後はこおり技の4倍弱点が消え、対照より残りHPが高い', res2.board.opp.active.hpPercent > res2b.board.opp.active.hpPercent, `みずびたし引き継ぎ=${res2.board.opp.active.hpPercent}% vs 対照=${res2b.board.opp.active.hpPercent}%`);
}

console.log(`\n===== 特性・タイプ変化スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
