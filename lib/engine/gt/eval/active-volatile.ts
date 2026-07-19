/**
 * 排他的な問い: 「今まさに場に出ている個体に、混乱/やどりぎ/かなしばり等の継続効果由来の
 * 有利・不利がかかっているか」。
 *
 * 重複回避: 状態異常(brn/par/psn/tox/slp/frz)はfacing-threat.ts(実効ステータス/被ダメに
 * 織り込み済み)・status-bench.ts(控えの将来価値)の責務。ここはそれ以外の、あくびと同根の
 * バグ対応で新たに保存・引き継ぐようになったvolatile状態(board-snapshot.ts参照)を評価する。
 * stockpileLayersは既にboosts(def/spd)へ反映済みのため二重計上を避け対象外。
 * protectStallCounterは「次にまもるが成功する確率」という将来の期待値情報で単純な
 * 有利/不利に落とし込みにくいため対象外（見送り）。
 *
 * 相手にかかっていれば自分に有利(+)、自分にかかっていれば不利(-)。
 */
import type { ResolvedBoard, ResolvedPokemon } from '../types';
import { WEIGHTS } from './weights';

/** 各効果の相対重み（facingThreat=0.4を基準にした目安。合算しても行き過ぎないよう小さめに抑える）。 */
const VOLATILE_VALUE = {
  confusion: 0.15,
  encore: 0.2,
  taunt: 0.15,
  disable: 0.1,
  leechSeed: 0.15,
  partialTrap: 0.15,
  mustRecharge: 0.25,
  minimize: 0.1,
  aquaRing: 0.1,
} as const;

function activeVolatileScore(mon: ResolvedPokemon): number {
  if (!mon.species || mon.hpPercent <= 0) return 0;
  let score = 0;
  if (mon.confusionTurns && mon.confusionTurns > 0) score += VOLATILE_VALUE.confusion;
  if (mon.encoreMoveId && mon.encoreTurns && mon.encoreTurns > 0) score += VOLATILE_VALUE.encore;
  if (mon.tauntTurns && mon.tauntTurns > 0) score += VOLATILE_VALUE.taunt;
  if (mon.disableMoveId && mon.disableTurns && mon.disableTurns > 0) score += VOLATILE_VALUE.disable;
  if (mon.leechSeedSourceSlot) score += VOLATILE_VALUE.leechSeed;
  if (mon.partialTrapTurns && mon.partialTrapTurns > 0) score += VOLATILE_VALUE.partialTrap;
  if (mon.mustRecharge) score += VOLATILE_VALUE.mustRecharge;
  if (mon.minimizeActive) score -= VOLATILE_VALUE.minimize; // 小さくなる＝回避率上昇はその個体側に有利
  if (mon.aquaRingActive) score -= VOLATILE_VALUE.aquaRing; // アクアリング＝回復はその個体側に有利
  return score;
}

export function evalActiveVolatile(board: ResolvedBoard): number {
  // 相手の不利(=自分の有利)はプラス、自分の不利はマイナス。
  // minimize/aquaRingは「その個体側の有利」なのでスコアの符号が他と逆(上で減算済み)であることに注意。
  const oppScore = activeVolatileScore(board.opp.active);
  const selfScore = activeVolatileScore(board.self.active);
  return (oppScore - selfScore) * WEIGHTS.activeVolatile;
}
