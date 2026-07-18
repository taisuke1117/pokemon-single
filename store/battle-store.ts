'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applySwitchInEffects } from '@/lib/engine/switchin';
import { applyTurn, type TurnActionSpec, type TurnObservation } from '@/lib/engine/gt/bridge/apply-turn';
import { buildBattleSnapshotAdapters } from '@/lib/engine/gt/bridge/battle-state-adapter';
import { applyResolvedBoard } from '@/lib/engine/gt/bridge/board-to-state';
import type { TurnLogEvent } from '@/lib/engine/gt/battle-log';
import {
  createBattleFieldState,
  createBattleParticipant,
  type BattleFieldState,
  type BattleParticipant,
  type BattleState,
  type MoveObservation,
  type OpponentSlot,
  type PartyMember,
  type SideConditions,
} from '@/lib/types';

/** advanceTurn の呼び出し結果。UIがエラー表示・警告表示に使う。 */
export interface AdvanceTurnResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

/** 1ターン確定前のスナップショット（undoTurn用）。 */
interface HistoryEntry {
  state: BattleState;
  opponents: OpponentSlot[];
}

interface BattleStoreState {
  active: boolean;
  /** 対戦開始時点の相手6枠のスナップショット（相手の持ち物/特性判明はBattleParticipant側で追跡する）。 */
  opponents: OpponentSlot[];
  /** 選出した自分のメンバーID。 */
  benchMemberIds: string[];
  state: BattleState;
  /** ターン確定直前のスナップショット履歴（undoTurn用。上限10）。 */
  past: HistoryEntry[];
  /** @pkmn/sim解決ログを日本語化した対戦ログ（右端ログ列の表示用）。 */
  battleLog: TurnLogEvent[];
  startBattle: (bench: PartyMember[], opponents: OpponentSlot[], leadMemberId: string, leadOppSlotId: string) => void;
  endBattle: () => void;
  setOppActive: (slotId: string) => void;
  updateSelfParticipant: (memberId: string, patch: Partial<BattleParticipant>) => void;
  updateOppParticipant: (slotId: string, patch: Partial<BattleParticipant>) => void;
  updateField: (patch: Partial<Pick<BattleFieldState, 'weather' | 'terrain' | 'isTrickRoom'>>) => void;
  updateSelfSide: (patch: Partial<SideConditions>) => void;
  updateOppSide: (patch: Partial<SideConditions>) => void;
  addObservation: (obs: MoveObservation) => void;
  /** 自分の控えを送り出す（ステロ/いかくの自動反映込み）。 */
  switchInSelf: (member: PartyMember) => void;
  /** 相手の控えを送り出す（ステロ/いかくの自動反映込み）。abilityGuessは判明済みで無ければ代表傾向の特性。 */
  switchInOpp: (slot: OpponentSlot, abilityGuess: string | undefined) => void;
  nextTurn: () => void;
  /**
   * 現在の盤面 + 両者の行動 + 観測乱数を @pkmn/sim で解決し、次のターンへ進める。
   * ステロ交代ダメ・毒残留・追加効果の能力ダウン・化けの皮・襷・砂おこし・身代わり等、
   * @pkmn/sim が扱える効果は全て自動反映される（applyTurn参照）。
   * bench は選出済み自分パーティの実体（PartyMember、party-store由来なのでここでは引数で受け取る）。
   */
  advanceTurn: (
    bench: PartyMember[],
    selfAction: TurnActionSpec,
    oppAction: TurnActionSpec,
    selfObserved?: TurnObservation,
    oppObserved?: TurnObservation,
  ) => AdvanceTurnResult;
  /** 直前のターン確定を取り消し、1つ前の盤面に戻す。 */
  undoTurn: () => void;
  canUndo: () => boolean;
}

const initialBattleState: BattleState = {
  turn: 1,
  selfActiveMemberId: '',
  oppActiveSlotId: '',
  self: {},
  opponent: {},
  field: createBattleFieldState(),
  observations: [],
};

