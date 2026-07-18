import speciesJa from './generated/species-ja.json';

const MAP = speciesJa as Record<string, string>;

/** 種族の日本語表示名。未登録の場合は英語名をそのまま返す（フォールバック）。 */
export function speciesJaName(species: string): string {
  return MAP[species] ?? species;
}
