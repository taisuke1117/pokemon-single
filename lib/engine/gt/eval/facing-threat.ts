/**
 * 排他的な問い: 「今まさに場に出ている2体同士の殴り合いは、次の1手でどちらが有利か」。
 * のみに答える。控えの状態異常や設置物の将来コストはここでは扱わない
 * （それぞれ status-bench.ts / hazards.ts / safe-switch-ins.ts の責務。重複回避）。
 *
 * 速さは相対＋補正込み（ランク・まひはeffectiveSpeedが反映、トリックルームはここで反転）。
 * 確定KOを取れる側が先攻なら決定的（±1）。それ以外は与ダメ%差＋先攻ボーナスで連続評価。
 */
import type { ResolvedBoard, ResolvedPokemon } from '../types';
import { WEIGHTS } from './weights';
import { avgPct, effectiveSpeed, findBestMove, toFieldSpec } from './calc-helpers';

/** self視点で self の active が先に動くか（トリックルーム反転込み）。同速はundefined。 */
function selfMovesFirst(self: ResolvedPokemon, opp: ResolvedPokemon, trickRoom: boolean): boolean | undefined {
  const s = effectiveSpeed(self);
  const o = effectiveSpeed(opp);
  if (s === o) return undefined;
  const faster = s > o;
  return trickRoom ? !faster : faster;
}

export function evalFacingThreat(board: ResolvedBoard): number {
  const self = board.self.active;
  const opp = board.opp.active;
  if (!self.species || !opp.species || self.hpPercent <= 0 || opp.hpPercent <= 0) return 0;

  const selfBest = findBestMove(self, opp, self.moveIds, toFieldSpec(board, 'self'));
  const oppBest = findBestMove(opp, self, opp.moveIds, toFieldSpec(board, 'opp'));
  // 連続評価は期待ロール(min〜maxの中央)、KO判定は上振れ(maxPct>=100)で見る。
  const selfDmg = selfBest ? avgPct(selfBest.result) : 0;
  const oppDmg = oppBest ? avgPct(oppBest.result) : 0;
  const selfCanKO = (selfBest?.result.maxPct ?? 0) >= 100;
  const oppCanKO = (oppBest?.result.maxPct ?? 0) >= 100;

  const first = selfMovesFirst(self, opp, board.field.isTrickRoom);

  // KOを取れる側が先攻なら決定的
  if (first === true && selfCanKO) return WEIGHTS.facingThreat;
  if (first === false && oppCanKO) return -WEIGHTS.facingThreat;

  const selfEff = Math.min(selfDmg, 100) / 100;
  const oppEff = Math.min(oppDmg, 100) / 100;
  const firstBonus = first === true ? 0.15 : first === false ? -0.15 : 0;
  const raw = Math.max(-1, Math.min(1, selfEff - oppEff + firstBonus));
  return raw * WEIGHTS.facingThreat;
}
