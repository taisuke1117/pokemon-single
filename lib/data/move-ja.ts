import moveJaFull from './generated/move-ja-full.json';

/**
 * 技の英語名 -> 日本語表示名。
 * scripts/build-move-ability-names.ts で PokeAPI から機械的に取得した
 * ほぼ完全な辞書（684技中683技）。未収録の技のみ英語名にフォールバックする。
 */
const MAP = moveJaFull as Record<string, string>;

export function moveJa(moveId: string): string {
  return MAP[moveId] ?? moveId;
}
