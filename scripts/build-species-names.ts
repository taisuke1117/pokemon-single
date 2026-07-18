/**
 * 種族名(@pkmn/dex互換の英語名) -> 日本語表示名 の対応表を構築する。
 *
 * PokeAPIの pokemon-species エンドポイントには names[] (言語別名称) が含まれており、
 * ja-Hrkt(ひらがな/カタカナ) or ja(漢字) で日本語名が取れる。
 * ただしメガフォルムは「種族」としては別扱いされず、ベース種族の名前しか
 * 得られないため、メガ名は「メガ」+ベース名 という確立された命名規則
 * （メガリザードン等、例外なく成立する）で組み立てる。
 *
 * 実行: npx tsx scripts/build-species-names.ts
 */
import { writeFileSync } from 'node:fs';
import { getChampionsSpecies } from '../lib/calc/dex.ts';

interface PokeApiSpeciesName {
  name: string;
  language: { name: string };
}

const cache = new Map<string, string | null>();

async function fetchJaName(speciesSlug: string): Promise<string | null> {
  if (cache.has(speciesSlug)) return cache.get(speciesSlug)!;
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesSlug}`);
  if (!res.ok) {
    cache.set(speciesSlug, null);
    return null;
  }
  const data = await res.json();
  const names: PokeApiSpeciesName[] = data.names ?? [];
  const ja = names.find((n) => n.language.name === 'ja-Hrkt') ?? names.find((n) => n.language.name === 'ja');
  const result = ja?.name ?? null;
  cache.set(speciesSlug, result);
  return result;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function main() {
  const all = getChampionsSpecies();
  const result: Record<string, string> = {};
  let done = 0;
  let missing = 0;

  for (const s of all) {
    const baseSlug = s.isMega && s.baseSpecies ? toSlug(s.baseSpecies) : toSlug(s.name);
    const baseJa = await fetchJaName(baseSlug);
    if (baseJa) {
      // "Charizard-Mega-X" のような接尾辞(-X/-Y/-Z等)を末尾に反映する
      const suffixMatch = s.name.match(/-Mega-(.+)$/);
      const suffix = suffixMatch ? suffixMatch[1] : '';
      result[s.name] = s.isMega ? `メガ${baseJa}${suffix}` : baseJa;
    } else {
      missing++;
    }
    done++;
    if (done % 100 === 0) console.log(`${done}/${all.length} (missing: ${missing})`);
  }

  console.log(`完了: ${Object.keys(result).length}/${all.length} 件（missing: ${missing}）`);
  writeFileSync(
    new URL('../lib/data/generated/species-ja.json', import.meta.url),
    JSON.stringify(result, null, 0),
  );
}

main();
