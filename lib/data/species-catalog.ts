import { getChampionsSpecies } from '../calc/dex';
import { speciesJaName } from './species-ja';
import { getFullDexEntry } from './full-dex';
import { ENV_SEASON_M4 } from './env-season-m4';
import { toJaTypes } from './type-map';
import type { PokeType } from '../types';

/**
 * チャンピオンズで使用しうる全種族（gen9通常+旧メガ+新規メガ、約970種）のカタログ。
 * 技・特性は @pkmn/dex 由来の「完全なリスト」（scripts/build-full-dex.ts で事前生成）。
 * 使用率ランキングの順位(rank)は実データが無いため、環境データ(ENV_SEASON_M4)に
 * 登録済みの種族のみ持つ（無い数値を創作しないため、%そのものは持たない）。
 */
export interface SpeciesCatalogEntry {
  /** dex互換の英語種族ID */
  species: string;
  /** 表示名（日本語、未登録種族は英語名にフォールバック） */
  name: string;
  types: PokeType[];
  isMega: boolean;
  /** 完全な特性リスト（英語） */
  abilities: string[];
  /** 完全な習得技リスト（英語）。取得できなかった場合は空配列。 */
  moves: string[];
  /** 使用率ランキングでの順位（1が最上位）。環境データに登録済みの場合のみ存在。 */
  rank?: number;
}

let cache: SpeciesCatalogEntry[] | null = null;

export function getFullSpeciesCatalog(): SpeciesCatalogEntry[] {
  if (cache) return cache;
  const rankMap = new Map(ENV_SEASON_M4.map((e) => [e.species, e.rank]));
  // 環境データ(ENV_SEASON_M4)は手動キュレーションで正しい日本語名(フォルム名込み)を
  // 持っているため、自動取得の speciesJaName より優先する
  // （例: Urshifu-Rapid-Strike は自動取得だと地方フォルム名を解決できず英語のまま残る）。
  const curatedNameMap = new Map(ENV_SEASON_M4.map((e) => [e.species, e.name]));
  cache = getChampionsSpecies().map((s) => {
    const full = getFullDexEntry(s.name);
    const baseName = curatedNameMap.get(s.name) ?? speciesJaName(s.name);
    // メガ種族はベース種族と表示名が同じになりがち（例:「メタグロス」）なため、
    // 検索結果で見分けられるよう明示的にサフィックスを付ける
    // （自分のポケモン登録時、ベース種族のつもりで誤ってメガ側を選んでしまい
    // 持ち物がメガストーン固定になる事故を防ぐため）。
    const name = s.isMega && !baseName.includes('メガ') ? `${baseName}（メガ）` : baseName;
    return {
      species: s.name,
      name,
      types: toJaTypes(s.types),
      isMega: s.isMega,
      abilities: s.abilities,
      moves: full?.moves ?? [],
      rank: rankMap.get(s.name),
    };
  });
  return cache;
}

/** 名前(日本語 or 英語)で絞り込む。ランキング掲載種族(順位が低い=上位)を優先し、以降は五十音順。 */
export function searchFullCatalog(query: string, limit = 8): SpeciesCatalogEntry[] {
  const catalog = getFullSpeciesCatalog();
  const q = query.trim().toLowerCase();
  const filtered = q
    ? catalog.filter((e) => e.name.toLowerCase().includes(q) || e.species.toLowerCase().includes(q))
    : catalog;

  return [...filtered]
    .sort((a, b) => {
      if (a.rank !== undefined && b.rank !== undefined) return a.rank - b.rank;
      if (a.rank !== undefined) return -1;
      if (b.rank !== undefined) return 1;
      return a.name.localeCompare(b.name, 'ja');
    })
    .slice(0, limit);
}

export function getCatalogEntry(species: string): SpeciesCatalogEntry | undefined {
  return getFullSpeciesCatalog().find((e) => e.species === species);
}
