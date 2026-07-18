/**
 * ダメージ計算以外の状態変化(boosts/disguiseBusted/side conditions)が、
 * applyTurn → applyResolvedBoard(BattleState反映) → 次ターンのbuildBattleFromSnapshot
 * という「真の2ターン往復」で正しく引き継がれるか検証する。
 * 既存spike-roundtrip.tsは1ターン内の読み戻しのみ検証しており、次ターンへの再注入は未検証だった。
 */
import { createBattleParticipant } from '../lib/types';
import { applyTurn } from '../lib/engine/gt/bridge/apply-turn';
import { applyResolvedBoard } from '../lib/engine/gt/bridge/board-to-state';
import { type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import type { CalcSpec, BattleParticipant, BattleFieldState, BattleState } from '../lib/types';

function part(p: Partial<BattleParticipant> = {}): BattleParticipant { return { ...createBattleParticipant(), ...p }; }
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant> = {}): GtMember { return { refId, displayName: refId, calc, participant: part(p) }; }
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot { return { activeRefId, members }; }
function sc() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

function emptyState(field: BattleFieldState, selfId: string, oppId: string): BattleState {
  return { turn: 1, selfActiveMemberId: selfId, oppActiveSlotId: oppId, self: {}, opponent: {}, field, observations: [] };
}

// ============================================================
// 1. つるぎのまい: 次ターンにboosts.a=+2が引き継がれ、ダメージ量に反映されるか
// ============================================================
console.log('=== 1. つるぎのまい(boosts)の2ターン往復 ===');
{
  const attacker: CalcSpec = { species: 'Garchomp', itemId: '', abilityId: 'Rough Skin', natureId: 'Jolly', evs: { a: 252, s: 252 }, moveIds: ['swordsdance', 'earthquake'] };
  const wall: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 }, moveIds: ['softboiled', 'seismictoss'] };
  const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };

  // ターン1: つるぎのまいを使う
  const self1 = side('gaba', [member('gaba', attacker)]);
  const opp1 = side('bliss', [member('bliss', wall)]);
  const all1 = [...self1.members, ...opp1.members];
  const res1 = applyTurn({
    self: self1, opp: opp1, field,
    calcByRef: new Map(all1.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all1.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'swordsdance' },
    oppAction: { kind: 'move', moveId: 'softboiled' },
  });
  console.log('  ターン1直後のboosts:', JSON.stringify(res1.board.self.active.boosts));
  check('ターン1直後にA+2が立つ', res1.board.self.active.boosts.a === 2, `boosts=${JSON.stringify(res1.board.self.active.boosts)}`);

  // BattleStateへ反映(実運用と同じくapplyResolvedBoard経由)
  const state1 = emptyState(field, 'gaba', 'bliss');
  const patch1 = applyResolvedBoard(state1, res1.board);
  console.log('  BattleState反映後のself.gaba.boosts:', JSON.stringify(patch1.self['gaba']?.boosts));
  check('BattleStateにもA+2が反映される', patch1.self['gaba']?.boosts.a === 2, `boosts=${JSON.stringify(patch1.self['gaba']?.boosts)}`);

  // ターン2: BattleStateから再構築し、じしんを撃つ（boosts.a=2を引き継いだ状態のはず）
  const self2 = side('gaba', [member('gaba', attacker, patch1.self['gaba'])]);
  const opp2 = side('bliss', [member('bliss', wall, patch1.opponent['bliss'])]);
  const all2 = [...self2.members, ...opp2.members];
  const res2 = applyTurn({
    self: self2, opp: opp2, field,
    calcByRef: new Map(all2.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all2.map((m) => [m.refId, m.calc.species])),
    turn: 2,
    selfAction: { kind: 'move', moveId: 'earthquake' },
    oppAction: { kind: 'move', moveId: 'softboiled' },
  });
  console.log('  ターン2(A+2引き継ぎ)でのダメージ後 相手HP%:', res2.board.opp.active.hpPercent);

  // 対照: A+2無しの場合のダメージ量と比較する
  const self2b = side('gaba', [member('gaba', attacker)]); // boosts無し
  const opp2b = side('bliss', [member('bliss', wall)]);
  const all2b = [...self2b.members, ...opp2b.members];
  const res2b = applyTurn({
    self: self2b, opp: opp2b, field,
    calcByRef: new Map(all2b.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all2b.map((m) => [m.refId, m.calc.species])),
    turn: 2,
    selfAction: { kind: 'move', moveId: 'earthquake' },
    oppAction: { kind: 'move', moveId: 'softboiled' },
  });
  console.log('  対照(boosts無し)でのダメージ後 相手HP%:', res2b.board.opp.active.hpPercent);
  // 乱数の急所/ロール次第で両方瀕死(0%)になり差が観測できないことがあるため、
  // 片方でも生存していれば「A+2の方が残りHPが低い(同等以下)」ことだけを厳密に検証する。
  const bothFainted = res2.board.opp.active.hpPercent === 0 && res2b.board.opp.active.hpPercent === 0;
  check(
    'A+2引き継ぎ時の方が大ダメージ(相手の残りHPが低い、または両者瀕死で確認不能)',
    bothFainted || res2.board.opp.active.hpPercent < res2b.board.opp.active.hpPercent,
    `A+2時=${res2.board.opp.active.hpPercent}% vs 無boosts時=${res2b.board.opp.active.hpPercent}%${bothFainted ? '(両者瀕死のため参考値)' : ''}`,
  );
}

