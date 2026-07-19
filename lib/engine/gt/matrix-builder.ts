/**
 * 利得行列の構築。自分の合法手×相手の合法手の全ペアについて期待セル値を計算する。
 * 合法手は seed非依存なので1つのBattleから列挙し、各セルはN回サンプリングで期待値を取る。
 */
import { Dex } from '@pkmn/sim';
import { buildBattleFromSnapshot, orderedMembers } from './bridge/build-battle';
import { enumerateLegalActions, isForceSwitch } from './legal-moves';
import { expectedCellValue, type SnapshotArgs, DEFAULT_SAMPLES } from './chance-sampling';
import { moveJa } from '../../data/move-ja';
import { expectedRecursiveCellValue, type RecursiveCellStats } from './recursive-cell';
import { eliminateDominatedCols, eliminateDominatedRows } from './solve/dominance';
import type { GtAction, GtActionLabel, PayoffMatrix } from './types';

/**
 * @pkmn/sim の activeRequest が返す技IDは小文字ID(例:"surgingstrikes")。
 * moveJa辞書のキーは正式表記(例:"Surging Strikes")なので、Dexで正式名に直してから日本語化する。
 */
function moveIdToJa(simMoveId: string): string {
  const move = Dex.moves.get(simMoveId);
  return move.exists ? moveJa(move.name) : moveJa(simMoveId);
}

function labelFor(action: GtAction, benchName: (i: number) => string): GtActionLabel {
  if (action.kind === 'switch') return { action, label: `交代→${benchName(action.toIndex)}` };
  let label = moveIdToJa(action.moveId);
  if (action.mega) label += '（メガ）';
  if (action.terastallize) label += '（テラス）';
  return { action, label };
}

export interface MatrixBuildOptions {
  samples?: number;
  /** 行/列の最大手数（肥大化防止）。超えたら先頭から切る。 */
  maxActions?: number;
  /** 先読み段数。1=現状(静的評価のみ、既定・完全後方互換)。2以上で子行列を再帰的に解く。 */
  depth?: number;
  /** 再帰する子ノードの行動を絞るビーム幅(自分側・相手側それぞれ上位k)。depth>=2でのみ使用。 */
  beamWidth?: number;
  /** 再帰前に支配戦略除去を適用するか(depth>=2でのみ意味を持つ)。 */
  eliminateDominated?: boolean;
  /** 深さごとのチャンスサンプル数。省略時はrecursive-cell.tsの既定減衰スケジュールを使う。 */
  samplesForDepth?: (depthRemaining: number) => number;
  /** 子ノードの行列をどのソルバの値で代表させて自分の親セルへ返すか。既定 'nash'。 */
  childSolver?: 'nash' | 'maximin';
  /** 内部再帰専用。false=このノード自身の行/列にはビームを適用しない(UI表示用のルート呼び出しが使う)。既定true。 */
  pruneOwnActions?: boolean;
}

export interface MatrixBuildResult extends PayoffMatrix {
  /** どちらかが瀕死送り出し中で通常の同時手番でない場合 true（呼び出し側で別扱い可能）。 */
  isForceSwitchContext: boolean;
  /** 実際に到達した先読み深さ(現状は常にoptions.depth、将来deadline打ち切り時の実測用に予約)。 */
  depthReached: number;
  /** resolveTurnOnceBoard呼び出し回数の累計(ベンチマーク用の目安、depth<=1では概算)。 */
  nodesEvaluated: number;
}

const DEFAULT_BEAM_WIDTH = 4;

