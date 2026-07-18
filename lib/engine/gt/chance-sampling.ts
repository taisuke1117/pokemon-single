/**
 * チャンスノードの期待値をモンテカルロで求める。
 * 同じ手の組を異なるseedでN回解決し、結果盤面の評価値を平均する
 * （@pkmn/simは1ターン内の乱数が単一連続ストリームなので、急所/命中/ロールの解析的分離はしない）。
 */
import { PRNG } from '@pkmn/sim';
import type { PRNGSeed } from '@pkmn/sim';
import { buildBattleFromSnapshot, type GtSideSnapshot } from './bridge/build-battle';
import { actionToChoice } from './legal-moves';
import { toResolvedBoard } from './eval/board-snapshot';
import { evaluateBoard } from './eval/compose';
import type { BattleFieldState, CalcSpec } from '../../types';
import type { GtAction } from './types';

/** 既定サンプル数。二値イベント(急所/命中)の分散と速度のトレードオフで24〜32が目安。
 *  行列がテラス変種で肥大化するため、対話用途では低め(24)を既定にする。 */
export const DEFAULT_SAMPLES = 24;

export interface SnapshotArgs {
  self: GtSideSnapshot;
  opp: GtSideSnapshot;
  field: BattleFieldState;
  /** refId → CalcSpec（評価関数のダメージ計算用に board-snapshot へ配線する）。 */
  calcByRef: Map<string, CalcSpec>;
  /** refId → 選出に実際に含まれている確率(0-1)。省略時は全て1として扱われる。 */
  existProbByRef?: Map<string, number>;
}

/** 1回だけターン解決し、結果盤面の評価値(self視点)を返す。 */
export function resolveTurnOnce(args: SnapshotArgs, selfAction: GtAction, oppAction: GtAction, seed: PRNGSeed): number {
  const battle = buildBattleFromSnapshot(args.self, args.opp, args.field, seed);
  const okSelf = battle.choose('p1', actionToChoice(selfAction));
  const okOpp = battle.choose('p2', actionToChoice(oppAction));
  if (!okSelf || !okOpp) {
    // 不正な手（通常は起きないが保険）。現盤面をそのまま評価する。
    return evaluateBoard(toResolvedBoard(battle, 'p1', args.calcByRef, args.existProbByRef));
  }
  return evaluateBoard(toResolvedBoard(battle, 'p1', args.calcByRef, args.existProbByRef));
}

/** N回サンプリングして評価値の平均を返す。 */
export function expectedCellValue(
  args: SnapshotArgs,
  selfAction: GtAction,
  oppAction: GtAction,
  n: number = DEFAULT_SAMPLES,
): number {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += resolveTurnOnce(args, selfAction, oppAction, PRNG.generateSeed());
  }
  return sum / n;
}