// ============================================================
// 2. 化けの皮: 剥がれた状態が次ターンに引き継がれ、通常攻撃が素通りするか
// ============================================================
console.log('\n=== 2. 化けの皮剥がれ(disguiseBusted)の2ターン往復 ===');
{
  const mimikyu: CalcSpec = { species: 'Mimikyu', itemId: '', abilityId: 'Disguise', natureId: 'Jolly', evs: { a: 4, h: 252, s: 252 }, moveIds: ['shadowsneak', 'playrough'] };
  const ttar: CalcSpec = { species: 'Tyranitar', itemId: 'Choice Band', abilityId: 'Sand Stream', natureId: 'Adamant', evs: { a: 252, h: 252 }, moveIds: ['crunch', 'stoneedge'] };
  const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };

  // ターン1: 剥がす
  const self1 = side('mimi', [member('mimi', mimikyu)]);
  const opp1 = side('ttar', [member('ttar', ttar)]);
  const all1 = [...self1.members, ...opp1.members];
  const res1 = applyTurn({
    self: self1, opp: opp1, field,
    calcByRef: new Map(all1.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all1.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'shadowsneak' },
    oppAction: { kind: 'move', moveId: 'crunch' },
  });
  console.log('  ターン1後 disguiseBusted:', res1.board.self.active.disguiseBusted, ' HP:', res1.board.self.active.hpPercent);
  check('ターン1で化けの皮が剥がれる', res1.board.self.active.disguiseBusted === true, `disguiseBusted=${res1.board.self.active.disguiseBusted}`);

  const state1 = emptyState(field, 'mimi', 'ttar');
  const patch1 = applyResolvedBoard(state1, res1.board);
  check('BattleStateにもdisguiseBusted=true反映', patch1.self['mimi']?.disguiseBusted === true, `disguiseBusted=${patch1.self['mimi']?.disguiseBusted}`);

  // ターン2: 引き継いだ状態で再度殴られる（化けの皮の保護なしに通常ダメージが通るはず）
  const self2 = side('mimi', [member('mimi', mimikyu, patch1.self['mimi'])]);
  const opp2 = side('ttar', [member('ttar', ttar, patch1.opponent['ttar'])]);
  const all2 = [...self2.members, ...opp2.members];
  const res2 = applyTurn({
    self: self2, opp: opp2, field,
    calcByRef: new Map(all2.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all2.map((m) => [m.refId, m.calc.species])),
    turn: 2,
    selfAction: { kind: 'move', moveId: 'shadowsneak' },
    oppAction: { kind: 'move', moveId: 'stoneedge' },
  });
  console.log('  ターン2(busted引き継ぎ)後 species:', res2.board.self.active.species, ' HP:', res2.board.self.active.hpPercent);
  check('ターン2でもBustedフォルムのまま', res2.board.self.active.species === 'Mimikyu-Busted', `species=${res2.board.self.active.species}`);
  check('ターン2でまとまったダメージを受ける(保護なし)', res2.board.self.active.hpPercent < res1.board.self.active.hpPercent, `ターン1後=${res1.board.self.active.hpPercent}% ターン2後=${res2.board.self.active.hpPercent}%`);
}

