/**
 * 排他的な問い: 「“今の対面に現れない”持続・累積の不利を相手に負わせているか」。
 *
 * 重要(重複回避): 今の対面ぶんの状態異常(まひで遅い/やけどで火力減 等)は facing-threat.ts が
 * 実効ステータス・被ダメに織り込んで計上済み。ここは控え(=今場に出ていない)個体の状態異常だけを
 * 将来価値として評価する。今場のactiveの状態異常はここでは数えない。
 *
 * 相手控えに状態異常=自分に有利(+)、自分の控えに状態異常=不利(-)。
 */
import type { ResolvedBoard, ResolvedPokemon } from '../types';
import { WEIGHTS } from './weights';

// 状態異常の将来価値の相対係数（ねむり/こおりは行動不能で重い、まひ/やけど/毒は中程度）
const STATUS_VALUE: Record<string, number> = {
  slp: 1.0,
  frz: 1.0,
  par: 0.6,
  brn: 0.6,
  tox: 0.7,
  psn: 0.4,
};

function benchStatusScore(bench: ResolvedPokemon[]): number {
  let score = 0;
  for (const mon of bench) {
    if (!mon.species || mon.hpPercent <= 0 || !mon.status) continue;
    score += STATUS_VALUE[mon.status] ?? 0.4;
  }
  return score;
}

export function evalStatusBench(board: ResolvedBoard): number {
  const oppScore = benchStatusScore(board.opp.bench);
  const selfScore = benchStatusScore(board.self.bench);
  return (oppScore - selfScore) * WEIGHTS.statusBench;
}
