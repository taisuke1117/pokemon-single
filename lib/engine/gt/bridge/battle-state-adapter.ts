/**
 * BattleState(対戦ストア) + 選出済み自分パーティ + 相手枠 から、sim駆動処理(applyTurn)が
 * 必要とする GtSideSnapshot/calcByRef/nameByRef を組み立てる。
 *
 * gt/index.ts の buildGtArgs（行列計算用。existProbability等の重み付けを含む）とは目的が異なる：
 * ここは「実際に今その1手を @pkmn/sim で解決する」ための素の盤面組み立てなので、
 * 判明済み枠（今場に出ている or 対戦中に出たことがある）だけを渡す。
 */
import { pickPrimarySpread, spreadToCalcSpec } from '../../matchup';
import { createBattleParticipant } from '../../../types';
import type { BattleState, CalcSpec, OpponentSlot, PartyMember } from '../../../types';
import type { GtMember, GtSideSnapshot } from './build-battle';

export interface BattleSnapshotAdapters {
  self: GtSideSnapshot;
  opp: GtSideSnapshot;
  calcByRef: Map<string, CalcSpec>;
  nameByRef: Map<string, string>;
}

export function oppToCalc(slot: OpponentSlot): CalcSpec | undefined {
  if (!slot.species) return undefined;
  const primary = pickPrimarySpread(slot);
  if (!primary) return undefined;
  return spreadToCalcSpec(slot.species, primary);
}

/**
 * 判明済み情報の反映: 相手枠に revealedItemId/revealedAbilityId/revealedNatureId/revealedEvs/
 * revealedTeraTypeId があれば代表スプレッドより優先する（gt/index.ts の行列計算・
 * bridge/apply-turn.ts のターン進行の両方から使う共通ロジック）。EVは判明した分だけ上書きし、
 * 残りは代表スプレッドの値を引き継ぐ。
 */
export function applyRevealed(calc: CalcSpec, slot: OpponentSlot, state: BattleState): CalcSpec {
  const participant = state.opponent[slot.id];
  if (!participant) return calc;
  return {
    ...calc,
    itemId: participant.revealedItemId ?? calc.itemId,
    abilityId: participant.revealedAbilityId ?? calc.abilityId,
    natureId: participant.revealedNatureId ?? calc.natureId,
    evs: participant.revealedEvs ? { ...calc.evs, ...participant.revealedEvs } : calc.evs,
    teraTypeId: participant.revealedTeraTypeId ?? calc.teraTypeId,
  };
}

/** 選出済み自分3体・相手の判明済み枠が揃っていなければ undefined（呼び出し側でガードする）。 */
export function buildBattleSnapshotAdapters(
  state: BattleState,
  bench: PartyMember[],
  opponents: OpponentSlot[],
): BattleSnapshotAdapters | undefined {
  const selfMembers: GtMember[] = bench.map((m) => ({
    refId: m.id,
    displayName: m.name,
    calc: m.calc,
    participant: state.self[m.id] ?? createBattleParticipant(),
  }));
  if (selfMembers.length === 0) return undefined;

  const oppSlots = opponents.filter((o) => o.species && (o.seenInBattle || o.id === state.oppActiveSlotId));
  const oppMembers: GtMember[] = [];
  for (const slot of oppSlots) {
    const rawCalc = oppToCalc(slot);
    if (!rawCalc) continue;
    const calc = applyRevealed(rawCalc, slot, state);
    const moveIds = (slot.moveUsage ?? []).slice(0, 4).map((m) => m.moveId);
    oppMembers.push({
      refId: slot.id,
      displayName: slot.resolvedName ?? slot.query,
      calc: { ...calc, moveIds: moveIds.length ? moveIds : calc.moveIds },
      participant: state.opponent[slot.id] ?? createBattleParticipant(),
    });
  }
  if (oppMembers.length === 0) return undefined;

  const self: GtSideSnapshot = { activeRefId: state.selfActiveMemberId, members: selfMembers };
  const oppActiveRefId = oppMembers.some((m) => m.refId === state.oppActiveSlotId)
    ? state.oppActiveSlotId
    : oppMembers[0].refId;
  const opp: GtSideSnapshot = { activeRefId: oppActiveRefId, members: oppMembers };

  const calcByRef = new Map<string, CalcSpec>();
  const nameByRef = new Map<string, string>();
  for (const m of [...selfMembers, ...oppMembers]) {
    calcByRef.set(m.refId, m.calc);
    nameByRef.set(m.refId, m.displayName);
  }

  return { self, opp, calcByRef, nameByRef };
}
