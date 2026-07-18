/**
 * 行列ソルバの統合。基本はナッシュ均衡（搾取されない安全な読み合い解）、
 * 相手の手の分布が明確に偏っている場合のみ最適応答（搾取）を推奨する。
 */
import { solveNash } from './nash';
import { solveMaximin } from './maximin';
import { solveBestResponse } from './best-response';
import type { BestResponseSolution, MaximinSolution, NashSolution } from '../types';

/** 相手の最頻手がこの確率以上なら「偏っている」とみなし最適応答を推奨する。 */
const BIAS_THRESHOLD = 0.65;

export interface SolveResult {
  nash: NashSolution;
  maximin: MaximinSolution;
  bestResponse?: BestResponseSolution;
  recommendedMode: 'nash' | 'bestResponse';
}

export function solveMatrix(matrix: number[][], oppProbs?: number[]): SolveResult {
  const nash = solveNash(matrix);
  const maximin = solveMaximin(matrix);

  let bestResponse: BestResponseSolution | undefined;
  let recommendedMode: 'nash' | 'bestResponse' = 'nash';

  if (oppProbs && oppProbs.length === (matrix[0]?.length ?? 0)) {
    const sum = oppProbs.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      const normalized = oppProbs.map((p) => p / sum);
      const top = Math.max(...normalized);
      bestResponse = solveBestResponse({ matrix, oppProbs });
      if (top >= BIAS_THRESHOLD) recommendedMode = 'bestResponse';
    }
  }

  return { nash, maximin, bestResponse, recommendedMode };
}

export { solveNash, solveMaximin, solveBestResponse };