export const useBattleStore = create<BattleStoreState>()(
  persist(
    (set, get) => ({
      active: false,
      opponents: [],
      benchMemberIds: [],
      state: initialBattleState,
      past: [],
      battleLog: [],

      startBattle: (bench, opponents, leadMemberId, leadOppSlotId) => {
        const self: Record<string, BattleParticipant> = {};
        for (const m of bench) self[m.id] = createBattleParticipant();
        const opponent: Record<string, BattleParticipant> = {};
        for (const o of opponents) opponent[o.id] = createBattleParticipant();
        // 対戦開始時点では、まだどの相手ポケモンも「実際に場に出た」ことは無い
        // （スカウティング入力の6枠は全て未確定として扱う。リードのみ後続の switchInOpp で確定させる）。
        const opponentsReset = opponents.map((o) => ({ ...o, seenInBattle: false }));

        set({
          active: true,
          opponents: opponentsReset,
          benchMemberIds: bench.map((m) => m.id),
          state: {
            ...initialBattleState,
            selfActiveMemberId: leadMemberId,
            oppActiveSlotId: leadOppSlotId,
            self,
            opponent,
          },
          past: [],
          battleLog: [],
        });

        // 初手の送り出しにもいかく等を反映する
        const lead = bench.find((m) => m.id === leadMemberId);
        if (lead) get().switchInSelf(lead);
        const oppLead = opponents.find((o) => o.id === leadOppSlotId);
        if (oppLead) {
          const primary = oppLead.spreads?.[0];
          get().switchInOpp(oppLead, primary?.abilityId);
        }
      },

      endBattle: () =>
        set({ active: false, state: initialBattleState, opponents: [], benchMemberIds: [], past: [], battleLog: [] }),

      setOppActive: (slotId) => set((s) => ({ state: { ...s.state, oppActiveSlotId: slotId } })),

      updateSelfParticipant: (memberId, patch) =>
        set((s) => ({
          state: {
            ...s.state,
            self: {
              ...s.state.self,
              [memberId]: { ...(s.state.self[memberId] ?? createBattleParticipant()), ...patch },
            },
          },
        })),

      updateOppParticipant: (slotId, patch) =>
        set((s) => ({
          state: {
            ...s.state,
            opponent: {
              ...s.state.opponent,
              [slotId]: { ...(s.state.opponent[slotId] ?? createBattleParticipant()), ...patch },
            },
          },
        })),

      updateField: (patch) => set((s) => ({ state: { ...s.state, field: { ...s.state.field, ...patch } } })),

      updateSelfSide: (patch) =>
        set((s) => ({
          state: { ...s.state, field: { ...s.state.field, selfSide: { ...s.state.field.selfSide, ...patch } } },
        })),

      updateOppSide: (patch) =>
        set((s) => ({
          state: { ...s.state, field: { ...s.state.field, oppSide: { ...s.state.field.oppSide, ...patch } } },
        })),

      addObservation: (obs) => set((s) => ({ state: { ...s.state, observations: [...s.state.observations, obs] } })),

      switchInSelf: (member) =>
        set((s) => {
          const participant = s.state.self[member.id] ?? createBattleParticipant();
          const effect = applySwitchInEffects(member.calc.species, member.calc.abilityId, s.state.field.selfSide);
          const nextParticipant: BattleParticipant = {
            ...participant,
            currentHpPercent: Math.max(0, round1(participant.currentHpPercent - effect.hpPercentLoss)),
          };
          const oppId = s.state.oppActiveSlotId;
          const oppParticipant = s.state.opponent[oppId];
          const nextOpp =
            oppParticipant && effect.opponentAtkBoostChange !== 0
              ? {
                  ...oppParticipant,
                  boosts: {
                    ...oppParticipant.boosts,
                    a: clampBoost((oppParticipant.boosts.a ?? 0) + effect.opponentAtkBoostChange),
                  },
                }
              : oppParticipant;

          return {
            state: {
              ...s.state,
              selfActiveMemberId: member.id,
              self: { ...s.state.self, [member.id]: nextParticipant },
              opponent: nextOpp ? { ...s.state.opponent, [oppId]: nextOpp } : s.state.opponent,
            },
          };
        }),

      switchInOpp: (slot, abilityGuess) =>
        set((s) => {
          const participant = s.state.opponent[slot.id] ?? createBattleParticipant();
          const effect = applySwitchInEffects(
            slot.species ?? '',
            participant.revealedAbilityId ?? abilityGuess,
            s.state.field.oppSide,
          );
          const nextParticipant: BattleParticipant = {
            ...participant,
            currentHpPercent: Math.max(0, round1(participant.currentHpPercent - effect.hpPercentLoss)),
          };
          const selfId = s.state.selfActiveMemberId;
          const selfParticipant = s.state.self[selfId];
          const nextSelf =
            selfParticipant && effect.opponentAtkBoostChange !== 0
              ? {
                  ...selfParticipant,
                  boosts: {
                    ...selfParticipant.boosts,
                    a: clampBoost((selfParticipant.boosts.a ?? 0) + effect.opponentAtkBoostChange),
                  },
                }
              : selfParticipant;

          return {
            // 実際に場に出た枠として確定させる（GTエンジン等が未確定の枠を
            // 確定情報として扱わないようにするためのフラグ）
            opponents: s.opponents.map((o) => (o.id === slot.id ? { ...o, seenInBattle: true } : o)),
            state: {
              ...s.state,
              oppActiveSlotId: slot.id,
              opponent: { ...s.state.opponent, [slot.id]: nextParticipant },
              self: nextSelf ? { ...s.state.self, [selfId]: nextSelf } : s.state.self,
            },
          };
        }),

      nextTurn: () => set((s) => ({ state: { ...s.state, turn: s.state.turn + 1 } })),

      advanceTurn: (bench, selfAction, oppAction, selfObserved, oppObserved) => {
        const s = get();
        const adapters = buildBattleSnapshotAdapters(s.state, bench, s.opponents);
        if (!adapters) {
          return { ok: false, error: '相手の型情報（種族・代表スプレッド）が不足しているため、ターンを進められません' };
        }

        const result = applyTurn({
          self: adapters.self,
          opp: adapters.opp,
          field: s.state.field,
          calcByRef: adapters.calcByRef,
          nameByRef: adapters.nameByRef,
          turn: s.state.turn,
          selfAction,
          oppAction,
          selfObserved,
          oppObserved,
        });

        const patch = applyResolvedBoard(s.state, result.board);

        const observations: MoveObservation[] = [...s.state.observations];
        if (selfAction.kind === 'move' && selfObserved) {
          observations.push({
            turn: s.state.turn,
            attackerSide: 'self',
            moveId: selfAction.moveId,
            wasCrit: selfObserved.wasCrit,
            defenderHpPercentBefore: s.state.opponent[s.state.oppActiveSlotId]?.currentHpPercent ?? 100,
            defenderHpPercentAfter: selfObserved.hpPercentAfter,
            secondaryEffectProcced: selfObserved.secondaryProcced,
            selfMemberId: s.state.selfActiveMemberId,
            oppSlotId: s.state.oppActiveSlotId,
          });
        }
        if (oppAction.kind === 'move' && oppObserved) {
          observations.push({
            turn: s.state.turn,
            attackerSide: 'opponent',
            moveId: oppAction.moveId,
            wasCrit: oppObserved.wasCrit,
            defenderHpPercentBefore: s.state.self[s.state.selfActiveMemberId]?.currentHpPercent ?? 100,
            defenderHpPercentAfter: oppObserved.hpPercentAfter,
            secondaryEffectProcced: oppObserved.secondaryProcced,
            selfMemberId: s.state.selfActiveMemberId,
            oppSlotId: s.state.oppActiveSlotId,
          });
          // 相手が実際に使った技として判明させる
          const oppP = patch.opponent[s.state.oppActiveSlotId];
          if (oppP && !oppP.revealedMoveIds.includes(oppAction.moveId)) {
            patch.opponent[s.state.oppActiveSlotId] = {
              ...oppP,
              revealedMoveIds: [...oppP.revealedMoveIds, oppAction.moveId],
            };
          }
        }

        // 相手が交代した場合は、実際に場に出た枠として確定させる（既存switchInOppと同じ意図）。
        const nextOpponents =
          oppAction.kind === 'switch'
            ? s.opponents.map((o) => (o.id === patch.oppActiveSlotId ? { ...o, seenInBattle: true } : o))
            : s.opponents;

        const historyEntry: HistoryEntry = { state: s.state, opponents: s.opponents };

        set({
          opponents: nextOpponents,
          state: {
            ...s.state,
            self: patch.self,
            opponent: patch.opponent,
            field: patch.field,
            selfActiveMemberId: patch.selfActiveMemberId,
            oppActiveSlotId: patch.oppActiveSlotId,
            observations,
            turn: s.state.turn + 1,
          },
          past: [...s.past, historyEntry].slice(-10),
          battleLog: [...s.battleLog, ...result.log],
        });

        return { ok: true, warning: result.warning };
      },

      undoTurn: () => {
        const s = get();
        const last = s.past[s.past.length - 1];
        if (!last) return;
        set({
          state: last.state,
          opponents: last.opponents,
          past: s.past.slice(0, -1),
          battleLog: s.battleLog.filter((e) => e.turn < last.state.turn),
        });
      },

      canUndo: () => get().past.length > 0,
    }),
    { name: 'pca-battle-v1' },
  ),
);

function clampBoost(n: number): number {
  return Math.max(-6, Math.min(6, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
