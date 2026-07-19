/**
 * 支配戦略除去（多段階先読みPhase 2）。狭義優越された行/列を反復除去する。
 * 理論的にほぼ無損失（狭義優越の除去は均衡の支持集合を変えない）ため、Nash系統の
 * 近似の中で最優先で使う前処理。行(自分の手)は値が大きいほど良い、列(相手の手)は
 * 値が小さいほど相手にとって良い(=自分への被害が小さい)という向きの違いに注意。
 */

/** targetの全要素がbyの対応要素より小さい(=byが常に自分にとって良い)なら、targetは狭義優越される。 */
function rowDominatedBy(target: number[], by: number[]): boolean {
  return target.every((v, j) => v < by[j]);
}

/** targetの全要素がbyの対応要素より大きい(=byが常に相手への被害を小さくする)なら、targetは狭義優越される。 */
function colDominatedBy(target: number[], by: number[]): boolean {
  return target.every((v, i) => v > by[i]);
}

/** 狭義優越された行を反復除去し、生き残った行インデックスを返す(元のmatrix基準の絶対index)。 */
export function eliminateDominatedRows(matrix: number[][]): number[] {
  let alive = matrix.map((_, i) => i);
  let changed = true;
  while (changed && alive.length > 1) {
    changed = false;
    for (const i of alive) {
      const dominator = alive.find((k) => k !== i && rowDominatedBy(matrix[i], matrix[k]));
      if (dominator !== undefined) {
        alive = alive.filter((idx) => idx !== i);
        changed = true;
        break;
      }
    }
  }
  return alive;
}

/** 狭義優越された列を反復除去し、生き残った列インデックスを返す(元のmatrix基準の絶対index)。 */
export function eliminateDominatedCols(matrix: number[][]): number[] {
  if (matrix.length === 0 || matrix[0].length === 0) return matrix[0] ? matrix[0].map((_, j) => j) : [];
  const numCols = matrix[0].length;
  const col = (j: number): number[] => matrix.map((row) => row[j]);
  let alive = Array.from({ length: numCols }, (_, j) => j);
  let changed = true;
  while (changed && alive.length > 1) {
    changed = false;
    for (const j of alive) {
      const dominator = alive.find((k) => k !== j && colDominatedBy(col(j), col(k)));
      if (dominator !== undefined) {
        alive = alive.filter((idx) => idx !== j);
        changed = true;
        break;
      }
    }
  }
  return alive;
}
