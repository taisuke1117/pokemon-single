/**
 * T1+T2 往復検証: buildBattleFromSnapshot(注入) → 1ターン解決 → toResolvedBoard(読み戻し) で
 * subHpPercent / disguiseBusted / itemConsumed / choiceLockedMoveId が保持・反映されるか。
 *
 * 実行: npx tsx scripts/spike-roundtrip.ts
 */
import { PRNG } from '@pkmn/sim';
import { buildBattleFromSnapshot, type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import { toResolvedBoard } from '../lib/engine/gt/eval/board-snapshot';
import { actionToChoice } from '../lib/engine/gt/legal-moves';
import { createBattleParticipant } from '../lib/types';
import type { CalcSpec, BattleParticipant, BattleFieldState } from '../lib/types';
import type { GtAction } from '../lib/engine/gt/types';

function participant(patch: Partial<BattleParticipant>): BattleParticipant {
  return { ...createBattleParticipant(), ...patch };
}
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant>): GtMember {
  return { refId, displayName: refId, calc, participant: participant(p) };
}
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot {
  return { activeRefId, members };
}
function field(): BattleFieldState {
  return { isTrickRoom: false, selfSide: emptySc(), oppSide: emptySc() };
}
function emptySc() {
  return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false };
}
function calcByRef(members: GtMember[]): Map<string, CalcSpec> {
  return new Map(members.map((m) => [m.refId, m.calc]));
}

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) {
  if (cond) pass++; else fail++;
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`);
}

const mimikyu: CalcSpec = { species: 'Mimikyu', itemId: '', abilityId: 'Disguise', natureId: 'Jolly', evs: { a: 252, s: 252 }, moveIds: ['Shadow Sneak', 'Play Rough', 'Swords Dance', 'Shadow Claw'] };
const ttar: CalcSpec = { species: 'Tyranitar', itemId: 'Choice Band', abilityId: 'Sand Stream', natureId: 'Adamant', evs: { a: 252, h: 252 }, moveIds: ['Crunch', 'Stone Edge', 'Earthquake', 'Ice Punch'] };
const pikachu: CalcSpec = { species: 'Pikachu', itemId: 'Focus Sash', abilityId: 'Static', natureId: 'Timid', evs: { c: 252, s: 252 }, moveIds: ['Thunderbolt', 'Volt Switch', 'Surf', 'Nasty Plot'] };
const blissey: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 }, moveIds: ['Seismic Toss', 'Soft-Boiled', 'Thunder Wave', 'Ice Beam'] };

// ------------------------------------------------------------------
// 1. disguiseBusted: 剥がれ済みミミッキュは本体にダメージが通り、読み戻しでも busted のまま
// ------------------------------------------------------------------
console.log('\n=== 1. 化けの皮剥がれ(disguiseBusted)の往復 ===');
{
  const selfM = [member('mimi', mimikyu, { disguiseBusted: true })];
  const oppM = [member('ttar', ttar, {})];
  const battle = buildBattleFromSnapshot(side('mimi', selfM), side('ttar', oppM), field(), PRNG.generateSeed());
  battle.choose('p1', actionToChoice({ kind: 'move', moveId: 'shadowsneak' } as GtAction));
  battle.choose('p2', actionToChoice({ kind: 'move', moveId: 'crunch' } as GtAction));
  const board = toResolvedBoard(battle, 'p1', calcByRef([...selfM, ...oppM]));
  check('剥がれ済みは本体にダメージが通る', board.self.active.hpPercent < 100, `HP=${board.self.active.hpPercent}%`);
  check('読み戻しで disguiseBusted 維持', board.self.active.disguiseBusted === true, `disguiseBusted=${board.self.active.disguiseBusted}`);

  // 対照: disguiseBusted=false のミミッキュは初回無効（HPは化けの皮ぶんしか減らない）
  const selfIntact = [member('mimi', mimikyu, {})];
  const b2 = buildBattleFromSnapshot(side('mimi', selfIntact), side('ttar', [member('ttar', ttar, {})]), field(), PRNG.generateSeed());
  b2.choose('p1', 'move shadowsneak');
  b2.choose('p2', 'move crunch');
  const board2 = toResolvedBoard(b2, 'p1', calcByRef([...selfIntact, member('ttar', ttar, {})]));
  check('無傷ミミッキュの方がHPが高い（初回無効）', board2.self.active.hpPercent > board.self.active.hpPercent, `無傷${board2.self.active.hpPercent}% vs 剥がれ${board.self.active.hpPercent}%`);
}

// ------------------------------------------------------------------
// 2. itemConsumed: タスキ消費済みは1発で瀕死になり、読み戻しで itemConsumed 反映
// ------------------------------------------------------------------
console.log('\n=== 2. タスキ消費済み(itemConsumed)の往復 ===');
{
  // 砂ダメでタスキ後に削れないよう、天候を出さない襷破壊役(いかりのまえば+高火力)を使う。
  // Choice Band Dragonite(マルチスケイル無効化のため素の攻撃)で殴る。
  const bandAttacker: CalcSpec = { species: 'Dragonite', itemId: 'Choice Band', abilityId: 'Inner Focus', natureId: 'Adamant', evs: { a: 252, h: 4, s: 252 }, moveIds: ['Extreme Speed', 'Earthquake', 'Outrage', 'Fire Punch'] };
  const selfM = [member('pika', pikachu, { itemConsumed: true })];
  const oppM = [member('dnite', bandAttacker, {})];
  const battle = buildBattleFromSnapshot(side('pika', selfM), side('dnite', oppM), field(), PRNG.generateSeed());
  battle.choose('p1', 'move thunderbolt');
  battle.choose('p2', 'move extremespeed'); // 先制で殴る
  const board = toResolvedBoard(battle, 'p1', calcByRef([...selfM, ...oppM]));
  check('タスキ消費済みは瀕死になり得る', board.self.active.hpPercent === 0, `HP=${board.self.active.hpPercent}%`);

  // 対照: タスキ健在なら1耐え（天候なし＝残留ダメなし）
  const selfSash = [member('pika', pikachu, {})];
  const oppM2 = [member('dnite', bandAttacker, {})];
  const b2 = buildBattleFromSnapshot(side('pika', selfSash), side('dnite', oppM2), field(), PRNG.generateSeed());
  b2.choose('p1', 'move thunderbolt');
  b2.choose('p2', 'move extremespeed');
  const board2 = toResolvedBoard(b2, 'p1', calcByRef([...selfSash, ...oppM2]));
  check('タスキ健在は1耐え(HP>0)し、消費済みフラグが立つ', board2.self.active.hpPercent > 0 && board2.self.active.itemConsumed === true, `HP=${board2.self.active.hpPercent}% itemConsumed=${board2.self.active.itemConsumed}`);
}

// ------------------------------------------------------------------
// 3. subHpPercent: 身代わり注入 → 攻撃を吸い、読み戻しで残HP%が出る
// ------------------------------------------------------------------
console.log('\n=== 3. 身代わり(subHpPercent)の往復 ===');
{
  const selfM = [member('bliss', blissey, { subHpPercent: 25 })];
  const oppM = [member('pika', pikachu, {})];
  const battle = buildBattleFromSnapshot(side('bliss', selfM), side('pika', oppM), field(), PRNG.generateSeed());
  battle.choose('p1', 'move softboiled');
  battle.choose('p2', 'move thunderbolt'); // 身代わりに当たる
  const board = toResolvedBoard(battle, 'p1', calcByRef([...selfM, ...oppM]));
  check('身代わりが読み戻される(subHpPercent定義)', board.self.active.subHpPercent !== undefined, `subHpPercent=${board.self.active.subHpPercent}`);
  check('本体HPは高いまま(身代わりが守る)', board.self.active.hpPercent >= 99, `本体HP=${board.self.active.hpPercent}%`);
}

// ------------------------------------------------------------------
// 4. choiceLockedMoveId: こだわり技を撃つと choicelock が立ち読み戻される
// ------------------------------------------------------------------
console.log('\n=== 4. こだわり縛り(choiceLockedMoveId)の読み戻し ===');
{
  const selfM = [member('ttar', ttar, {}), member('bliss', blissey, {})]; // Choice Band TTar
  const oppM = [member('bliss2', blissey, {})];
  const battle = buildBattleFromSnapshot(side('ttar', selfM), side('bliss2', oppM), field(), PRNG.generateSeed());
  battle.choose('p1', 'move crunch');
  battle.choose('p2', 'move softboiled');
  const board = toResolvedBoard(battle, 'p1', calcByRef([...selfM, ...oppM]));
  check('こだわり技使用後 choiceLockedMoveId が読み戻される', board.self.active.choiceLockedMoveId === 'crunch', `choiceLockedMoveId=${board.self.active.choiceLockedMoveId}`);
}

console.log(`\n===== 往復スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
