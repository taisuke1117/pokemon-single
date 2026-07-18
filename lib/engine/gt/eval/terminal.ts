/**
 * 排他的な問い: 「もう決着したか」。
 * 勝ち=+terminalWin / 負け=−terminalWin。桁を分けて確定勝敗を他の評価点と交換させない。
 * 決着していなければ0（他要素に委ねる）。
 */
import type { ResolvedBoard } from '../types';
import { WEIGHTS } from './weights';

export function evalTerminal(board: ResolvedBoard): number {
  if (!board.ended) return 0;
  if (board.winner === 'self') return WEIGHTS.terminalWin;
  if (board.winner === 'opp') return -WEIGHTS.terminalWin;
  return 0; // 引き分け
}
