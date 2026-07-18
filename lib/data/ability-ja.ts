import abilityJaFull from './generated/ability-ja-full.json';

/**
 * 特性の英語名 -> 日本語表示名。
 * scripts/build-move-ability-names.ts で PokeAPI から機械的に取得した
 * 完全な辞書（289特性すべて取得済み）。未収録の特性のみ英語名にフォールバックする。
 */
const MAP = abilityJaFull as Record<string, string>;

export function abilityJa(en: string): string {
  return MAP[en] ?? en;
}