export function buildPayoffMatrix(
  args: SnapshotArgs,
  options?: MatrixBuildOptions,
  externalStats?: RecursiveCellStats,
): MatrixBuildResult {
  const stats = externalStats ?? { nodesEvaluated: 0 };
  const depth = options?.depth ?? 1;
  const samples = options?.samples ?? DEFAULT_SAMPLES;
  const maxActions = options?.maxActions ?? 12;

  // 合法手列挙用に1つBattleをつくるだけならDEFAULTのseedで十分（列挙は乱数非依存）
  const probe = buildBattleFromSnapshot(args.self, args.opp, args.field, '1,2,3,4');
  const forceSwitchContext = isForceSwitch(probe, 'p1') || isForceSwitch(probe, 'p2');

  const selfActiveMember = args.self.members.find((m) => m.refId === args.self.activeRefId);
  const oppActiveMember = args.opp.members.find((m) => m.refId === args.opp.activeRefId);
  let selfActions = enumerateLegalActions(probe, 'p1', selfActiveMember?.participant.choiceLockedMoveId).slice(0, maxActions);
  let oppActions = enumerateLegalActions(probe, 'p2', oppActiveMember?.participant.choiceLockedMoveId).slice(0, maxActions);
  if (selfActions.length === 0) selfActions = [{ kind: 'move', moveId: 'struggle' }];
  if (oppActions.length === 0) oppActions = [{ kind: 'move', moveId: 'struggle' }];

  // enumerateLegalActionsが返すswitch.toIndexは「activeが先頭に並べ替えられた配列」上のインデックス
  // (build-battle.tsのorderedMembers参照)。args.self.members/args.opp.membersは並べ替え前の元順序なので、
  // toIndexで直接引くとactive自身を指してしまい「今場に出ている個体に交代」という誤ったラベル・重み付けになる。
  const selfOrdered = orderedMembers(args.self);
  const oppOrdered = orderedMembers(args.opp);
  const selfBenchName = (i: number) => selfOrdered[i]?.displayName ?? `控え${i + 1}`;
  const oppBenchName = (i: number) => oppOrdered[i]?.displayName ?? `控え${i + 1}`;
  const selfLabels = selfActions.map((a) => labelFor(a, selfBenchName));
  const oppLabels = oppActions.map((a) => labelFor(a, oppBenchName));

  let matrix: number[][];
  let depthReached: number;
  const pruneOwn = options?.pruneOwnActions ?? true;

  if (depth <= 1 && !pruneOwn) {
    // 完全後方互換パス(ルート呼び出しでdepth未指定、またはpruneOwnActions:false明示時)。回帰リスクなし。
    matrix = selfActions.map((sa) => oppActions.map((oa) => expectedCellValue(args, sa, oa, samples)));
    stats.nodesEvaluated += selfActions.length * oppActions.length * samples;
    depthReached = 1;
  } else {
    // ①安価な静的事前パスで行動を評価 → ②支配戦略除去 → ③pruneOwnActionsが有効ならtop-kビーム →
    // ④生き残ったペアだけ本番評価(depth>=2なら再帰、depth<=1ならexpectedCellValueで直接)し、
    // 削った行動は事前パスの静的値をそのまま残す。
    // 注意: 再帰の子ノード(pruneOwnActions:true)はdepthに関わらずこの分岐を通す必要がある。
    // そうしないと子がdepth<=1に達した時点でビームが効かず、既定samples(24)×maxActions(12)の
    // フル評価が再帰の葉ノードすべてで走り計算量が爆発する(実測で発覚・修正済み)。
    const preSamples = Math.max(2, Math.round(samples / 4));
    const preMatrix: number[][] = selfActions.map((sa) => oppActions.map((oa) => expectedCellValue(args, sa, oa, preSamples)));
    stats.nodesEvaluated += selfActions.length * oppActions.length * preSamples;

    let selfKeepIdx = selfActions.map((_, i) => i);
    let oppKeepIdx = oppActions.map((_, j) => j);
    if (options?.eliminateDominated ?? true) {
      selfKeepIdx = eliminateDominatedRows(preMatrix);
      const subMatrix = selfKeepIdx.map((i) => oppKeepIdx.map((j) => preMatrix[i][j]));
      const survivingCols = eliminateDominatedCols(subMatrix);
      oppKeepIdx = survivingCols.map((j) => oppKeepIdx[j]);
    }

    if (pruneOwn) {
      const beamWidth = options?.beamWidth ?? DEFAULT_BEAM_WIDTH;
      selfKeepIdx = topKRowsByWorstCase(selfKeepIdx, oppKeepIdx, preMatrix, beamWidth);
      oppKeepIdx = topKColsBySafety(oppKeepIdx, selfKeepIdx, preMatrix, beamWidth);
    }

    matrix = preMatrix.map((row) => [...row]);
    for (const i of selfKeepIdx) {
      for (const j of oppKeepIdx) {
        if (depth >= 2) {
          matrix[i][j] = expectedRecursiveCellValue(args, selfActions[i], oppActions[j], depth, options ?? {}, stats);
        } else {
          matrix[i][j] = expectedCellValue(args, selfActions[i], oppActions[j], samples);
          stats.nodesEvaluated += samples;
        }
      }
    }
    depthReached = depth;
  }

  // 相手の交代先がまだ選出確定していない候補(existProbability<1)の場合、そのセルは
  // 「実際にその個体を選出に含んでいる確率」で重み付けし、含まれていない場合の代替として
  // 「相手が今の場のポケモンのまま技を使った」列群の平均値とブレンドする
  // （出てくる割合をかけた上で、相手の全ポケモンが出てくる事象を計算する）。
  const existProbByRef = args.existProbByRef;
  if (existProbByRef) {
    const moveColumnIndices = oppActions.map((a, idx) => (a.kind === 'move' ? idx : -1)).filter((idx) => idx >= 0);
    oppActions.forEach((action, j) => {
      if (action.kind !== 'switch') return;
      const targetRefId = oppOrdered[action.toIndex]?.refId;
      const p = targetRefId ? existProbByRef.get(targetRefId) : undefined;
      if (p === undefined || p >= 1) return;
      matrix.forEach((row) => {
        const fallback = moveColumnIndices.length
          ? moveColumnIndices.reduce((sum, idx) => sum + row[idx], 0) / moveColumnIndices.length
          : row[j];
        row[j] = p * row[j] + (1 - p) * fallback;
      });
    });
  }

  // 相手の技のうち、判明済み(revealedMoveIds)ではなく採用率で残り枠を埋めただけの技
  // (pickOppMoveIds参照)は、その個体が実際にその技を持っている確信度が採用率程度しかない。
  // 上記の交代先ブレンドと同じ発想で、「その技を持っていなかった場合」の代替値
  // (=他の技列の平均。技を持っていなければ相手は他の技を使うはず、という近似)とブレンドする。
  // これをしないと、たまたま採用率が低い技が自分に対して極端に有効だった場合、ナッシュ均衡が
  // 「相手は確実にその技を持っている」という前提で計算され、実際には存在しないかもしれない
  // その1手にほぼ全ての確率を割り当ててしまう（合理的でない挙動、実測で報告・修正）。
  const moveExistProbMap = args.moveExistProbByRef?.get(args.opp.activeRefId);
  if (moveExistProbMap) {
    oppActions.forEach((action, j) => {
      if (action.kind !== 'move') return;
      const p = moveExistProbMap.get(action.moveId);
      if (p === undefined || p >= 1) return;
      const otherMoveIndices = oppActions
        .map((a2, j2) => (a2.kind === 'move' && j2 !== j ? j2 : -1))
        .filter((j2) => j2 >= 0);
      matrix.forEach((row) => {
        const fallback = otherMoveIndices.length
          ? otherMoveIndices.reduce((sum, j2) => sum + row[j2], 0) / otherMoveIndices.length
          : row[j];
        row[j] = p * row[j] + (1 - p) * fallback;
      });
    });
  }

  return {
    selfActions: selfLabels,
    oppActions: oppLabels,
    matrix,
    isForceSwitchContext: forceSwitchContext,
    depthReached,
    nodesEvaluated: stats.nodesEvaluated,
  };
}

/** 生き残った行動(行)の中で、生き残った相手列に対する最悪値(保証値)が高い順にk個選ぶ。 */
function topKRowsByWorstCase(rowIdx: number[], colIdx: number[], matrix: number[][], k: number): number[] {
  if (rowIdx.length <= k) return rowIdx;
  const scored = rowIdx.map((i) => ({ i, worst: colIdx.length ? Math.min(...colIdx.map((j) => matrix[i][j])) : 0 }));
  scored.sort((a, b) => b.worst - a.worst);
  return scored.slice(0, Math.max(1, k)).map((s) => s.i);
}

/** 生き残った行動(列)の中で、生き残った自分行に対する最良値(相手にとっての最悪ケース)が低い順にk個選ぶ。 */
function topKColsBySafety(colIdx: number[], rowIdx: number[], matrix: number[][], k: number): number[] {
  if (colIdx.length <= k) return colIdx;
  const scored = colIdx.map((j) => ({ j, best: rowIdx.length ? Math.max(...rowIdx.map((i) => matrix[i][j])) : 0 }));
  scored.sort((a, b) => a.best - b.best);
  return scored.slice(0, Math.max(1, k)).map((s) => s.j);
}
