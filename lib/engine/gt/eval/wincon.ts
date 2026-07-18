/**
 * 排他的な問い: 「決着が見えているか（無傷エースの全抜き圏か）」。
 * 対面の脅威(今の1対面のみ)とは範囲で分ける。ここは相手“全員”を抜けるかを見る（重複回避）。
 *
 * 無傷ゲート: HP割合が高い(>=85%)個体のみ抜き役の候補にする。これにより
 * 「瀕死5%の+6積み」のような死ぬ前提の積みを勝ち筋に誤カウントしない(罠回避)。
 * 候補が相手の生存全員を上から(トリックルーム反転込み)確定1発で倒せるなら勝ち筋成立。
 * 1体でも止め役(抜き役より速く、抜き役を倒せる)がいれば不成立。
 */
import type { FieldSpec } from '../../../calc/damage';
import type { ResolvedBoard, ResolvedPokemon } from '../types';
import { WEIGHTS } from './weights';
import { effectiveSpeed, findBestMove, toFieldSpec } from './calc-helpers';

const UNTOUCHED_GATE = 85; // HP%これ以上のみ抜き役候補

function livingMons(active: ResolvedPokemon, bench: ResolvedPokemon[]): ResolvedPokemon[] {
  return [active, ...bench].filter((m) => m.species && m.hpPercent > 0);
}

/** sweeper が defenders 全員を上から確定1発で倒せるか（トリックルーム反転込み）。 */
function canSweep(sweeper: ResolvedPokemon, defenders: ResolvedPokemon[], trickRoom: boolean, field: FieldSpec): boolean {
  const sweeperSpeed = effectiveSpeed(sweeper);
  for (const d of defenders) {
    const dSpeed = effectiveSpeed(d);
    const sweeperFaster = trickRoom ? sweeperSpeed < dSpeed : sweeperSpeed > dSpeed;
    if (!sweeperFaster) return false;
    const best = findBestMove(sweeper, d, sweeper.moveIds, field);
    if (!best || best.result.minPct < 100) return false; // 確定1発でなければ抜き不成立
  }
  return true;
}

function hasWincon(
  attackers: ResolvedPokemon[],
  defenders: ResolvedPokemon[],
  trickRoom: boolean,
  field: FieldSpec,
): boolean {
  if (defenders.length === 0) return false;
  return attackers.some((a) => a.hpPercent >= UNTOUCHED_GATE && canSweep(a, defenders, trickRoom, field));
}

export function evalWincon(board: ResolvedBoard): number {
  const selfMons = livingMons(board.self.active, board.self.bench);
  const oppMons = livingMons(board.opp.active, board.opp.bench);

  let score = 0;
  if (hasWincon(selfMons, oppMons, board.field.isTrickRoom, toFieldSpec(board, 'self'))) score += WEIGHTS.wincon;
  if (hasWincon(oppMons, selfMons, board.field.isTrickRoom, toFieldSpec(board, 'opp'))) score -= WEIGHTS.wincon;
  return score;
}
