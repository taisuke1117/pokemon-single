/**
 * BattleState(対戦ストア) + 選出済み自分パーティ + 相手枠 から、sim駆動処理(applyTurn)が
 * 必要とする GtSideSnapshot/calcByRef/nameByRef を組み立てる。
 *
 * gt/index.ts の buildGtArgs（行列計算用。existProbability等の重み付けを含む）とは目的が異なる：
 * ここは「実際に今その1手を @pkmn/sim で解決する」ための素の盤面組み立てなので、
 * 判明済み枠（今場に出ている or 対戦中に出たことがある）だけを渡す。
 */
import { toID } from '@pkmn/sim';
import { pickPrimarySpread, spreadToCalcSpec } from '../../matchup';
import { createBattleParticipant } from '../../../types';
import type { BattleParticipant, BattleState, CalcSpec, OpponentSlot, PartyMember } from '../../../types';
import type { GtMember, GtSideSnapshot } from './build-battle';
import type { TurnActionSpec } from './apply-turn';

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
 * 相手の技セットを選ぶ: 今まさに選択しようとしている技(pendingMoveId、UIで新たに選んだ技)と
 * 対戦中に実際に使用が確認された技(revealedMoveIds)を最優先で確定させ、残りの枠を
 * 採用率(moveUsage、環境データは最大10件保持)降順で埋める。実際の技は4つまでしか
 * 持てない(@pkmn/simの制約)ため、「どの4つを確定枠にするか」を技が判明するたびに更新していく。
 * pendingMoveIdが無ければ、moveUsage上位10件に含まれない技(UIでは選べるが未確認の技)を
 * ターン進行(applyTurn)時に選んでもsimに拒否される。
 * revealedMoveIds/pendingMoveIdはsim小文字ID表記、moveUsage[].moveIdは正式表記なのでtoIDで揃える。
 */
export function pickOppMoveIds(slot: OpponentSlot, participant: BattleParticipant, pendingMoveId?: string): string[] {
  const usageList = [...(slot.moveUsage ?? [])].sort((a, b) => b.usage - a.usage);
  const priorityIds = pendingMoveId ? [pendingMoveId, ...(participant.revealedMoveIds ?? [])] : (participant.revealedMoveIds ?? []);
  const confirmed: string[] = [];
  for (const id of priorityIds) {
    if (confirmed.some((c) => toID(c) === toID(id))) continue;
    const known = usageList.find((mu) => toID(mu.moveId) === toID(id));
    confirmed.push(known ? known.moveId : id);
  }
  const remaining = 4 - confirmed.length;
  if (remaining <= 0) return confirmed.slice(0, 4);
  const rest = usageList
    .map((m) => m.moveId)
    .filter((id) => !confirmed.some((c) => toID(c) === toID(id)));
  return [...confirmed, ...rest.slice(0, remaining)];
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

/**
 * 選出済み自分3体・相手の判明済み枠が揃っていなければ undefined（呼び出し側でガードする）。
 * oppAction/selfActionが{kind:'move'}の場合、その技を確定枠として最優先で技リストに含める
 * （UIでは採用率データに無い技も選べるが、含めないとsimがその技での選択を拒否するため）。
 */
export function buildBattleSnapshotAdapters(
  state: BattleState,
  bench: PartyMember[],
  opponents: OpponentSlot[],
  selfAction?: TurnActionSpec,
  oppAction?: TurnActionSpec,
): BattleSnapshotAdapters | undefined {
  const pendingSelfMoveId = selfAction?.kind === 'move' ? selfAction.moveId : undefined;
  const selfMembers: GtMember[] = bench.map((m) => {
    const calc = m.calc;
    if (m.id !== state.selfActiveMemberId || !pendingSelfMoveId) {
      return { refId: m.id, displayName: m.name, calc, participant: state.self[m.id] ?? createBattleParticipant() };
    }
    const moveIds = calc.moveIds ?? [];
    const hasMove = moveIds.some((mv) => toID(mv) === toID(pendingSelfMoveId));
    return {
      refId: m.id,
      displayName: m.name,
      calc: hasMove ? calc : { ...calc, moveIds: [...moveIds.slice(0, 3), pendingSelfMoveId] },
      participant: state.self[m.id] ?? createBattleParticipant(),
    };
  });
  if (selfMembers.length === 0) return undefined;

  const pendingOppMoveId = oppAction?.kind === 'move' ? oppAction.moveId : undefined;
  const oppSlots = opponents.filter((o) => o.species && (o.seenInBattle || o.id === state.oppActiveSlotId));
  const oppMembers: GtMember[] = [];
  for (const slot of oppSlots) {
    const rawCalc = oppToCalc(slot);
    if (!rawCalc) continue;
    const calc = applyRevealed(rawCalc, slot, state);
    const participant = state.opponent[slot.id] ?? createBattleParticipant();
    const moveIds = pickOppMoveIds(slot, participant, slot.id === state.oppActiveSlotId ? pendingOppMoveId : undefined);
    oppMembers.push({
      refId: slot.id,
      displayName: slot.resolvedName ?? slot.query,
      calc: { ...calc, moveIds: moveIds.length ? moveIds : calc.moveIds },
      participant,
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
