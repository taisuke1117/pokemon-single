/**
 * applyTurn が返す ResolvedBoard(1ターン解決後の盤面) → BattleState への差分反映。
 * board.self/opp の active + bench 全員（実質「選出済み全員」）の状態を書き戻す。
 */
import { createBattleParticipant } from '../../../types';
import type { BattleFieldState, BattleParticipant, BattleState } from '../../../types';
import { SIM_TERRAIN_TO_APP, SIM_WEATHER_TO_APP } from '../sim-enum-map';
import type { ResolvedBoard, ResolvedPokemon } from '../types';

const VALID_STATUS = new Set(['brn', 'par', 'psn', 'tox', 'slp', 'frz']);

function toParticipantPatch(mon: ResolvedPokemon, prev: BattleParticipant | undefined): BattleParticipant {
  const base = prev ?? createBattleParticipant();
  return {
    ...base,
    currentHpPercent: mon.hpPercent,
    status: mon.status && VALID_STATUS.has(mon.status) ? (mon.status as BattleParticipant['status']) : undefined,
    boosts: mon.boosts,
    subHpPercent: mon.subHpPercent,
    disguiseBusted: mon.disguiseBusted ?? base.disguiseBusted,
    choiceLockedMoveId: mon.choiceLockedMoveId,
    // 消費済み(true)は一度立ったら維持する。board側がundefinedを返すのは「まだ消費されていない」ではなく
    // 「この関数呼び出し時点では判定できない」場合もあるため、baseへフォールバックして後退させない。
    itemConsumed: mon.itemConsumed ?? base.itemConsumed,
    // trapped は「今アクティブか」に依存し毎ターン変わりうるため、itemConsumedと違いフォールバックしない
    // （交代して非アクティブになった個体は自動的にtrapped=undefinedへ戻る）。
    trapped: mon.trapped,
    // メガ/テラスは一度使ったら試合中ずっと維持される（itemConsumedと同じく後退させない）。
    // これにより次ターンの盤面構築(toPokemonSet)がメガ形態を正しく引き継げる（タスク#39の対応と対）。
    megaUsed: mon.megaActive || base.megaUsed,
    teraUsed: mon.teraActive || base.teraUsed,
    // yawnActiveはtrappedと同様「今その状態か」に依存し毎ターン変わりうる
    // （眠りに落ちた/交代した時点でvolatile自体が消えundefinedへ戻る）ためフォールバックしない。
    yawnActive: mon.yawnActive,
    // 以下も全てtrapped/yawnActiveと同様、simのvolatileが「今も存在するか」をそのまま反映する
    // （解除された/交代した時点でboard側がundefinedを返すので、その通りbaseへフォールバックしない）。
    confusionTurns: mon.confusionTurns,
    encoreMoveId: mon.encoreMoveId,
    encoreTurns: mon.encoreTurns,
    tauntTurns: mon.tauntTurns,
    disableMoveId: mon.disableMoveId,
    disableTurns: mon.disableTurns,
    leechSeedSourceSlot: mon.leechSeedSourceSlot,
    partialTrapTurns: mon.partialTrapTurns,
    partialTrapMoveId: mon.partialTrapMoveId,
    mustRecharge: mon.mustRecharge,
    protectStallCounter: mon.protectStallCounter,
    stockpileLayers: mon.stockpileLayers,
    minimizeActive: mon.minimizeActive,
    aquaRingActive: mon.aquaRingActive,
    // lastMoveIdは「直前に何か技を使った」という事実なので、フォールバックせずboard側の値を
    // そのまま反映する（交代直後はboard側がundefinedを返すので、その通りクリアされるのが正しい）。
    lastMoveId: mon.lastMoveId,
  };
}

function toFieldPatch(board: ResolvedBoard, prevField: BattleFieldState): BattleFieldState {
  return {
    ...prevField,
    weather: board.field.weather ? SIM_WEATHER_TO_APP[board.field.weather] : undefined,
    terrain: board.field.terrain ? SIM_TERRAIN_TO_APP[board.field.terrain] : undefined,
    isTrickRoom: board.field.isTrickRoom,
    selfSide: { ...board.self.side },
    oppSide: { ...board.opp.side },
  };
}

export interface BoardPatch {
  self: Record<string, BattleParticipant>;
  opponent: Record<string, BattleParticipant>;
  field: BattleFieldState;
  selfActiveMemberId: string;
  oppActiveSlotId: string;
}

export function applyResolvedBoard(state: BattleState, board: ResolvedBoard): BoardPatch {
  const self = { ...state.self };
  for (const mon of [board.self.active, ...board.self.bench]) {
    if (!mon.refId) continue;
    self[mon.refId] = toParticipantPatch(mon, self[mon.refId]);
  }
  const opponent = { ...state.opponent };
  for (const mon of [board.opp.active, ...board.opp.bench]) {
    if (!mon.refId) continue;
    opponent[mon.refId] = toParticipantPatch(mon, opponent[mon.refId]);
  }
  return {
    self,
    opponent,
    field: toFieldPatch(board, state.field),
    selfActiveMemberId: board.self.active.refId || state.selfActiveMemberId,
    oppActiveSlotId: board.opp.active.refId || state.oppActiveSlotId,
  };
}
