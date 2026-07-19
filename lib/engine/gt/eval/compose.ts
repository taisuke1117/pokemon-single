/**
 * 評価関数 v(board) = Σ 各要素。プラスで自分有利、単位は「1体分の有利さ ≈ 1.0」。
 *
 * 各要素は「排他的な問い」に1つだけ答える純粋関数（重複監査済み。詳細は各ファイル冒頭コメント）。
 * 最小版は7要素。発展2要素(構造的な穴・情報アドバンテージ)は未実装スタブでコメントアウト中。
 */
import type { ResolvedBoard } from '../types';
import { evalTerminal } from './terminal';
import { evalSurvival } from './survival';
import { evalFacingThreat } from './facing-threat';
import { evalSafeSwitchIns } from './safe-switch-ins';
import { evalHazards } from './hazards';
import { evalStatusBench } from './status-bench';
import { evalWincon } from './wincon';
import { evalActiveVolatile } from './active-volatile';
// import { evalStructuralHoles } from './structural-holes'; // 発展: 最小版では未実装
// import { evalInfoAdvantage } from './info-advantage';     // 発展: 最小版では未実装

export interface EvalBreakdown {
  terminal: number;
  survival: number;
  facingThreat: number;
  safeSwitchIns: number;
  hazards: number;
  statusBench: number;
  wincon: number;
  activeVolatile: number;
  total: number;
}

/** 各要素の内訳込みで評価する（検算・デバッグ用）。 */
export function evaluateBreakdown(board: ResolvedBoard): EvalBreakdown {
  // 終端が確定していれば桁違いの値なので、他要素は加算しても影響しない（そのまま合算する）
  const terminal = evalTerminal(board);
  const survival = evalSurvival(board);
  const facingThreat = evalFacingThreat(board);
  const safeSwitchIns = evalSafeSwitchIns(board);
  const hazards = evalHazards(board);
  const statusBench = evalStatusBench(board);
  const wincon = evalWincon(board);
  const activeVolatile = evalActiveVolatile(board);
  const total = terminal + survival + facingThreat + safeSwitchIns + hazards + statusBench + wincon + activeVolatile;
  return { terminal, survival, facingThreat, safeSwitchIns, hazards, statusBench, wincon, activeVolatile, total };
}

/** 盤面のスカラー評価値（自分視点）。 */
export function evaluateBoard(board: ResolvedBoard): number {
  return evaluateBreakdown(board).total;
}
