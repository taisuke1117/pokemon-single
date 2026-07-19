/**
 * 多段階先読み(Phase 3)の再帰セル評価。利得行列の1セルの値を、静的評価関数の1回呼び出しの
 * 代わりに「次ターンの利得行列を再帰的に解いた値」に置き換える。
 *
 * Nash均衡値には厳密なalpha-beta pruningは理論的に使えない(行列全体を使った鞍点であり、
 * 手番制ゲーム木のmax/min再帰特有の単調性を持たないため)。ここではNash/Maximinどちらの
 * childSolverでも使える近似実装とし、厳密なalpha-beta pruning版(Maximin値には理論的に
 *正当に使える)はPhase 6で別途addする。
 */
import { PRNG } from '@pkmn/sim';
import { boardToSnapshotArgs } from './bridge/board-to-snapshot';
import { resolveTurnOnceBoard, type SnapshotArgs } from './chance-sampling';
import { buildPayoffMatrix, type MatrixBuildOptions } from './matrix-builder';
import { solveMaximin } from './solve/maximin';
import { solveNash } from './solve/nash';
import type { GtAction } from './types';

/** matrix-builder.tsのDEFAULT_BEAM_WIDTHと同値。循環import回避のためここでも独立定義する。 */
const DEFAULT_BEAM_WIDTH = 4;

/** 深さが増えるごとにサンプル数を減らす既定の減衰スケジュール。depthRemaining=再帰後に残る深さ。 */
export function defaultSamplesForDepth(depthRemaining: number): number {
  if (depthRemaining <= 1) return 6;
  if (depthRemaining === 2) return 4;
  return 2;
}

export interface RecursiveCellStats {
  /** resolveTurnOnceBoard呼び出し回数の累計(ベンチマーク用、呼び出し側が加算する)。 */
  nodesEvaluated: number;
}

/**
 * (selfAction, oppAction)のセル値を、子ノードの利得行列を再帰的に解いた値の平均として返す。
 * depth-1が0以下になる手前で呼ばれる想定はなく、buildPayoffMatrix側でdepth<=1は
 * 静的評価のコードパスに分岐するため、ここは常にdepth>=2のケースのみを扱う。
 */
export function expectedRecursiveCellValue(
  args: SnapshotArgs,
  selfAction: GtAction,
  oppAction: GtAction,
  depth: number,
  options: MatrixBuildOptions,
  stats: RecursiveCellStats,
): number {
  const n = options.samplesForDepth?.(depth - 1) ?? defaultSamplesForDepth(depth - 1);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const board = resolveTurnOnceBoard(args, selfAction, oppAction, PRNG.generateSeed());
    stats.nodesEvaluated++;
    if (board.ended) {
      // 終端は桁違いの値(evalTerminalの±10000)なので、それを直接使い再帰を打ち切る。
      sum += board.winner === 'self' ? 10000 : board.winner === 'opp' ? -10000 : 0;
      continue;
    }
    const childArgs = boardToSnapshotArgs(board, args);
    // 子ノードのsamples/maxActionsは明示的に縮小して渡す。そのまま親のoptionsを継承すると
    // 子がleafに達した時点で既定samples(24)×既定maxActions(12)のフル評価に戻ってしまい、
    // ビームで絞った意味が失われ計算量が爆発する(実測で発覚・修正済み)。
    const beamWidth = options.beamWidth ?? DEFAULT_BEAM_WIDTH;
    const child = buildPayoffMatrix(
      childArgs,
      {
        ...options,
        depth: depth - 1,
        pruneOwnActions: true,
        samples: options.samplesForDepth?.(depth - 2) ?? defaultSamplesForDepth(depth - 2),
        maxActions: Math.min(options.maxActions ?? 12, beamWidth * 2),
      },
      stats,
    );
    const solved = options.childSolver === 'maximin' ? solveMaximin(child.matrix) : solveNash(child.matrix);
    sum += solved.value;
  }
  return sum / n;
}
