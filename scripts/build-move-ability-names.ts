/**
 * 技・特性の英語名 -> 日本語表示名 の完全な対応表を PokeAPI から構築する。
 * 全970種の完全な習得技リスト(full-dex.json)から使われている技・特性を
 * 全て抽出し、それぞれ PokeAPI の /move/{slug} /ability/{slug} から
 * 日本語名(names[].language.name === 'ja' or 'ja-Hrkt')を取得してキャッシュする。
 *
 * 実行: npx tsx scripts/build-move-ability-names.ts
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import fullDex from '../lib/data/generated/full-dex.json' with { type: 'json' };

function loadExisting(path: URL): Record<string, string> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}

interface PokeApiName {
  name: string;
  language: { name: string };
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function fetchJaName(kind: 'move' | 'ability', slug: string): Promise<string | null> {
  const res = await fetch(`https://pokeapi.co/api/v2/${kind}/${slug}`);
  if (!res.ok) return null;
  const data = await res.json();
  const names: PokeApiName[] = data.names ?? [];
  const ja = names.find((n) => n.language.name === 'ja-Hrkt') ?? names.find((n) => n.language.name === 'ja');
  return ja?.name ?? null;
}

async function buildDict(
  kind: 'move' | 'ability',
  names: string[],
  existing: Record<string, string>,
): Promise<Record<string, string>> {
  const result: Record<string, string> = { ...existing };
  const todo = names.filter((n) => !(n in result));
  console.log(`[${kind}] 既存${Object.keys(existing).length}件、新規取得対象${todo.length}件`);
  let done = 0;
  let missing = 0;
  for (const name of todo) {
    const ja = await fetchJaName(kind, toSlug(name));
    if (ja) {
      result[name] = ja;
    } else {
      missing++;
    }
    done++;
    if (done % 100 === 0) console.log(`[${kind}] ${done}/${todo.length} (missing: ${missing})`);
  }
  console.log(`[${kind}] 完了: ${Object.keys(result).length}/${names.length} 件（今回missing: ${missing}）`);
  return result;
}

async function main() {
  const moveSet = new Set<string>();
  const abilitySet = new Set<string>();
  for (const e of fullDex as { moves: string[]; abilities: string[] }[]) {
    for (const m of e.moves) moveSet.add(m);
    for (const a of e.abilities) abilitySet.add(a);
  }

  const moveUrl = new URL('../lib/data/generated/move-ja-full.json', import.meta.url);
  const abilityUrl = new URL('../lib/data/generated/ability-ja-full.json', import.meta.url);

  const moveDict = await buildDict('move', [...moveSet], loadExisting(moveUrl));
  writeFileSync(moveUrl, JSON.stringify(moveDict));

  const abilityDict = await buildDict('ability', [...abilitySet], loadExisting(abilityUrl));
  writeFileSync(abilityUrl, JSON.stringify(abilityDict));
}

main();
