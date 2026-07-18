/**
 * gamewith.jp から取得した実使用率データ(gamewith-raw.json)を、
 * アプリの EnvSpeciesEntrySeed 形式（calc用の英語ID込み）に変換する。
 *
 * 使用率(%)は実際に公開されているデータをそのまま使う（創作しない）。
 * 種族の「使用率ランキング全体の%」はgamewith側に存在しないため rank のみ持つ。
 *
 * メガシンカの扱い: gamewithは「進化前の種族名・特性」で表示しつつ、
 * 実戦ではメガストーンを持って戦う場合が大半（例:メタグロス→メタグロスナイト98.2%）。
 * この場合は species を対応するメガ種族IDにリダイレクトし、特性はメガの
 * 固定特性（複数候補が無い）で上書きする（メガシンカ後の実際の特性が
 * 常に1つに定まるため、進化前の特性採用率データはこの場合意味を持たない）。
 *
 * 実行: npx tsx scripts/build-env-real.ts
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { getChampionsSpecies } from '../lib/calc/dex.ts';
import { NATURES } from '../lib/data/nature-ja.ts';
import type { EnvSpread, EnvMoveUsage, StatLine } from '../lib/types.ts';

interface ScrapedSpecies {
  rank: number;
  name: string;
  baseStats: number[];
  abilities: { name: string; pct: number }[];
  moves: { name: string; pct: number }[];
  items: { name: string; pct: number }[];
  natures: { name: string; pct: number }[];
  evSpreads: { values: number[]; pct: number }[];
}

interface EnvSpeciesEntrySeedOut {
  name: string;
  species: string;
  rank: number;
  spreads: EnvSpread[];
  moveUsage: EnvMoveUsage[];
}

const raw: ScrapedSpecies[] = JSON.parse(
  readFileSync(new URL('../lib/data/generated/gamewith-raw.json', import.meta.url), 'utf-8'),
);
const moveJaFull: Record<string, string> = JSON.parse(
  readFileSync(new URL('../lib/data/generated/move-ja-full.json', import.meta.url), 'utf-8'),
);
const abilityJaFull: Record<string, string> = JSON.parse(
  readFileSync(new URL('../lib/data/generated/ability-ja-full.json', import.meta.url), 'utf-8'),
);
const itemJaFull: Record<string, string> = JSON.parse(
  readFileSync(new URL('../lib/data/generated/item-ja-full.json', import.meta.url), 'utf-8'),
);
const speciesJaFull: Record<string, string> = JSON.parse(
  readFileSync(new URL('../lib/data/generated/species-ja.json', import.meta.url), 'utf-8'),
);
// フォルム違い等、種族値の指紋照合や手動対応で解決した追加分（scripts/match-unresolved-species.ts）
const speciesJaForms: Record<string, string> = JSON.parse(
  readFileSync(new URL('../lib/data/generated/species-ja-forms.json', import.meta.url), 'utf-8'),
);

/** 全角数字を半角に正規化する（gamewith表記とPokeAPI表記のゆれを吸収）。 */
function normalizeDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

function invert(map: Record<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [en, ja] of Object.entries(map)) {
    const key = normalizeDigits(ja);
    if (!out.has(key)) out.set(key, en); // 先勝ち（複数の英語名が同じ日本語名に変換されるケースの衝突回避）
  }
  return out;
}

// PokeAPI側のスラッグ不一致等で自動取得できなかった技（実在確認済み、WebSearchで確認）
const MOVE_MANUAL_OVERRIDES: Record<string, string> = {
  もえつきる: 'Burn Up',
  キングシールド: "King's Shield",
  はめつのひかり: 'Doom Desire',
  DDラリアット: 'Darkest Lariat',
  やまあらし: 'Storm Throw',
  Gのちから: 'Grav Apple',
  トラバサミ: 'Snap Trap',
};

const jaToEnMove = invert(moveJaFull);
for (const [ja, en] of Object.entries(MOVE_MANUAL_OVERRIDES)) {
  if (!jaToEnMove.has(ja)) jaToEnMove.set(ja, en);
}
const jaToEnAbility = invert(abilityJaFull);
const ITEM_MANUAL_OVERRIDES: Record<string, string> = {
  ようせいのハネ: 'Fairy Feather',
  // フラエッテ(永遠)はコスメティックフォルムでベース種族が"Floette-Eternal"扱いのため、
  // メガ候補検索(baseSpecies==="Floette")と噛み合わずここだけ手動対応する
  フラエッテナイト: 'Floettite',
};
const jaToEnItem = invert(itemJaFull);
for (const [ja, en] of Object.entries(ITEM_MANUAL_OVERRIDES)) {
  if (!jaToEnItem.has(ja)) jaToEnItem.set(ja, en);
}
const jaToEnSpecies = invert(speciesJaFull);
for (const [ja, en] of Object.entries(speciesJaForms)) {
  if (!jaToEnSpecies.has(ja)) jaToEnSpecies.set(ja, en);
}
const jaToEnNature = new Map(NATURES.map((n) => [n.nature, n.natureId]));

const allSpecies = getChampionsSpecies();
const bySpeciesName = new Map(allSpecies.map((s) => [s.name, s]));

function findMegaVariants(baseEnName: string) {
  return allSpecies.filter((s) => s.isMega && s.baseSpecies === baseEnName);
}

