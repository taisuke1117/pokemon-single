/**
 * タスク#44/#46検証: 相手の技候補が採用率上位4つに固定されず、
 * 対戦中に判明した技(revealedMoveIds)が5位以下でも確定枠として反映されるか。
 * また交代候補がmaxCandidateOpponentsのデフォルト引き上げ(#45)で3体超に増えるか。
 */
import { readFileSync } from 'node:fs';
import { toID } from '@pkmn/sim';
import { computeGameTheoryRecommendation } from '../lib/engine/gt';
import { createBattleParticipant } from '../lib/types';
import type { BattleState, BattleFieldState, OpponentSlot, PartyMember, EnvMoveUsage } from '../lib/types';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

function sc() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }
const field: BattleFieldState = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };

const raw = JSON.parse(readFileSync('lib/data/generated/env-real.json', 'utf-8'));
const entries = Array.isArray(raw) ? raw : raw.default ?? raw;
const garchompEntry = entries.find((e: { species: string }) => e.species === 'Garchomp');
const moveUsage: EnvMoveUsage[] = garchompEntry.moveUsage;
const garchompSpreads = garchompEntry.spreads;

const bench: PartyMember[] = [
  {
    id: 'self1', name: 'ブリジュラス', types: ['Water'], item: 'たべのこし', ability: 'ちょすい',
    nature: 'ずぶとい', stats: { h: 200, a: 100, b: 150, c: 100, d: 150, s: 90 }, moves: ['なみのり'],
    calc: { species: 'Slowbro', itemId: 'Leftovers', abilityId: 'Regenerator', natureId: 'Bold', evs: { h: 252, b: 252 }, moveIds: ['surf'] },
  },
];

const opponents: OpponentSlot[] = [
  { id: 'opp1', query: 'ガブリアス', resolvedName: 'ガブリアス', species: 'Garchomp', rank: 1, moveUsage, spreads: garchompSpreads, seenInBattle: true, confirmed: true },
  { id: 'opp2', query: 'カイリュー', resolvedName: 'カイリュー', species: 'Dragonite', rank: 2, moveUsage, spreads: garchompSpreads },
  { id: 'opp3', query: 'ハバタクカミ', resolvedName: 'ハバタクカミ', species: 'Flutter Mane', rank: 3, moveUsage, spreads: garchompSpreads },
  { id: 'opp4', query: 'テツノカイナ', resolvedName: 'テツノカイナ', species: 'Iron Hands', rank: 4, moveUsage, spreads: garchompSpreads },
  { id: 'opp5', query: 'ミライドン', resolvedName: 'ミライドン', species: 'Miraidon', rank: 5, moveUsage, spreads: garchompSpreads },
];

console.log('=== #44/#46: revealedMoveIdsが5位以下の技でも確定枠として利得行列に反映される ===');
{
  const state: BattleState = {
    turn: 3,
    selfActiveMemberId: 'self1',
    oppActiveSlotId: 'opp1',
    self: { self1: createBattleParticipant() },
    opponent: { opp1: { ...createBattleParticipant(), revealedMoveIds: ['dragontail'] } },
    field,
    observations: [],
  };
  const rec = computeGameTheoryRecommendation({ state, bench, opponents });
  const moveLabels = rec.payoff.oppActions.filter((a) => a.action.kind === 'move').map((a) => a.label);
  console.log('  相手の技選択肢ラベル:', moveLabels);
  const moveIds = rec.payoff.oppActions.filter((a) => a.action.kind === 'move').map((a) => (a.action as { moveId: string }).moveId);
  check('採用率5位以下のドラゴンテールが確定技として含まれる', moveIds.includes('dragontail'), `moveIds=${moveIds}`);
  check('技候補は4つ(simの技スロット上限)', moveIds.length === 4, `count=${moveIds.length}`);
  check('採用率トップのじしんも含まれる(残り枠は採用率順で埋まる)', moveIds.includes('earthquake'), `moveIds=${moveIds}`);
}

console.log('\n=== #44: revealedMoveIdsが無い場合は採用率降順で4つ選ばれる(従来動作の維持) ===');
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
  const rec = computeGameTheoryRecommendation({ state, bench, opponents });
  const moveIds = rec.payoff.oppActions.filter((a) => a.action.kind === 'move').map((a) => (a.action as { moveId: string }).moveId);
  const expectedTop4 = moveUsage.slice(0, 4).map((m) => toID(m.moveId));
  console.log('  moveIds:', moveIds, ' expectedTop4:', expectedTop4);
  check('採用率上位4技と一致', JSON.stringify([...moveIds].sort()) === JSON.stringify([...expectedTop4].sort()), `moveIds=${moveIds}`);
}

console.log('\n=== #45: maxCandidateOpponentsのデフォルト引き上げで交代候補が3体を超える ===');
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
  const rec = computeGameTheoryRecommendation({ state, bench, opponents });
  const switchLabels = rec.payoff.oppActions.filter((a) => a.action.kind === 'switch').map((a) => a.label);
  console.log('  相手の交代先ラベル:', switchLabels);
  check('交代候補が3体を超える(入力済み4体の未確定枠すべて)', switchLabels.length > 3, `count=${switchLabels.length}`);
}

console.log(`\n===== 技候補拡充/交代候補拡充スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
