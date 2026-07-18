/**
 * 相手モデルへの最適応答（搾取）。相手の列選択確率を使用率データ(EnvMoveUsage.usage)から
 * 推定し、その分布への期待値が最大の自分の手を選ぶ。当たれば一番勝てるが自分も搾取される。
 *
 * 相手分布が明確に偏っている（最頻手の確率が閾値以上）場合のみ採用する運用を index 側で行う。
 */
import type { BestResponseSolution } from '../types';

export interface BestResponseInput {
  matrix: number[][];
  /** 相手の各列（手）の選択確率。長さ=列数。正規化済みでなくてもよい（内部で正規化）。 */
  oppProbs: number[];
}

function normalize(p: number[]): number[] {
  const sum = p.reduce((a, b) => a + b, 0);
  if (sum <= 0) return p.map(() => 1 / (p.length || 1));
  return p.map((x) => x / sum);
}

export function solveBestResponse(input: BestResponseInput): BestResponseSolution {
  const probs = normalize(input.oppProbs);
  const { matrix } = input;

  // 相手の最頻手
  let oppActionIndex = 0;
  probs.forEach((p, j) => {
    if (p > probs[oppActionIndex]) oppActionIndex = j;
  });

  // 各自分の手の、相手分布に対する期待値
  let selfActionIndex = 0;
  let bestExpected = -Infinity;
  matrix.forEach((row, i) => {
    const expected = row.reduce((sum, v, j) => sum + v * probs[j], 0);
    if (expected > bestExpected) {
      bestExpected = expected;
      selfActionIndex = i;
    }
  });

  const topProb = probs[oppActionIndex] ?? 0;
  return {
    oppActionIndex,
    selfActionIndex,
    value: bestExpected,
    note: `相手の最頻手を確率${(topProb * 100).toFixed(0)}%と推定した最適応答`,
  };
}
