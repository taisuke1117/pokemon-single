/**
 * マキシミン（安全重視）。各行(自分の手)の最悪列(相手の手)の値を見て、最悪値が最大の行を選ぶ。
 * 事故らないが保守的。依存なし。
 */
import type { MaximinSolution } from '../types';

export function solveMaximin(matrix: number[][]): MaximinSolution {
  let bestIndex = 0;
  let bestWorst = -Infinity;
  matrix.forEach((row, i) => {
    const worst = row.length ? Math.min(...row) : -Infinity;
    if (worst > bestWorst) {
      bestWorst = worst;
      bestIndex = i;
    }
  });
  return { selfActionIndex: bestIndex, value: bestWorst };
}
