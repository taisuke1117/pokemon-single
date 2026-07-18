/**
 * 排他的な問い: 「今後の“交代”で設置物によりどれだけ削れる見込みか」。
 * 盤面にあるか否かではなく、相手控え各体が交代で受ける被害の見込み。
 * 受けたあと残るか(引き先の数)とは局面で切り分ける（重複回避）。
 *
 * ステロ=相手控え各体の岩相性×被ダメ、まきびし=接地控えのみ。既存 switchin.ts のタイプ相性計算を再利用する。
 * 自陣の設置物は自分の控えに不利なので符号を反転。
 */
import { computeSpikesPercent, computeStealthRockPercent } from '../../switchin';
import type { ResolvedBoard, ResolvedPokemon, ResolvedSideConditions } from '../types';
import { WEIGHTS } from './weights';

/** ある側の設置物が、その側の控え各体に与える交代時被害%の合計（HP割合1.0=満タン基準で正規化）。 */
function hazardCostForBench(side: ResolvedSideConditions, bench: ResolvedPokemon[]): number {
  let total = 0;
  for (const mon of bench) {
    if (!mon.species || mon.hpPercent <= 0) continue;
    let pct = 0;
    if (side.isSR) pct += computeStealthRockPercent(mon.types);
    if (side.spikes > 0) pct += computeSpikesPercent(side.spikes, mon.types);
    total += pct / 100; // 1体満タン=1.0スケール
  }
  return total;
}

export function evalHazards(board: ResolvedBoard): number {
  // 相手陣の設置物 → 相手控えが削れる = 自分に有利(+)
  const oppSideCost = hazardCostForBench(board.opp.side, board.opp.bench);
  // 自陣の設置物 → 自分の控えが削れる = 自分に不利(-)
  const selfSideCost = hazardCostForBench(board.self.side, board.self.bench);
  return (oppSideCost - selfSideCost) * WEIGHTS.hazards;
}
