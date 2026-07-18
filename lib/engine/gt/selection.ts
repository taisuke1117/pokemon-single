/**
 * 選出補佐（対戦中エンジンの1つ上の階層）。
 *
 * 6匹から3匹を選ぶ「選出」レベルの利得行列を、対戦中エンジン(gt/index.ts)と同じ部品
 * （スナップショット構築・評価関数・ソルバ）で解く。新規に作るのは以下2つだけ：
 *   1. 選出の列挙（自分:全6匹からC(6,3)=20通り、相手:判明済み種族からC(n,3)通り）
 *   2. 3対3の値の見積り（先発は簡易ヒューリスティック=組内最速、盤面は対戦開始直後の
 *      静的スナップショット=全員満タンHP・ランク補正無し・フィールド無しを1回だけ評価）
 *
 * ターンを跨いだ深い先読みはしない（あくまで「選出」の判断材料。今回のスコープ外）。
 */
import type { PRNGSeed } from '@pkmn/sim';
import { buildBattleFromSnapshot, type GtSideSnapshot, type GtMember } from './bridge/build-battle';
import { toResolvedBoard } from './eval/board-snapshot';
import { evaluateBoard } from './eval/compose';
import { solveMatrix } from './solve';
import { pickPrimarySpread, spreadToCalcSpec } from '../matchup';
import { hydrateStats } from '../../data/hydrate';
import { createBattleFieldState, createBattleParticipant } from '../../types';
import type { CalcSpec, OpponentSlot, PartyMember } from '../../types';
import type { SelectionCandidate, SelectionGtRecommendation } from './types';

const PROBE_SEED = '1,2,3,4' as unknown as PRNGSeed;

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  const withFirst = combinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

function fastestOf<T>(items: T[], speedOf: (t: T) => number): T {
  return items.reduce((best, cur) => (speedOf(cur) > speedOf(best) ? cur : best));
}

/** 相手枠を代表スプレッドから CalcSpec 化する（種族が無い枠は除外）。gt/index.tsのoppToCalcと同一方針。 */
function oppToCalc(slot: OpponentSlot): CalcSpec | undefined {
  if (!slot.species) return undefined;
  const primary = pickPrimarySpread(slot);
  if (!primary) return undefined;
  return spreadToCalcSpec(slot.species, primary);
}

function oppToGtMember(slot: OpponentSlot): GtMember | undefined {
  const calc = oppToCalc(slot);
  if (!calc) return undefined;
  const moveIds = (slot.moveUsage ?? []).slice(0, 4).map((m) => m.moveId);
  return {
    refId: slot.id,
    displayName: slot.resolvedName ?? slot.query,
    calc: { ...calc, moveIds: moveIds.length ? moveIds : calc.moveIds },
    participant: createBattleParticipant(),
  };
}

/** 対戦開始直後（全員満タンHP・ランク補正無し・フィールド無し）の静的評価値。 */
function evaluateFreshMatchup(selfTrio: GtMember[], selfLeadId: string, oppTrio: GtMember[], oppLeadId: string): number {
  const self: GtSideSnapshot = { activeRefId: selfLeadId, members: selfTrio };
  const opp: GtSideSnapshot = { activeRefId: oppLeadId, members: oppTrio };
  const battle = buildBattleFromSnapshot(self, opp, createBattleFieldState(), PROBE_SEED);
  const calcByRef = new Map<string, CalcSpec>();
  for (const m of [...selfTrio, ...oppTrio]) calcByRef.set(m.refId, m.calc);
  const board = toResolvedBoard(battle, 'p1', calcByRef);
  return evaluateBoard(board);
}

