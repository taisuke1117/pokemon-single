/**
 * 【発展要素・最小版では未実装スタブ】
 * 排他的な問い: 「受けの利かない相手脅威が残っていないか」。
 * 相手の各主要脅威に安全に受かる自分のポケが0体なら大きく減点する。
 * safe-switch-ins.ts が "今の相手active" に限定するのに対し、こちらは "相手全脅威" が範囲。
 *
 * TODO(Phase 4): 相手の生存全脅威 × 自分の生存全体でのマッチアップ行列を作り、
 * 受け0体の相手脅威数に比例した減点を返す。
 */
import type { ResolvedBoard } from '../types';

export function evalStructuralHoles(_board: ResolvedBoard): number {
  return 0;
}
