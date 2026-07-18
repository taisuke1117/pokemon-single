/**
 * PokeAPI の全アイテムカタログから 英語名 -> 日本語名 の完全な対応表を構築する。
 * gamewith.jpから取得する実使用率データの持ち物名(日本語)をcalc用の英語IDへ
 * 逆引きするために必要（このファイル自体はEN->JAだが、利用側でJA->ENの
 * 逆引きマップを作る）。
 *
 * 実行: npx tsx scripts/build-item-names.ts
 */
import { writeFileSync } from 'node:fs';

interface PokeApiName {
  name: string;
  language: { name: string };
}

async function fetchJaName(slug: string): Promise<string | null> {
  const res = await fetch(`https://pokeapi.co/api/v2/item/${slug}`);
  if (!res.ok) return null;
  const data = await res.json();
  const names: PokeApiName[] = data.names ?? [];
  const ja = names.find((n) => n.language.name === 'ja-Hrkt') ?? names.find((n) => n.language.name === 'ja');
  return ja?.name ?? null;
}

async function main() {
  const listRes = await fetch('https://pokeapi.co/api/v2/item?limit=2000');
  const listData = await listRes.json();
  const items: { name: string }[] = listData.results;
  console.log(`アイテム総数: ${items.length}`);

  const result: Record<string, string> = {};
  let done = 0;
  let missing = 0;
  for (const item of items) {
    const ja = await fetchJaName(item.name);
    if (ja) {
      // キーはEnglishのdisplay形式(Title Case + 半角スペース)に寄せる
      const enDisplay = item.name
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      result[enDisplay] = ja;
    } else {
      missing++;
    }
    done++;
    if (done % 200 === 0) {
      console.log(`${done}/${items.length} (missing: ${missing})`);
      writeFileSync(new URL('../lib/data/generated/item-ja-full.json', import.meta.url), JSON.stringify(result));
    }
  }

  writeFileSync(new URL('../lib/data/generated/item-ja-full.json', import.meta.url), JSON.stringify(result));
  console.log(`完了: ${Object.keys(result).length}/${items.length} 件（missing: ${missing}）`);
}

main();
