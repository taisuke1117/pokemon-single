/**
 * 排他的な問い: 「相手の“今場に出ている”攻撃を、控えで安全に受けられる駒が何体いるか」。
 * 相手全脅威に対する受けの有無(構造的な穴)ではなく、"今の相手active"の最有効打に対する受けに限定する
 * （範囲で構造的な穴 structural-holes.ts と切り分ける。重複回避）。
 *
 * 各控えについて、相手activeの最大打点を受けて "余裕を持って生存する"(最大でも50%未満の被弾)かを数える。
 * 1体 ±safeSwitchInPerMon、cap体で頭打ち。自分+・相手−。
 */
import type { FieldSpec } from '../../../calc/damage';
import type { ResolvedBoard, ResolvedPokemon } from '../types';
import { WEIGHTS } from './weights';
import { findBestMove, toFieldSpec } from './calc-helpers';

const SAFE_THRESHOLD_PCT = 50; // これ未満の被弾なら「安全に受けて起点にできる」とみなす

function countSafeSwitchIns(attacker: ResolvedPokemon, bench: ResolvedPokemon[], field: FieldSpec): number {
  if (!attacker.species || attacker.hpPercent <= 0) return 0;
  let count = 0;
  for (const mon of bench) {
    if (!mon.species || mon.hpPercent <= 0) continue;
    const best = findBestMove(attacker, mon, attacker.moveIds, field);
    const worstCase = best?.result.maxPct ?? 0;
    if (worstCase < SAFE_THRESHOLD_PCT) count++;
  }
  return count;
}

export function evalSafeSwitchIns(board: ResolvedBoard): number {
  // 相手activeが自分の控えを殴る（攻撃側=opp）／自分activeが相手の控えを殴る（攻撃側=self）
  const selfSafe = Math.min(WEIGHTS.safeSwitchInCap, countSafeSwitchIns(board.opp.active, board.self.bench, toFieldSpec(board, 'opp')));
  const oppSafe = Math.min(WEIGHTS.safeSwitchInCap, countSafeSwitchIns(board.self.active, board.opp.bench, toFieldSpec(board, 'self')));
  return (selfSafe - oppSafe) * WEIGHTS.safeSwitchInPerMon;
}
