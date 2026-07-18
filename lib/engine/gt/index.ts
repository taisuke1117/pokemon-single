/**
 * ゲーム理論エンジンの唯一の窓口。
 * 実際の対戦状態(BattleState) + 自パーティ + 相手枠から利得行列を作り、
 * ナッシュ均衡/マキシミン/最適応答で解いて GtRecommendation を返す。
 *
 * App Router(app/api/gt-matrix/route.ts)からはこの関数だけを呼ぶ。
 */
import { PRNG, toID } from '@pkmn/sim';
import { buildPayoffMatrix } from './matrix-builder';
import { solveMatrix } from './solve';
import { buildBattleFromSnapshot, type GtSideSnapshot, type GtMember } from './bridge/build-battle';
import { applyRevealed, oppToCalc } from './bridge/battle-state-adapter';
import { toResolvedBoard } from './eval/board-snapshot';
import { evaluateBreakdown, type EvalBreakdown } from './eval/compose';
import type { SnapshotArgs } from './chance-sampling';
import type { BattleState, CalcSpec, OpponentSlot, PartyMember } from '../../types';
import { createBattleParticipant } from '../../types';
import type { GtRecommendation } from './types';

export interface GtEngineInput {
  state: BattleState;
  /** 選出済み自メンバー（3体想定）。 */
  bench: PartyMember[];
  /** 相手枠（種族判明分）。 */
  opponents: OpponentSlot[];
  /** サンプル数などの調整（省略時は既定）。 */
  samples?: number;
  /** 相手の残り枠のうち、未確定候補として追加で取り込む最大数（省略時3）。 */
  maxCandidateOpponents?: number;
}

/** チャンピオンズの選出数（固定3体）。相手の「まだ判明していない残り枠」の推定に使う。 */
const TEAM_SIZE = 3;

/**
 * 相手の「まだ選出に含まれるか確定していない候補」枠に、選出に含まれている確率を割り当てる。
 * 採用率(rank)が高い(=人気)候補ほど選ばれやすいとみなし 1/rank で重み付けし、
 * 残り枠数(remaining)に正規化する。候補数が残り枠以下なら全員ほぼ確実に選出されているとみなし1にする。
 * 実際の「選出率」データは存在しないため、あくまで人気順位からの推定であることに注意
 * （厳密な統計的信頼度ではなく、行列の重み付けのための実用的な近似値）。
 */
function allocateExistProbabilities(candidates: OpponentSlot[], remaining: number): Map<string, number> {
  const map = new Map<string, number>();
  if (remaining <= 0 || candidates.length === 0) {
    for (const c of candidates) map.set(c.id, 0);
    return map;
  }
  if (candidates.length <= remaining) {
    for (const c of candidates) map.set(c.id, 1);
    return map;
  }
  const weights = candidates.map((c) => 1 / (c.rank ?? 999));
  const totalW = weights.reduce((a, b) => a + b, 0);
  candidates.forEach((c, i) => {
    const raw = totalW > 0 ? remaining * (weights[i] / totalW) : remaining / candidates.length;
    map.set(c.id, Math.min(1, raw));
  });
  return map;
}

interface BuiltGtArgs {
  args: SnapshotArgs;
  notes: string[];
  oppActiveRefId: string;
  opponents: OpponentSlot[];
}

/**
 * BattleState + 自パーティ + 相手枠から、GTエンジン各所(行列計算・現在評価値の両方)が
 * 共通して使うスナップショット(SnapshotArgs)を組み立てる。
 */
