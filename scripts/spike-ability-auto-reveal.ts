/**
 * #47対応検証: いかく等の特性発動をログから検出し、revealedAbilityIdへ自動反映する
 * (advanceTurnと同じ経路=applyTurn→parseTurnLogのabilityId→自動記録ロジック)を検証する。
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

// このシナリオでは「相手が交代してきて、いかくが発動する」ケースを再現する。
const gyarados: CalcSpec = { species: 'Gyarados', itemId: 'Leftovers', abilityId: 'Intimidate', natureId: 'Adamant', evs: { h: 252, a: 252 }, moveIds: ['waterfall'] };
const bliss: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 }, moveIds: ['softboiled'] };
const ninetales: CalcSpec = { species: 'Alolan Ninetales', itemId: 'Light Clay', abilityId: 'Snow Warning', natureId: 'Timid', evs: { h: 252, s: 252 }, moveIds: ['moonblast'] };

console.log('=== 1. いかく(Intimidate): 相手が控えから交代してきて発動 → ログにabilityIdが載る ===');
{
  // いかく等のswitch-in特性は「新規に場に出た瞬間」のみ発動する。ターン1開始時点で
  // 既に場にいる個体では発動しない(それは対戦開始前のチームプレビュー通過時点で発動済みで、
  // applyTurnのlogStartより前なので拾えない=対戦開始直後の1ターン目は代表スプレッドのまま
  // 計算されるのが正しい仕様であることの実測確認でもある)。ここでは「ターン中に控えから
  // 交代してきて新規にいかくが発動する」ケースを再現する。
  const self = side('bliss', [member('bliss', bliss)]);
  const opp = side('mimi', [member('mimi', ninetales), member('gyara', gyarados)]);
  const all = [...self.members, ...opp.members];
  const res = applyTurn({
    self, opp, field,
    calcByRef: new Map(all.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'softboiled' },
    oppAction: { kind: 'switch', toRefId: 'gyara' },
  });
  console.log('  ログ:', res.log.map((l) => `${l.text}${l.abilityId ? `[abilityId=${l.abilityId}]` : ''}`));
  const abilityEvent = res.log.find((l) => l.kind === 'ability' && l.side === 'opp' && l.abilityId);
  check('opp側のログにabilityId=Intimidateが記録される', abilityEvent?.abilityId === 'Intimidate', `abilityId=${abilityEvent?.abilityId}`);
}

console.log('\n=== 2. ゆきふらし(Snow Warning): 控えから交代してきて天候発動 → weatherイベントにabilityIdが載る ===');
{
  const self = side('bliss', [member('bliss', bliss)]);
  const opp = side('gyara', [member('gyara', gyarados), member('foxy', ninetales)]);
  const all = [...self.members, ...opp.members];
  const res = applyTurn({
    self, opp, field,
    calcByRef: new Map(all.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'softboiled' },
    oppAction: { kind: 'switch', toRefId: 'foxy' },
  });
  console.log('  ログ:', res.log.map((l) => `${l.text}${l.abilityId ? `[abilityId=${l.abilityId}]` : ''}`));
  const weatherEvent = res.log.find((l) => l.kind === 'weather' && l.abilityId);
  check('weatherイベントにabilityId=Snow Warningが記録される', weatherEvent?.abilityId === 'Snow Warning', `abilityId=${weatherEvent?.abilityId}`);
  check('weatherイベントのside=oppになっている', weatherEvent?.side === 'opp', `side=${weatherEvent?.side}`);
}

console.log(`\n===== 特性自動判明スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