export function computeSelectionRecommendation(party: PartyMember[], opponents: OpponentSlot[]): SelectionGtRecommendation {
  const notes: string[] = [];

  if (party.length < 3) {
    throw new Error('パーティが3体未満のため選出行列を計算できません');
  }
  const oppKnown = opponents.filter((o) => o.species);
  if (oppKnown.length < 3) {
    throw new Error('相手の判明済み種族が3体未満のため選出行列を計算できません');
  }

  const selfCombos = combinations(party, 3);
  const oppCombos = combinations(oppKnown, 3);

  // 相手の各組み合わせの「選ばれやすさ」= 3体の人気度(1/rank)の合計を正規化した重み。
  // 実際の選出率データは無いため、あくまで人気順位からの推定であることに注意。
  const oppRawWeights = oppCombos.map((combo) => combo.reduce((sum, s) => sum + 1 / (s.rank ?? 999), 0));
  const oppWeightSum = oppRawWeights.reduce((a, b) => a + b, 0);
  const oppWeights = oppWeightSum > 0 ? oppRawWeights.map((w) => w / oppWeightSum) : oppRawWeights.map(() => 1 / oppCombos.length);

  // 相手の実数値speedは組み合わせ間で重複するため1回だけ計算してキャッシュする
  const oppSpeedCache = new Map<string, number>();
  function oppSpeed(slot: OpponentSlot): number {
    const cached = oppSpeedCache.get(slot.id);
    if (cached !== undefined) return cached;
    const calc = oppToCalc(slot);
    const speed = calc ? hydrateStats(calc).s : 0;
    oppSpeedCache.set(slot.id, speed);
    return speed;
  }

  const selfCandidates: SelectionCandidate[] = selfCombos.map((combo) => {
    const lead = fastestOf(combo, (m) => m.stats.s);
    return { memberIds: combo.map((m) => m.id), leadId: lead.id, label: combo.map((m) => m.name).join('/') };
  });
  const oppCandidates: SelectionCandidate[] = oppCombos.map((combo) => {
    const lead = fastestOf(combo, oppSpeed);
    return { memberIds: combo.map((s) => s.id), leadId: lead.id, label: combo.map((s) => s.resolvedName ?? s.query).join('/') };
  });

  const oppGtTrios = oppCombos.map((combo) => combo.map((s) => oppToGtMember(s)).filter((m): m is GtMember => Boolean(m)));

  const matrix: number[][] = selfCombos.map((selfCombo, i) => {
    const selfTrio: GtMember[] = selfCombo.map((m) => ({
      refId: m.id,
      displayName: m.name,
      calc: m.calc,
      participant: createBattleParticipant(),
    }));
    return oppCombos.map((_, j) => {
      const oppTrio = oppGtTrios[j];
      if (oppTrio.length < 3) return 0; // 種族解決に失敗した枠を含む組み合わせ(通常起きない)は中立扱い
      return evaluateFreshMatchup(selfTrio, selfCandidates[i].leadId, oppTrio, oppCandidates[j].leadId);
    });
  });

  const solved = solveMatrix(matrix, oppWeights);

  const unresolvedOpp = opponents.length - oppKnown.length;
  if (unresolvedOpp > 0) {
    notes.push(`相手${unresolvedOpp}枠が未入力です。情報が増えるほど選出補佐の精度が上がります`);
  }
  notes.push('各選出内の先発は「その3体の中で最速の1体」という簡易ヒューリスティックで仮決めしています（実戦での最適な先発とは異なる場合があります）');
  notes.push(
    `相手の選出組み合わせは、判明済み${oppKnown.length}体からの全${oppCombos.length}通りを対象にし、各組み合わせの重みは種族の使用率順位から推定しています（実際の選出率データではないため参考値です）`,
  );
  notes.push('評価値は対戦開始直後（全員満タンHP・フィールド影響なし）の静的な盤面を1回評価したものです（ターンを跨いだ先読みはしていません）');

  return {
    selfCandidates,
    oppCandidates,
    oppWeights,
    matrix,
    nash: solved.nash,
    maximin: solved.maximin,
    bestResponse: solved.bestResponse,
    recommendedMode: solved.recommendedMode,
    notes,
  };
}
