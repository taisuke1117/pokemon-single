/**
 * 排他的な問い: 「物量でどちらが上か」。
 * 各ポケモン: 気絶=0 / 生存=survivalPerMon(1.0) + HP割合ボーナス(満タンで+1.0)。
 * 自分+・相手−。HPは逓減（満タン→8割の差より2割→0を重く）＝sqrtで凹関数にする。
 * 瀕死寸前(HP<=極小)は「死に票」として割引く。
 *
 * 相手の選出がまだ全て確定していない場合、判明していない残り枠は「存在しない」のではなく
 * 「まだ判明していないだけで生存している可能性が高い」。existProbability(0-1、未確定候補は
 * 使用率から推定した値、確定個体は1)を乗じることで、過小評価も過大評価も避ける。
 *
 * 重複回避: ここは純粋な物量のみ。今の対面の殴り合い有利は facing-threat.ts の責務。
 */
import type { ResolvedBoard, ResolvedPokemon } from '../types';
import { WEIGHTS } from './weights';

function monValue(mon: ResolvedPokemon): number {
  if (mon.hpPercent <= 0 || !mon.species) return 0;
  const frac = mon.hpPercent / 100;
  // HPは逓減: sqrtで満タン付近の差を圧縮し、低HP付近の差を強調する
  let hpBonus = WEIGHTS.survivalHpFull * Math.sqrt(frac);
  // 瀕死寸前(<=6%)は死に票として割引
  if (mon.hpPercent <= 6) hpBonus *= 0.4;
  return (WEIGHTS.survivalPerMon + hpBonus) * (mon.existProbability ?? 1);
}

function sideTotal(active: ResolvedPokemon, bench: ResolvedPokemon[]): number {
  return [active, ...bench].reduce((sum, m) => sum + monValue(m), 0);
}

export function evalSurvival(board: ResolvedBoard): number {
  const self = sideTotal(board.self.active, board.self.bench);
  const opp = sideTotal(board.opp.active, board.opp.bench);
  return self - opp;
}
