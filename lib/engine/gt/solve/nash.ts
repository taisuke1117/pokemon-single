/**
 * 2人ゼロサム行列ゲームのナッシュ均衡（混合戦略）をフィクティシャスプレイで近似する。
 *
 * LP(javascript-lp-solver)は自由変数vの扱いや双対からの相手混合戦略取得が壊れやすいため、
 * 両者の混合戦略とゲーム値を1ループで自然に得られるフィクティシャスプレイを採用する
 * （プラン承認済みの代替。小さな行列(最大12×12)では十分高速・安定して均衡へ収束する）。
 */
import type { NashSolution } from '../types';

const ITERATIONS = 5000;

export function solveNash(matrix: number[][]): NashSolution {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return { selfMix: [], oppMix: [], value: 0 };
  if (rows === 1 && cols === 1) return { selfMix: [1], oppMix: [1], value: matrix[0][0] };

  const rowCounts = new Array(rows).fill(0);
  const colCounts = new Array(cols).fill(0);
  // 相手・自分の累積利得ベクトル
  const rowPayoff = new Array(rows).fill(0); // 各自分の手が、相手の実績分布に対して得る累積利得
  const colPayoff = new Array(cols).fill(0); // 各相手の手が、自分の実績分布に対して"自分に与える"累積利得

  // 初手: 自分は行0、相手は列0
  let lastRow = 0;
  let lastCol = 0;
  rowCounts[0]++;
  colCounts[0]++;

  for (let t = 0; t < ITERATIONS; t++) {
    // 自分の各手の利得を、相手が今打った列ぶん更新
    for (let i = 0; i < rows; i++) rowPayoff[i] += matrix[i][lastCol];
    // 相手の各手が自分に与える利得を、自分が今打った行ぶん更新
    for (let j = 0; j < cols; j++) colPayoff[j] += matrix[lastRow][j];

    // 自分は利得最大の行、相手は自分利得最小の列（相手は自分の利得を最小化）
    lastRow = argmax(rowPayoff);
    lastCol = argmin(colPayoff);
    rowCounts[lastRow]++;
    colCounts[lastCol]++;
  }

  const selfMix = normalize(rowCounts);
  const oppMix = normalize(colCounts);
  // ゲーム値 = 混合戦略同士の期待値
  let value = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) value += selfMix[i] * oppMix[j] * matrix[i][j];
  }
  return { selfMix, oppMix, value };
}

function argmax(a: number[]): number {
  let idx = 0;
  for (let i = 1; i < a.length; i++) if (a[i] > a[idx]) idx = i;
  return idx;
}
function argmin(a: number[]): number {
  let idx = 0;
  for (let i = 1; i < a.length; i++) if (a[i] < a[idx]) idx = i;
  return idx;
}
function normalize(counts: number[]): number[] {
  const sum = counts.reduce((a, b) => a + b, 0);
  return sum > 0 ? counts.map((c) => c / sum) : counts.map(() => 1 / counts.length);
}
