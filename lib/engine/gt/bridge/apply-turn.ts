/**
 * sim駆動ターン進行の中核。現在の盤面スナップショット + 両者の行動 + 観測乱数を @pkmn/sim に流し、
 * 1ターンを解決して「次の盤面(ResolvedBoard)」と「イベントログ(TurnLogEvent[])」を返す。
 *
 * ステロ・毒/砂の残留ダメ・追加効果の能力ダウン・怯み・化けの皮・襷・鮫肌・砂おこし・身代わり等は
 * すべて @pkmn/sim が処理する（このファイルはそれを駆動して結果を取り出すだけ）。
 * 最終HPは観測値を正として補正する（sim側は GuidedPRNG でKO/非KOの分岐だけ観測に合わせている）。
 */
import { PRNG } from '@pkmn/sim';
import { buildBattleFromSnapshot, orderedMembers, type GtSideSnapshot } from './build-battle';
import { toResolvedBoard } from '../eval/board-snapshot';
import { actionToChoice } from '../legal-moves';
import { GuidedPRNG, type GuidedObservations } from './guided-prng';
import { parseTurnLog, type TurnLogEvent } from '../battle-log';
import type { BattleFieldState, CalcSpec } from '../../../types';
import type { GtAction, ResolvedBoard } from '../types';

/**
 * refIdベースの行動指定（UI/storeが sim の並び替えindexを知らずに済むようにするための型）。
 * 交代は「どのrefIdに交代するか」で指定し、内部で orderedMembers を使って toIndex に変換する。
 * mega は技を使う場合のみ指定可能。terastallize はこの対戦環境では使用しないため対象外
 * （legal-moves.ts の enumerateLegalActions も意図的にテラス選択肢を列挙しない）。
 */
export type TurnActionSpec =
  | { kind: 'move'; moveId: string; mega?: boolean }
  | { kind: 'switch'; toRefId: string };

function toGtAction(spec: TurnActionSpec, snap: GtSideSnapshot): GtAction {
  if (spec.kind === 'move') return { kind: 'move', moveId: spec.moveId, mega: spec.mega };
  const ordered = orderedMembers(snap);
  const toIndex = ordered.findIndex((m) => m.refId === spec.toRefId);
  return { kind: 'switch', toIndex: Math.max(0, toIndex) };
}

/** 片側の手の観測（攻撃側視点。防御側の結果HP%と急所/追加効果の有無）。 */
export interface TurnObservation {
  wasCrit: boolean;
  /** その手で防御側に残ったHP%（0=瀕死）。 */
  hpPercentAfter: number;
  secondaryProcced?: boolean;
}

export interface ApplyTurnInput {
  self: GtSideSnapshot;
  opp: GtSideSnapshot;
  field: BattleFieldState;
  calcByRef: Map<string, CalcSpec>;
  existProbByRef?: Map<string, number>;
  /** refId → 日本語表示名（ログ整形用）。 */
  nameByRef: Map<string, string>;
  /** 進行中のターン番号（ログ表示用）。 */
  turn: number;
  selfAction: TurnActionSpec;
  oppAction: TurnActionSpec;
  /** 自分が技を使った場合の観測（相手が防御側）。交代等で技を使わなかったら undefined。 */
  selfObserved?: TurnObservation;
  /** 相手が技を使った場合の観測（自分が防御側）。 */
  oppObserved?: TurnObservation;
}

export interface TurnResolution {
  board: ResolvedBoard;
  log: TurnLogEvent[];
  /** choose が拒否された等で正常解決できなかった場合の注記。 */
  warning?: string;
}

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function applyTurn(input: ApplyTurnInput): TurnResolution {
  const obs: GuidedObservations = {
    p1: input.selfObserved
      ? {
          wasCrit: input.selfObserved.wasCrit,
          secondaryProcced: input.selfObserved.secondaryProcced,
          defenderFainted: input.selfObserved.hpPercentAfter <= 0,
        }
      : undefined,
    p2: input.oppObserved
      ? {
          wasCrit: input.oppObserved.wasCrit,
          secondaryProcced: input.oppObserved.secondaryProcced,
          defenderFainted: input.oppObserved.hpPercentAfter <= 0,
        }
      : undefined,
  };

  const seed = PRNG.generateSeed();
  const guided = new GuidedPRNG(obs, seed);
  const battle = buildBattleFromSnapshot(input.self, input.opp, input.field, seed, guided);
  guided.battle = battle;

  // ここまでの battle.log は「対戦セットアップ＋状態注入のエコー」。
  // choose以降だけがこのターンのイベントなので、ログはこの位置からスライスする。
  const logStart = battle.log.length;

  const okSelf = battle.choose('p1', actionToChoice(toGtAction(input.selfAction, input.self)));
  const okOpp = battle.choose('p2', actionToChoice(toGtAction(input.oppAction, input.opp)));
  const warning = !okSelf || !okOpp ? '一部の行動が@pkmn/simに受理されませんでした（盤面は可能な範囲で更新しています）' : undefined;

  const board = toResolvedBoard(battle, 'p1', input.calcByRef, input.existProbByRef);

  // 最終HPは観測値を正として補正する（攻撃側の技が当たった防御側のactiveのHPを上書き）。
  if (input.selfObserved) board.opp.active.hpPercent = clampPct(input.selfObserved.hpPercentAfter);
  if (input.oppObserved) board.self.active.hpPercent = clampPct(input.oppObserved.hpPercentAfter);

  const log = parseTurnLog(battle.log.slice(logStart), { turn: input.turn, nameByRef: input.nameByRef });

  return { board, log, warning };
}
