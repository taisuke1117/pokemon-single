/**
 * applyTurn/resolveTurnOnceBoard が返す ResolvedBoard(1ターン解決後の盤面) を、
 * 次段の buildPayoffMatrix にそのまま渡せる SnapshotArgs へ変換する。
 *
 * board-to-state.ts (ResolvedBoard→BattleState差分) と本質的に同じ変換ロジックを
 * 再利用する（toParticipantPatch/toFieldPatchをexportし直して共有し、重複実装による
 * ドリフトを避ける）。calcByRefは1シミュレーション内では種族/性格/努力値/技候補が不変なので
 * prevArgsのものをそのまま使い回せる。
 */
import type { CalcSpec } from '../../../types';
import { toFieldPatch, toParticipantPatch } from './board-to-state';
import type { GtMember, GtSideSnapshot } from './build-battle';
import type { SnapshotArgs } from '../chance-sampling';
import type { ResolvedBoard, ResolvedPokemon } from '../types';

function toGtMember(mon: ResolvedPokemon, prevMembers: GtMember[]): GtMember {
  const prev = prevMembers.find((m) => m.refId === mon.refId);
  return {
    refId: mon.refId,
    displayName: prev?.displayName ?? mon.species,
    calc: mon.calc,
    participant: toParticipantPatch(mon, prev?.participant),
  };
}

function toSideSnapshot(active: ResolvedPokemon, bench: ResolvedPokemon[], prev: GtSideSnapshot): GtSideSnapshot {
  const members = [active, ...bench].filter((m) => m.refId).map((m) => toGtMember(m, prev.members));
  return { activeRefId: active.refId, members };
}

export function boardToSnapshotArgs(board: ResolvedBoard, prevArgs: SnapshotArgs): SnapshotArgs {
  const self = toSideSnapshot(board.self.active, board.self.bench, prevArgs.self);
  const opp = toSideSnapshot(board.opp.active, board.opp.bench, prevArgs.opp);
  const calcByRef = new Map<string, CalcSpec>(prevArgs.calcByRef);
  const existProbByRef = new Map<string, number>(prevArgs.existProbByRef);
  for (const mon of [board.self.active, ...board.self.bench, board.opp.active, ...board.opp.bench]) {
    if (!mon.refId) continue;
    calcByRef.set(mon.refId, mon.calc);
    existProbByRef.set(mon.refId, mon.existProbability);
  }
  return {
    self,
    opp,
    field: toFieldPatch(board, prevArgs.field),
    calcByRef,
    existProbByRef,
  };
}
