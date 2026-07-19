/**
 * 排他的な問い: 「みらいよち/はめつのねがいの発動予約が、次のターン以降にどれだけの
 * 確定ダメージをもたらすか」。
 *
 * この技は「使った時点で発動が確定し、相手の以後の選択で発動の有無が変わらない」時限式の
 * 確定ペイロードであり、読み合いの対象ではない（ゲーム木探索は不要、静的な期待値の加点で十分）。
 * 相手に発動予定なら自分に有利(+)、自分に発動予定なら不利(-)。
 */
import { calcDamage } from '../../../calc/damage';
import type { ResolvedBoard, ResolvedPokemon } from '../types';
import { avgPct, toFieldSpec, toSpec } from './calc-helpers';
import { WEIGHTS } from './weights';

/** turnsRemainingに応じた割引係数（1ターン後は確度高、2ターン後は場が変わる不確実性を割引く）。 */
const DISCOUNT: Record<1 | 2, number> = { 1: 0.8, 2: 0.5 };

function findMemberByRefId(board: ResolvedBoard, side: 'self' | 'opp', refId: string): ResolvedPokemon | undefined {
  const s = side === 'self' ? board.self : board.opp;
  if (s.active.refId === refId) return s.active;
  return s.bench.find((m) => m.refId === refId);
}

/** defenderSide側が防御側(=発動予約を持つ側)として、その予約が生む期待ダメージ%(0-1)を返す。 */
function pendingAttackScore(board: ResolvedBoard, defenderSide: 'self' | 'opp'): number {
  const sc = defenderSide === 'self' ? board.self.side : board.opp.side;
  const pending = sc.futureAttackPending;
  if (!pending) return 0;
  const attackerSide: 'self' | 'opp' = defenderSide === 'self' ? 'opp' : 'self';
  const attacker = findMemberByRefId(board, attackerSide, pending.attackerRefId);
  const defender = defenderSide === 'self' ? board.self.active : board.opp.active;
  if (!attacker || !defender.species || defender.hpPercent <= 0) return 0;
  let result;
  try {
    result = calcDamage(toSpec(attacker), toSpec(defender), pending.moveId, toFieldSpec(board, attackerSide));
  } catch {
    return 0;
  }
  return (avgPct(result) / 100) * DISCOUNT[pending.turnsRemaining];
}

export function evalPendingAttack(board: ResolvedBoard): number {
  const oppScore = pendingAttackScore(board, 'opp');
  const selfScore = pendingAttackScore(board, 'self');
  return (oppScore - selfScore) * WEIGHTS.pendingAttack;
}
