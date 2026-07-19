/**
 * 多段階先読みPhase 1: boardToSnapshotArgsの単体往復検証。
 * 「1ターン解決→boardToSnapshotArgsで次段argsに変換→再度Battle構築→状態が保持されているか」を
 * spike-state-roundtrip-2turn.tsと同じ観点(積みランク/化けの皮剥がれ/壁)でSnapshotArgs経由に
 * 置き換えて確認する。
 */
import { PRNG } from '@pkmn/sim';
import { resolveTurnOnceBoard, type SnapshotArgs } from '../lib/engine/gt/chance-sampling';
import { boardToSnapshotArgs } from '../lib/engine/gt/bridge/board-to-snapshot';
import { type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import { createBattleParticipant } from '../lib/types';
import type { CalcSpec, BattleParticipant, BattleFieldState } from '../lib/types';

function part(p: Partial<BattleParticipant> = {}): BattleParticipant { return { ...createBattleParticipant(), ...p }; }
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant> = {}): GtMember { return { refId, displayName: refId, calc, participant: part(p) }; }
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot { return { activeRefId, members }; }
function sc(overrides: Partial<ReturnType<typeof scBase>> = {}) { return { ...scBase(), ...overrides }; }
function scBase() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

console.log('=== 1. つるぎのまいの積みランクがboardToSnapshotArgs経由で次ターンへ引き継がれる ===');
{
  const gyara: CalcSpec = { species: 'Gyarados', itemId: 'Leftovers', abilityId: 'Intimidate', natureId: 'Adamant', evs: { a: 252, h: 252 }, moveIds: ['swordsdance', 'waterfall'] };
  const wobb: CalcSpec = { species: 'Wobbuffet', itemId: 'Leftovers', abilityId: 'Shadow Tag', natureId: 'Bold', evs: { h: 252 }, moveIds: ['splash'] };
  const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };
  const self1 = side('gyara', [member('gyara', gyara)]);
  const opp1 = side('wobb', [member('wobb', wobb)]);
  const args1: SnapshotArgs = {
    self: self1, opp: opp1, field,
    calcByRef: new Map([...self1.members, ...opp1.members].map((m) => [m.refId, m.calc])),
  };
  const board1 = resolveTurnOnceBoard(args1, { kind: 'move', moveId: 'swordsdance' }, { kind: 'move', moveId: 'splash' }, PRNG.generateSeed());
  console.log('  ターン1後 self.active.boosts:', board1.self.active.boosts);
  check('ターン1解決直後、つるぎのまいでa+2される', board1.self.active.boosts.a === 2, `boosts=${JSON.stringify(board1.self.active.boosts)}`);

  const args2 = boardToSnapshotArgs(board1, args1);
  console.log('  args2.self.members[0].participant.boosts:', args2.self.members[0].participant.boosts);
  check('boardToSnapshotArgs変換後もparticipant.boostsにa+2が残る', args2.self.members[0].participant.boosts.a === 2, `boosts=${JSON.stringify(args2.self.members[0].participant.boosts)}`);

  const board2 = resolveTurnOnceBoard(args2, { kind: 'move', moveId: 'waterfall' }, { kind: 'move', moveId: 'splash' }, PRNG.generateSeed());
  console.log('  ターン2解決後 self.active.boosts:', board2.self.active.boosts, 'opp.active.hpPercent:', board2.opp.active.hpPercent);
  check('再構築したBattleでもa+2が保持され、たきのぼりが強化された威力で入る', board2.self.active.boosts.a === 2 && board2.opp.active.hpPercent < 100, `boosts=${JSON.stringify(board2.self.active.boosts)}, oppHp=${board2.opp.active.hpPercent}`);
}

console.log('\n=== 2. 化けの皮の剥がれ状態がboardToSnapshotArgs経由で次ターンへ引き継がれる ===');
{
  const mimikyu: CalcSpec = { species: 'Mimikyu', itemId: 'Leftovers', abilityId: 'Disguise', natureId: 'Jolly', evs: { h: 252 }, moveIds: ['shadowclaw'] };
  const gara: CalcSpec = { species: 'Garchomp', itemId: 'Leftovers', natureId: 'Jolly', evs: { a: 252 }, moveIds: ['earthquake'] };
  const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };
  const self1 = side('mimikyu', [member('mimikyu', mimikyu)]);
  const opp1 = side('gara', [member('gara', gara)]);
  const args1: SnapshotArgs = {
    self: self1, opp: opp1, field,
    calcByRef: new Map([...self1.members, ...opp1.members].map((m) => [m.refId, m.calc])),
  };
  const board1 = resolveTurnOnceBoard(args1, { kind: 'move', moveId: 'shadowclaw' }, { kind: 'move', moveId: 'earthquake' }, PRNG.generateSeed());
  console.log('  ターン1後 self.active.disguiseBusted:', board1.self.active.disguiseBusted, 'hpPercent:', board1.self.active.hpPercent);
  // ばけのかわは「攻撃ダメージ自体は無効化するが、剥がれる瞬間に最大HPの1/8ダメージを受ける」仕様
  // (第7世代以降)なので、hpPercentは100ではなく87.5%前後(Leftovers回復で+6%され94%前後)になる。
  check('ターン1でじしんを受け化けの皮が剥がれる(1/8の代償ダメージのみ)', board1.self.active.disguiseBusted === true && board1.self.active.hpPercent > 80 && board1.self.active.hpPercent < 100, `disguiseBusted=${board1.self.active.disguiseBusted}, hp=${board1.self.active.hpPercent}`);

  const args2 = boardToSnapshotArgs(board1, args1);
  const board2 = resolveTurnOnceBoard(args2, { kind: 'move', moveId: 'shadowclaw' }, { kind: 'move', moveId: 'earthquake' }, PRNG.generateSeed());
  console.log('  ターン2解決後 self.active.hpPercent:', board2.self.active.hpPercent, '(剥がれ済み引き継ぎで本体にダメージが通るはず)');
  check('再構築後も剥がれ状態が引き継がれ、2発目で本体にダメージが通る', board2.self.active.hpPercent < 100, `hp=${board2.self.active.hpPercent}`);
}

console.log(`\n===== boardToSnapshotArgs往復スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