/**
 * リザードンのようにメガが複数(X/Y等)ある種族では、スクレイピングされた
 * 持ち物名の末尾(X/Y/Z)がどのメガに対応するか名前から判定する。
 * 候補が1つしか無ければそれを、複数あってサフィックスで判別できなければ先頭を返す。
 */
function pickMegaForItem(candidates: ReturnType<typeof findMegaVariants>, itemNameJa: string) {
  if (candidates.length <= 1) return candidates[0];
  const suffixMatch = itemNameJa.match(/([XYZ])$/);
  if (suffixMatch) {
    const bySuffix = candidates.find((c) => c.name.endsWith(`-${suffixMatch[1]}`));
    if (bySuffix) return bySuffix;
  }
  return candidates[0];
}

const evKeys: (keyof StatLine)[] = ['h', 'a', 'b', 'c', 'd', 's'];

function evsFromValues(values: number[]): Partial<StatLine> {
  const out: Partial<StatLine> = {};
  evKeys.forEach((k, i) => {
    if (values[i] > 0) out[k] = values[i];
  });
  return out;
}

// 事前パス: 全エントリの持ち物一覧を見て、末尾が「ナイト」のメガストーン名を
// 種族の文脈（ベース種族が持つメガ候補、複数あればX/Y/Z等のサフィックスで判別）
// から機械的に学習する。@pkmn/dexの item リストに新規メガのストーンが
// 存在しないため、辞書に無くても構造的事実だけで解決できるようにする。
for (const entry of raw) {
  const baseEnName = jaToEnSpecies.get(entry.name);
  if (!baseEnName) continue;
  const megaCandidates = findMegaVariants(baseEnName);
  if (megaCandidates.length === 0) continue;
  for (const item of entry.items) {
    const key = normalizeDigits(item.name);
    if (jaToEnItem.has(key) || !item.name.includes('ナイト')) continue;
    const mega = pickMegaForItem(megaCandidates, item.name);
    if (mega?.requiredItem) jaToEnItem.set(key, mega.requiredItem);
  }
}

let unmatchedSpecies = 0;
let unmatchedMoves = 0;
let unmatchedItems = 0;
let unmatchedAbilities = 0;
let megaRedirects = 0;

const result: EnvSpeciesEntrySeedOut[] = [];

for (const entry of raw) {
  const baseEnName = jaToEnSpecies.get(entry.name);
  if (!baseEnName) {
    unmatchedSpecies++;
    console.log(`[種族未一致] ${entry.rank}位 ${entry.name}`);
    continue;
  }

  let speciesEnName = baseEnName;
  let abilityOverride: string | undefined;

  const topItem = entry.items[0];
  if (topItem && topItem.pct > 50 && topItem.name.includes('ナイト')) {
    const mega = pickMegaForItem(findMegaVariants(baseEnName), topItem.name);
    if (mega) {
      speciesEnName = mega.name;
      abilityOverride = mega.abilities[0]; // メガは特性が1つに固定される
      megaRedirects++;
    }
  }

  // 持ち物: 上位2つを代表スプレッドの候補にする（1つしか無ければ1つ）
  const topItems = entry.items.slice(0, 2).filter((i) => i.pct > 5);
  const topNature = entry.natures[0];
  const topEv = entry.evSpreads[0];

  if (!topNature || !topEv || topItems.length === 0) {
    console.log(`[データ不足] ${entry.rank}位 ${entry.name}: nature=${!!topNature} ev=${!!topEv} items=${topItems.length}`);
    continue;
  }

  const natureId = jaToEnNature.get(normalizeDigits(topNature.name));
  if (!natureId) {
    console.log(`[性格未一致] ${entry.rank}位 ${entry.name}: ${topNature.name}`);
    continue;
  }

  const spreads: EnvSpread[] = topItems.map((item, i) => {
    const itemId = jaToEnItem.get(normalizeDigits(item.name));
    if (!itemId) unmatchedItems++;
    const abilityJa = abilityOverride ? abilityJaFull[abilityOverride] : entry.abilities[0]?.name;
    const abilityId =
      abilityOverride ?? (entry.abilities[0] ? jaToEnAbility.get(normalizeDigits(entry.abilities[0].name)) : undefined);
    if (!abilityId) unmatchedAbilities++;
    return {
      name: i === 0 ? '主流' : '準主流',
      prob: item.pct / 100,
      item: item.name,
      itemId,
      ability: abilityJa ?? '',
      abilityId,
      nature: topNature.name,
      natureId,
      evs: evsFromValues(topEv.values),
    };
  });

  const moveUsage: EnvMoveUsage[] = entry.moves
    .map((m) => {
      const moveId = jaToEnMove.get(normalizeDigits(m.name));
      if (!moveId) unmatchedMoves++;
      return moveId ? { move: m.name, moveId, usage: m.pct / 100 } : null;
    })
    .filter((m): m is EnvMoveUsage => m !== null);

  result.push({
    name: entry.name,
    species: speciesEnName,
    rank: entry.rank,
    spreads,
    moveUsage,
  });
}

console.log(`変換完了: ${result.length}/${raw.length} 件`);
console.log(`種族未一致: ${unmatchedSpecies}, メガリダイレクト: ${megaRedirects}`);
console.log(`未一致 技:${unmatchedMoves} 持ち物:${unmatchedItems} 特性:${unmatchedAbilities}`);

writeFileSync(new URL('../lib/data/generated/env-real.json', import.meta.url), JSON.stringify(result, null, 0));
