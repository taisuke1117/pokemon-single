/**
 * チャンピオンズで使用しうる全種族（約950種、gen9通常+旧メガ+新規メガ）について、
 * 「完全な習得技リスト」と「完全な特性リスト」を構築し、JSONにキャッシュする。
 *
 * 使用率(%)は実データが無いため今回は含めない（技・特性の完全なカタログのみ）。
 * メガフォルムは種族としての学習セットを持たないことが多いため、
 * ベースフォルム（例: Metagross-Mega -> Metagross）の習得技を引き継ぐ。
 *
 * 実行: npx tsx scripts/build-full-dex.ts
 */
import { writeFileSync } from 'node:fs';
import { Dex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';
import { getChampionsSpecies } from '../lib/calc/dex.ts';

const gens = new Generations(Dex);
const gen9 = gens.get(9);

export interface FullDexEntry {
  species: string;
  types: readonly string[];
  abilities: string[];
  isMega: boolean;
  /** 完全な習得技リスト（英語ID）。学習不能/取得失敗の場合は空配列。 */
  moves: string[];
}

async function learnableMoves(speciesName: string): Promise<string[]> {
  try {
    // learnable() は「gen9で現在合法か」の制限がかかり、過去世代限定のポケモンが
    // 軒並み空になってしまう（検証済み: Aegislash等412種）。
    // get().learnset は世代制限なしの生の習得技データなのでこちらを使う。
    const raw = await gen9.learnsets.get(speciesName);
    const moveIds = Object.keys(raw?.learnset ?? {});
    return moveIds.map((id) => gen9.moves.get(id)?.name).filter((n): n is string => Boolean(n));
  } catch {
    return [];
  }
}

async function main() {
  const all = getChampionsSpecies();
  const bySpeciesName = new Map(all.map((s) => [s.name, s]));
  const result: FullDexEntry[] = [];
  let done = 0;

  for (const s of all) {
    // メガは自身の学習セットを持たないことが多いのでベースフォルムを使う
    const lookupName = s.isMega && s.baseSpecies ? s.baseSpecies : s.name;
    const moves = await learnableMoves(lookupName);
    result.push({
      species: s.name,
      types: s.types,
      abilities: s.abilities,
      isMega: s.isMega,
      moves,
    });
    done++;
    if (done % 100 === 0) console.log(`${done}/${all.length}`);
  }

  const zeroMoveCount = result.filter((r) => r.moves.length === 0).length;
  console.log(`完了: ${result.length}種 (技0件: ${zeroMoveCount}種)`);

  writeFileSync(
    new URL('../lib/data/generated/full-dex.json', import.meta.url),
    JSON.stringify(result),
  );
}

main();
