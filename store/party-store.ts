'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PARTY_SEEDS } from '@/lib/data/party';
import { hydratePartyMember, type PartyMemberSeed } from '@/lib/data/hydrate';
import type { PartyMember } from '@/lib/types';

interface PartyStoreState {
  seeds: PartyMemberSeed[];
  hasHydrated: boolean;
  setMember: (index: number, seed: PartyMemberSeed) => void;
  resetToDefault: () => void;
}

export const usePartyStore = create<PartyStoreState>()(
  persist(
    (set) => ({
      seeds: PARTY_SEEDS,
      hasHydrated: false,
      setMember: (index, seed) =>
        set((state) => {
          const next = [...state.seeds];
          next[index] = seed;
          return { seeds: next };
        }),
      resetToDefault: () => set({ seeds: PARTY_SEEDS }),
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
