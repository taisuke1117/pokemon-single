import fullDex from './generated/full-dex.json';

export interface FullDexEntry {
  species: string;
  types: readonly string[];
  abilities: string[];
  isMega: boolean;
  /** 完全な習得技リスト（英語ID表記の技名）。 */
  moves: string[];
}

const BY_SPECIES = new Map<string, FullDexEntry>((fullDex as FullDexEntry[]).map((e) => [e.species, e]));

/** 種族(英語ID/名)の完全な習得技リスト・特性リストを返す。scripts/build-full-dex.ts で事前生成済み。 */
export function getFullDexEntry(species: string): FullDexEntry | undefined {
  return BY_SPECIES.get(species);
}

export function getAllFullDexEntries(): FullDexEntry[] {
  return fullDex as FullDexEntry[];
}
