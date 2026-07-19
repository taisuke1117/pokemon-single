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
import type { GtAction, ResolvedBoard } from './types';

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

/**
 * 1回だけターン解決し、結果盤面(ResolvedBoard)を返す。
 * 多段階先読み(recursive-cell.ts)が子ノードの行列を組み立てる際、スカラー評価値ではなく
 * 盤面そのものが必要なためこの変種を用意する（不正な手でも現盤面をそのまま返す点は
 * 元のresolveTurnOnceと同じ。choose成否で分岐しても同じtoResolvedBoard呼び出しになるだけの
 * デッドコードだったため、成否チェック自体は行わない）。
 */
export function resolveTurnOnceBoard(args: SnapshotArgs, selfAction: GtAction, oppAction: GtAction, seed: PRNGSeed): ResolvedBoard {
  const battle = buildBattleFromSnapshot(args.self, args.opp, args.field, seed);
  battle.choose('p1', actionToChoice(selfAction));
  battle.choose('p2', actionToChoice(oppAction));
  return toResolvedBoard(battle, 'p1', args.calcByRef, args.existProbByRef);
}

/** 1回だけターン解決し、結果盤面の評価値(self視点)を返す。 */
export function resolveTurnOnce(args: SnapshotArgs, selfAction: GtAction, oppAction: GtAction, seed: PRNGSeed): number {
  return evaluateBoard(resolveTurnOnceBoard(args, selfAction, oppAction, seed));
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
