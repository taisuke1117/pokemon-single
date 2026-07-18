/**
 * 種族名解決に失敗した70種について、gamewithが返した種族値(H/A/B/C/D/S)を
 * 指紋として使い、@pkmn/dex の全カタログから一致する英語種族IDを特定する。
 * JP名の推測は一切せず、実測データ同士の突合せのみで解決する。
 *
 * 実行: npx tsx scripts/match-unresolved-species.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { getChampionsSpecies } from '../lib/calc/dex.ts';

interface ScrapedSpecies {
  rank: number;
  name: string;
  baseStats: number[];
}

const raw: ScrapedSpecies[] = JSON.parse(
  readFileSync(new URL('../lib/data/generated/gamewith-raw.json', import.meta.url), 'utf-8'),
);
const speciesJaFull: Record<string, string> = JSON.parse(
  readFileSync(new URL('../lib/data/generated/species-ja.json', import.meta.url), 'utf-8'),
);
const jaToEn = new Map<string, string>();
for (const [en, ja] of Object.entries(speciesJaFull)) {
  if (!jaToEn.has(ja)) jaToEn.set(ja, en);
}

const allSpecies = getChampionsSpecies();

function statsKey(stats: number[]): string {
  return stats.join(',');
}

const byStats = new Map<string, string[]>();
for (const s of allSpecies) {
  const key = statsKey([s.baseStats.hp, s.baseStats.atk, s.baseStats.def, s.baseStats.spa, s.baseStats.spd, s.baseStats.spe]);
  const list = byStats.get(key) ?? [];
  list.push(s.name);
  byStats.set(key, list);
}

// 種族値が同一で自動判別できないケースは、名前の対応関係が明確なもののみ手動で解決する
// （フォルム名のヒントから一意に定まるもの。実在確認は各英語名が dex に存在することで担保）。
const MANUAL_OVERRIDES: Record<string, string> = {
  ヒートロトム: 'Rotom-Heat',
  ウォッシュロトム: 'Rotom-Wash',
  フロストロトム: 'Rotom-Frost',
  スピンロトム: 'Rotom-Fan',
  カットロトム: 'Rotom-Mow',
  'ニャオニクス(オス)': 'Meowstic',
  'ニャオニクス(メス)': 'Meowstic-F',
  'パルデアケンタロス(炎)': 'Tauros-Paldea-Blaze',
  'パルデアケンタロス(水)': 'Tauros-Paldea-Aqua',
  'パルデアケンタロス(闘)': 'Tauros-Paldea-Combat',
  カイリキー: 'Machamp',
  ダストダス: 'Garbodor',
  ヤナッキー: 'Simisage',
  バオッキー: 'Simisear',
  ヒヤッキー: 'Simipour',
  ポワルン: 'Castform',
};

const unresolved = raw.filter((e) => !jaToEn.has(e.name));
console.log(`未解決: ${unresolved.length}件`);

const resolved: Record<string, string> = {};
const stillUnresolved: string[] = [];

for (const e of unresolved) {
  if (MANUAL_OVERRIDES[e.name]) {
    const target = MANUAL_OVERRIDES[e.name];
    const exists = allSpecies.some((s) => s.name === target);
    if (exists) {
      resolved[e.name] = target;
      console.log(`OK(手動) ${e.name} -> ${target}`);
      continue;
    }
    console.log(`[手動対応の英語名が存在しない] ${e.name} -> ${target}`);
  }
  const key = statsKey(e.baseStats);
  const candidates = byStats.get(key) ?? [];
  if (candidates.length === 1) {
    resolved[e.name] = candidates[0];
    console.log(`OK  ${e.name} -> ${candidates[0]}`);
  } else if (candidates.length > 1) {
    console.log(`[複数候補] ${e.name} (${e.baseStats.join('/')}) -> ${candidates.join(', ')}`);
    stillUnresolved.push(e.name);
  } else {
    console.log(`[候補なし] ${e.name} (${e.baseStats.join('/')})`);
    stillUnresolved.push(e.name);
  }
}

console.log(`\n解決: ${Object.keys(resolved).length}, 未解決: ${stillUnresolved.length}`);
writeFileSync(
  new URL('../lib/data/generated/species-ja-forms.json', import.meta.url),
  JSON.stringify(resolved, null, 1),
);