// ============================================================
// 3. オーロラベール: 雪状態で使用後、次ターンにside conditionとして残り被ダメが軽減されるか
// ============================================================
console.log('\n=== 3. オーロラベール(side conditions)の2ターン往復 ===');
{
  const wallSetter: CalcSpec = { species: 'Alolan Ninetales', itemId: 'Light Clay', abilityId: 'Snow Warning', natureId: 'Timid', evs: { h: 252, s: 252 }, moveIds: ['auroraveil', 'moonblast'] };
  const attacker: CalcSpec = { species: 'Garchomp', itemId: 'Choice Band', abilityId: 'Rough Skin', natureId: 'Jolly', evs: { a: 252, s: 252 }, moveIds: ['earthquake', 'outrage'] };
  const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };

  // ターン1: 雪をアイスフェイスの特性で起こしつつオーロラベールを張る
  const self1 = side('foxy', [member('foxy', wallSetter)]);
  const opp1 = side('gaba', [member('gaba', attacker)]);
  const all1 = [...self1.members, ...opp1.members];
  const res1 = applyTurn({
    self: self1, opp: opp1, field,
    calcByRef: new Map(all1.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all1.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'auroraveil' },
    oppAction: { kind: 'move', moveId: 'earthquake' },
  });
  console.log('  ターン1後 field.weather:', res1.board.field.weather, ' self.side:', JSON.stringify(res1.board.self.side));
  check('ターン1で雪が降る(Snow Warning)', res1.board.field.weather === 'snowscape', `weather=${res1.board.field.weather}`);
  check('ターン1でオーロラベールが張られる', res1.board.self.side.isAuroraVeil === true, `isAuroraVeil=${res1.board.self.side.isAuroraVeil}`);

  const state1 = emptyState(field, 'foxy', 'gaba');
  const patch1 = applyResolvedBoard(state1, res1.board);
  console.log('  BattleState反映後 field.selfSide:', JSON.stringify(patch1.field.selfSide));
  check('BattleStateにもisAuroraVeil=true反映', patch1.field.selfSide.isAuroraVeil === true, `isAuroraVeil=${patch1.field.selfSide.isAuroraVeil}`);
  check('BattleStateにも天候(Snow)反映', patch1.field.weather === 'Snow', `weather=${patch1.field.weather}`);

  // ターン2: 引き継いだ状態で殴られる（壁があるので軽減されるはず）
  const self2 = side('foxy', [member('foxy', wallSetter, patch1.self['foxy'])]);
  const opp2 = side('gaba', [member('gaba', attacker, patch1.opponent['gaba'])]);
  const all2 = [...self2.members, ...opp2.members];
  const res2 = applyTurn({
    self: self2, opp: opp2, field: patch1.field,
    calcByRef: new Map(all2.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all2.map((m) => [m.refId, m.calc.species])),
    turn: 2,
    selfAction: { kind: 'move', moveId: 'moonblast' },
    oppAction: { kind: 'move', moveId: 'earthquake' },
  });
  console.log('  ターン2(壁引き継ぎ)後 HP:', res2.board.self.active.hpPercent, ' side:', JSON.stringify(res2.board.self.side));
  check('ターン2でも壁が持続している(isAuroraVeil)', res2.board.self.side.isAuroraVeil === true, `isAuroraVeil=${res2.board.self.side.isAuroraVeil}`);

  // 対照: 壁無しでの同ダメージ量と比較
  const self2b = side('foxy', [member('foxy', wallSetter, { currentHpPercent: patch1.self['foxy']?.currentHpPercent })]);
  const opp2b = side('gaba', [member('gaba', attacker)]);
  const all2b = [...self2b.members, ...opp2b.members];
  const res2b = applyTurn({
    self: self2b, opp: opp2b, field, // 壁無しのまっさらなfield
    calcByRef: new Map(all2b.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all2b.map((m) => [m.refId, m.calc.species])),
    turn: 2,
    selfAction: { kind: 'move', moveId: 'moonblast' },
    oppAction: { kind: 'move', moveId: 'earthquake' },
  });
  console.log('  対照(壁無し)でのHP:', res2b.board.self.active.hpPercent);
  const bothFaintedWall = res2.board.self.active.hpPercent === 0 && res2b.board.self.active.hpPercent === 0;
  check(
    '壁があるほうが被ダメージが少ない(HPが高い、または両者瀕死で確認不能)',
    bothFaintedWall || res2.board.self.active.hpPercent > res2b.board.self.active.hpPercent,
    `壁あり=${res2.board.self.active.hpPercent}% vs 壁なし=${res2b.board.self.active.hpPercent}%${bothFaintedWall ? '(両者瀕死のため参考値)' : ''}`,
  );
}

// ============================================================
// 4. BattleFieldState.weather='Snow'の明示的な注入(injectField経由)が正しく機能するか
//    (=天候IDマップのSnow側=注入方向のバグが無いか)
// ============================================================
console.log('\n=== 4. Snow天候の明示的注入(injectField)検証 ===');
{
  const iceType: CalcSpec = { species: 'Alolan Ninetales', itemId: 'Leftovers', abilityId: 'Snow Cloak', natureId: 'Timid', evs: { d: 252, h: 252 }, moveIds: ['moonblast', 'freezedry'] };
  const attacker: CalcSpec = { species: 'Garchomp', itemId: '', abilityId: 'Rough Skin', natureId: 'Jolly', evs: { c: 252, s: 252 }, moveIds: ['icebeam', 'earthquake'] };

  const snowField: BattleFieldState = { weather: 'Snow', isTrickRoom: false, selfSide: sc(), oppSide: sc() };
  const self1 = side('foxy', [member('foxy', iceType)]);
  const opp1 = side('gaba', [member('gaba', attacker)]);
  const all1 = [...self1.members, ...opp1.members];
  const res1 = applyTurn({
    self: self1, opp: opp1, field: snowField,
    calcByRef: new Map(all1.map((m) => [m.refId, m.calc])),
    nameByRef: new Map(all1.map((m) => [m.refId, m.calc.species])),
    turn: 1,
    selfAction: { kind: 'move', moveId: 'moonblast' },
    oppAction: { kind: 'move', moveId: 'icebeam' },
  });
  console.log('  BattleFieldState.weather=Snowから構築したBattleのfield.weather:', res1.board.field.weather);
  check('明示的注入したSnowが正しくsim内部(snowscape)として反映される', res1.board.field.weather === 'snowscape', `weather=${res1.board.field.weather}`);
}

console.log(`\n===== 2ターン往復スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
