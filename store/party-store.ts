'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PARTY_SEEDS } from '@/lib/data/party';
import { hydratePartyMember, type PartyMemberSeed } from '@/lib/data/hydrate';
import type { PartyMember } from '@/lib/types';

interface PartyStoreState {
  seeds: PartyMemberSeed[];
  /** 編集中パーティの表示名（DB保存時の初期値・上書き保存対象の表示に使う）。 */
  partyName: string;
  /** DBに保存/読込済みのレコードID。nullなら「まだDBに一度も保存していない新規パーティ」。 */
  currentPartyId: string | null;
  hasHydrated: boolean;
  setMember: (index: number, seed: PartyMemberSeed) => void;
  resetToDefault: () => void;
  /** DBから読み込んだパーティで現在の編集内容を丸ごと置き換える。 */
  loadSeeds: (seeds: PartyMemberSeed[], meta: { id: string; name: string }) => void;
  setPartyName: (name: string) => void;
  /** 新規保存(POST)成功後、以降の保存を上書き保存(PUT)対象にする。 */
  markSavedAs: (meta: { id: string; name: string }) => void;
}

export const usePartyStore = create<PartyStoreState>()(
  persist(
    (set) => ({
      seeds: PARTY_SEEDS,
      partyName: '',
      currentPartyId: null,
      hasHydrated: false,
      setMember: (index, seed) =>
        set((state) => {
          const next = [...state.seeds];
          next[index] = seed;
          return { seeds: next };
        }),
      resetToDefault: () => set({ seeds: PARTY_SEEDS, partyName: '', currentPartyId: null }),
      loadSeeds: (seeds, meta) => set({ seeds, partyName: meta.name, currentPartyId: meta.id }),
      setPartyName: (name) => set({ partyName: name }),
      markSavedAs: (meta) => set({ partyName: meta.name, currentPartyId: meta.id }),
    }),
    {
      name: 'pca-party-v1',
      onRehydrateStorage: () => () => {
        usePartyStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** ハイドレート済み(types/statsが算出済み)の自パーティを返す。 */
export function usePartyMembers(): PartyMember[] {
  const seeds = usePartyStore((s) => s.seeds);
  return seeds.map(hydratePartyMember);
}
