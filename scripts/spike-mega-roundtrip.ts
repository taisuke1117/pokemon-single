/**
 * メガ進化の往復検証。
 * 注意: 実際のメガ進化(choose('move X mega'))は現状GT行列計算(chance-sampling経由)でのみ
 * 選択肢として列挙される。実ターン進行(apply-turn.ts の TurnActionSpec)は{kind:'move',moveId}
 * のみでmegaフラグを運べない設計（TurnPanelにもメガ化UIは無い）。運用上は
 * 「対戦中に実際にメガ進化させた後、ActivePokemonCardの『メガシンカ済み』トグルで手動反映」
 * というフローなので、ここでは「ターン1=通常攻撃（メガ化はUI外で別途トグル）」
 * 「ターン2=megaUsed:trueを引き継いで次の盤面が正しくメガ体になるか」を検証する。
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

const metagross: CalcSpec = { species: 'Metagross-Mega', itemId: 'Metagrossite', abilityId: 'Tough Claws', natureId: 'Jolly', evs: { a: 252, s: 252 }, moveIds: ['meteormash', 'zenheadbutt'] };
const bliss: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 }, moveIds: ['seismictoss', 'softboiled'] };

// ターン1: 通常攻撃（メガ化はTurnActionSpec外＝ActivePokemonCardの手動トグルで別途反映される想定）
const self1 = side('meta', [member('meta', metagross, { megaUsed: false })]);
const opp1 = side('bliss', [member('bliss', bliss)]);
const allMembers1 = [...self1.members, ...opp1.members];
const res1 = applyTurn({
  self: self1, opp: opp1, field,
  calcByRef: new Map(allMembers1.map((m) => [m.refId, m.calc])),
  nameByRef: new Map(allMembers1.map((m) => [m.refId, m.calc.species])),
  turn: 1,
  selfAction: { kind: 'move', moveId: 'meteormash' },
  oppAction: { kind: 'move', moveId: 'softboiled' },
});
console.log('=== ターン1(megaUsed:false・通常攻撃) ===');
console.log('  species:', res1.board.self.active.species, '(ベース体のままが正しい。mega化はUI外の手動トグルで管理)');
check('ターン1はベース体のまま', res1.board.self.active.species === 'Metagross', `species=${res1.board.self.active.species}`);

// ターン2: ユーザーがActivePokemonCardで「メガシンカ済み」をONにした後の状態を模す。
// megaUsed:trueとして次の盤面を構築し、正しくメガ体で計算されるか確認する（今回の修正対象）。
const self2 = side('meta', [member('meta', metagross, { megaUsed: true, currentHpPercent: res1.board.self.active.hpPercent })]);
const opp2 = side('bliss', [member('bliss', bliss, { currentHpPercent: res1.board.opp.active.hpPercent })]);
const allMembers2 = [...self2.members, ...opp2.members];
const res2 = applyTurn({
  self: self2, opp: opp2, field,
  calcByRef: new Map(allMembers2.map((m) => [m.refId, m.calc])),
  nameByRef: new Map(allMembers2.map((m) => [m.refId, m.calc.species])),
  turn: 2,
  selfAction: { kind: 'move', moveId: 'zenheadbutt' },
  oppAction: { kind: 'move', moveId: 'softboiled' },
});
console.log('\n=== ターン2(megaUsed:trueを引き継いで攻撃) ===');
console.log('  species:', res2.board.self.active.species);
check('ターン2でもメガ体のspeciesが維持される', res2.board.self.active.species === 'Metagross-Mega', `species=${res2.board.self.active.species}`);

console.log(`\n===== メガ往復スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
