/**
 * バグ修正検証: 相手が採用率データ(moveUsage、上位10件)にもrevealedMoveIdsにも
 * 含まれない技(低採用率技、TurnPanelでは全習得技から選べる)を選んだ場合、
 * buildBattleSnapshotAdaptersがそれをcalc.moveIdsへ確実に含め、applyTurnがsimに拒否されず
 * 正常にターンを解決できるか検証する。
 */
import { buildBattleSnapshotAdapters } from '../lib/engine/gt/bridge/battle-state-adapter';
import { applyTurn } from '../lib/engine/gt/bridge/apply-turn';
import { createBattleParticipant } from '../lib/types';
import type { BattleState, BattleFieldState, OpponentSlot, PartyMember, EnvMoveUsage } from '../lib/types';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

function sc() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }
const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };

// ミミッキュのmoveUsage(上位10件相当)には「まもる」を含めない構成にする
const moveUsage: EnvMoveUsage[] = [
  { move: 'じゃれつく', moveId: 'Play Rough', usage: 0.98 },
  { move: 'かげうち', moveId: 'Shadow Sneak', usage: 0.97 },
  { move: 'つるぎのまい', moveId: 'Swords Dance', usage: 0.84 },
  { move: 'シャドークロー', moveId: 'Shadow Claw', usage: 0.67 },
];

const bench: PartyMember[] = [
  {
    id: 'self1', name: 'カバルドン', types: ['Ground'], item: 'ゴツゴツメット', ability: 'すなおこし',
    nature: 'ようき', stats: { h: 215, a: 132, b: 187, c: 79, d: 93, s: 67 }, moves: ['じしん'],
    calc: { species: 'Hippowdon', itemId: 'Rocky Helmet', abilityId: 'Sand Stream', natureId: 'Careful', evs: { h: 252, b: 252 }, moveIds: ['earthquake', 'stealthrock', 'yawn', 'whirlwind'] },
  },
];

const opponents: OpponentSlot[] = [
  {
    id: 'opp1', query: 'ミミッキュ', resolvedName: 'ミミッキュ', species: 'Mimikyu', rank: 2, moveUsage, seenInBattle: true, confirmed: true,
    spreads: [{ name: '主流', prob: 1, item: 'いのちのたま', itemId: 'Life Orb', ability: 'ばけのかわ', abilityId: 'Disguise', nature: 'ようき', natureId: 'Jolly', evs: { a: 252, s: 252 } }],
  },
];

console.log('=== moveUsageに無い技(まもる)を相手が選んだ場合のturn進行 ===');
{
  const state: BattleState = {
    turn: 1,
    selfActiveMemberId: 'self1',
    oppActiveSlotId: 'opp1',
    self: { self1: createBattleParticipant() },
    opponent: { opp1: createBattleParticipant() },
    field,
    observations: [],
  };
  const oppAction = { kind: 'move' as const, moveId: 'protect' };
  const selfAction = { kind: 'move' as const, moveId: 'yawn' };

  const adapters = buildBattleSnapshotAdapters(state, bench, opponents, selfAction, oppAction);
  if (!adapters) throw new Error('adapters構築失敗');
  const oppMoveIds = adapters.opp.members.find((m) => m.refId === 'opp1')?.calc.moveIds ?? [];
  console.log('  構築されたopp.calc.moveIds:', oppMoveIds);
  check('pendingの"protect"がcalc.moveIdsに含まれる', oppMoveIds.some((m) => m.toLowerCase() === 'protect'), `moveIds=${oppMoveIds}`);

  const result = applyTurn({
    self: adapters.self, opp: adapters.opp, field,
    calcByRef: adapters.calcByRef, nameByRef: adapters.nameByRef,
    turn: state.turn,
    selfAction, oppAction,
  });
  console.log('  applyTurn warning:', result.warning);
  console.log('  ログ件数:', result.log.length);
  check('simに拒否されず正常解決される(warning無し)', result.warning === undefined, `warning=${result.warning}`);
  check('ログが記録される(空でない)', result.log.length > 0, `logLength=${result.log.length}`);
}

console.log(`\n===== 相手の低採用率技選択スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