function buildGtArgs(input: GtEngineInput): BuiltGtArgs {
  const { state, bench, opponents } = input;
  const notes: string[] = [];

  // --- 自分側スナップショット ---
  const selfMembers: GtMember[] = bench.map((m) => ({
    refId: m.id,
    displayName: m.name,
    calc: m.calc,
    participant: state.self[m.id] ?? createBattleParticipant(),
  }));
  const self: GtSideSnapshot = { activeRefId: state.selfActiveMemberId, members: selfMembers };

  // --- 相手側スナップショット ---
  // 「対戦中に場に出たことが確認できている枠(seenInBattle)」は選出に含まれることが確実。
  // それ以外の、種族だけ判明している枠(スカウティング入力)は「選出に含まれているかもしれない候補」として
  // 扱い、相手の残り枠数(3-確定数)を人気順位で重み付けした確率を割り当てて行列・物量評価に反映する
  // （＝存在しないものとして無視するのではなく、出てくる割合を掛けた上で計算する）。
  const activeSlot = opponents.find((o) => o.id === state.oppActiveSlotId);
  const confirmedBench = opponents.filter((o) => o.id !== state.oppActiveSlotId && o.species && o.seenInBattle);
  const confirmedSlots = [...(activeSlot ? [activeSlot] : []), ...confirmedBench];

  const remaining = Math.max(0, TEAM_SIZE - confirmedSlots.length);
  const maxCandidates = input.maxCandidateOpponents ?? 3;
  const allCandidates = opponents
    .filter((o) => o.species && !confirmedSlots.some((c) => c.id === o.id))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const candidateSlots = allCandidates.slice(0, Math.max(maxCandidates, remaining));
  const existProbMap = allocateExistProbabilities(candidateSlots, remaining);

  const orderedSlots = [...confirmedSlots, ...candidateSlots];

  if (candidateSlots.length > 0) {
    const summary = candidateSlots
      .map((c) => `${c.resolvedName ?? c.query}(${Math.round((existProbMap.get(c.id) ?? 0) * 100)}%)`)
      .join('・');
    notes.push(
      `相手の残り${remaining}枠はまだ場に出ておらず未確定です。候補: ${summary}（人気順位からの推定確率。実際に場に出た時点で確定情報に更新されます）`,
    );
  }
  if (allCandidates.length > candidateSlots.length) {
    notes.push(
      `相手の入力済み候補が多いため、上位${candidateSlots.length}体のみ行列に含めています（残り${allCandidates.length - candidateSlots.length}体は計算対象外）`,
    );
  }

  const oppMembers: GtMember[] = [];
  const existProbByRef = new Map<string, number>();
  for (const slot of orderedSlots) {
    const rawCalc = oppToCalc(slot);
    if (!rawCalc) continue;
    // 判明済み情報（手動入力: 持ち物/特性/性格/努力値/テラスタイプ）があれば代表スプレッドより優先する
    const calc = applyRevealed(rawCalc, slot, state);
    // 相手の技は採用率上位（moveUsage）を calc.moveIds に入れる
    const moveIds = (slot.moveUsage ?? []).slice(0, 4).map((m) => m.moveId);
    oppMembers.push({
      refId: slot.id,
      displayName: slot.resolvedName ?? slot.query,
      calc: { ...calc, moveIds: moveIds.length ? moveIds : calc.moveIds },
      participant: state.opponent[slot.id] ?? createBattleParticipant(),
    });
    existProbByRef.set(slot.id, existProbMap.get(slot.id) ?? 1);
  }

  if (selfMembers.length === 0 || oppMembers.length === 0) {
    throw new Error('選出メンバーまたは相手の種族情報が不足しているため、利得行列を計算できません');
  }

  // active が members に含まれていなければ先頭に補正
  if (!oppMembers.some((m) => m.refId === state.oppActiveSlotId)) {
    // active枠に種族が無い場合は先頭を active 扱いにする
    notes.push('相手の場のポケモンの種族が未確定のため、判明している枠を基準に計算しています');
  }
  const oppActiveRefId = oppMembers.some((m) => m.refId === state.oppActiveSlotId)
    ? state.oppActiveSlotId
    : oppMembers[0].refId;
  const opp: GtSideSnapshot = { activeRefId: oppActiveRefId, members: oppMembers };

  const calcByRef = new Map<string, CalcSpec>();
  for (const m of [...selfMembers, ...oppMembers]) calcByRef.set(m.refId, m.calc);
  // 自分は常に確定済み(存在確率1)。相手は confirmed=1 / candidate=推定値 を existProbByRef に反映済み。
  for (const m of selfMembers) existProbByRef.set(m.refId, 1);

  const args: SnapshotArgs = { self, opp, field: state.field, calcByRef, existProbByRef };
  return { args, notes, oppActiveRefId, opponents };
}

/**
 * 行列計算(サンプリング)を伴わない、現在の盤面そのものの評価値。
 * どちらの手も選ばず、送り出し直後の状態をそのまま評価するだけなので高速(サンプリング無し)。
 */
export function computeCurrentEvaluation(input: GtEngineInput): { breakdown: EvalBreakdown; notes: string[] } {
  const { args, notes } = buildGtArgs(input);
  const battle = buildBattleFromSnapshot(args.self, args.opp, args.field, PRNG.generateSeed());
  const board = toResolvedBoard(battle, 'p1', args.calcByRef, args.existProbByRef);
  return { breakdown: evaluateBreakdown(board), notes };
}

export function computeGameTheoryRecommendation(input: GtEngineInput): GtRecommendation {
  const { args, notes, oppActiveRefId, opponents } = buildGtArgs(input);

  // --- 行列構築 ---
  const payoff = buildPayoffMatrix(args, { samples: input.samples });

  // --- 相手モデル（最適応答用の列分布）: 相手activeの技採用率を列に対応づける ---
  // env側moveIdは正式表記("Play Rough")、GtActionはsim小文字ID("playrough")なのでtoIDで揃える。
  const activeOppSlot = opponents.find((o) => o.id === oppActiveRefId);
  const usageByMove = new Map<string, number>();
  for (const mu of activeOppSlot?.moveUsage ?? []) usageByMove.set(toID(mu.moveId), mu.usage);
  // 交代先の重みは、その個体が実際に選出に含まれている確率(existProbByRef)でスケールする
  // （未確定候補ほど「相手が本当にそこへ交代できる」可能性は低いとみなす）。
  const oppProbs = payoff.oppActions.map((a) => {
    if (a.action.kind === 'move') return usageByMove.get(toID(a.action.moveId)) ?? 0.05;
    const targetRefId = args.opp.members[a.action.toIndex]?.refId;
    const existProb = targetRefId ? args.existProbByRef?.get(targetRefId) ?? 1 : 1;
    return 0.1 * existProb; // 交代のベースライン × 存在確率
  });

  const solved = solveMatrix(payoff.matrix, oppProbs);

  notes.push('メガシンカとテラスタルは同一ターンに併用不可として計算しています（@pkmn/simの仕様。チャンピオンズ実ルールとの整合は要確認）');

  return {
    payoff: { selfActions: payoff.selfActions, oppActions: payoff.oppActions, matrix: payoff.matrix },
    nash: solved.nash,
    maximin: solved.maximin,
    bestResponse: solved.bestResponse,
    recommendedMode: solved.recommendedMode,
    notes,
  };
}
