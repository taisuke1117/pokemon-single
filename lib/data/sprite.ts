import spriteMap from './generated/sprite-map.json';

/**
 * 種族名(@pkmn/dex互換の英語名) -> スプライトURL。
 * URL自体は scripts/build-sprites.ts でビルド時に解決済み（実行時のAPI依存なし）。
 * 未登録の種族は undefined を返すので、呼び出し側でフォールバック表示すること。
 */
export function getSpriteUrl(species: string): string | undefined {
  return (spriteMap as Record<string, string>)[species];
}
