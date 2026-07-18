/**
 * 種族名(@pkmn/dex互換の英語名) -> PokeAPIスプライトURL の対応表をビルド時に生成する。
 *
 * 新規メガ(メガシビルドン等)はPokeAPI側の内部IDが変則的(10000番台)なため、
 * 実行時にIDを推測するのではなく、ビルド時に名前でPokeAPIへ問い合わせて
 * 実際のURLをそのままJSONにキャッシュする（実行時の外部API依存を避ける）。
 *
 * 実行: npx tsx scripts/build-sprites.ts
 */
import { writeFileSync } from 'node:fs';
import { MOCK_PARTY } from '../lib/data/party.ts';
import { ENV_SEASON_M4 } from '../lib/data/env-season-m4.ts';

/** PokeAPIのスラッグが素直な変換ルールに従わない種族の例外対応。 */
const SLUG_ALIASES: Record<string, string> = {
  Mimikyu: 'mimikyu-disguised',
};

function toSlug(species: string): string {
  if (SLUG_ALIASES[species]) return SLUG_ALIASES[species];
  return species
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

async function fetchSpriteUrl(slug: string): Promise<string | null> {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.sprites?.front_default ?? data.sprites?.other?.['official-artwork']?.front_default ?? null;
}

async function main() {
  const species = new Set<string>();
  for (const p of MOCK_PARTY) species.add(p.calc.species);
  for (const e of ENV_SEASON_M4) species.add(e.species);

  const map: Record<string, string> = {};
  for (const s of species) {
    const slug = toSlug(s);
    const url = await fetchSpriteUrl(slug);
    if (url) {
      map[s] = url;
      console.log('OK  ', s, '->', slug);
    } else {
      console.log('MISS', s, '->', slug);
    }
  }

  writeFileSync(
    new URL('../lib/data/generated/sprite-map.json', import.meta.url),
    JSON.stringify(map, null, 2) + '\n',
  );
  console.log(`\n${Object.keys(map).length}/${species.size} 件のスプライトURLを保存しました`);
}

main();
