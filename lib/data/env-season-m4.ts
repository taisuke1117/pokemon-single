import { hydrateEnvEntry, type EnvSpeciesEntrySeed } from './hydrate';
import envReal from './generated/env-real.json';

/**
 * 環境データ（シーズンM-4、シングル）— 使用率ランキング上位235種の
 * 実データ（gamewith.jp、scripts/scrape-gamewith.ts で取得・
 * scripts/build-env-real.ts で変換）。
 *
 * gamewith.jp の robots.txt には AI/Claude系クローラーへの明示的な
 * 拒否記述が無く、ポリシー上の問題は無いと判断して取得している
 * （pokechamdb.com / champs.pokedb.tokyo は ClaudeBot を明示的に
 * 拒否しているため対象外にしている）。
 *
 * 使用率(%)そのものはgamewith側に公開されていないため rank（順位）のみ実データ。
 * 技・持ち物・特性・性格・努力値の採用率(%)は実際に公開されている数値をそのまま使う。
 *
 * データ更新: scripts/scrape-gamewith.ts → scripts/build-env-real.ts の順に再実行。
 */
const ENV_SEEDS = envReal as EnvSpeciesEntrySeed[];

export const ENV_SEASON_M4 = ENV_SEEDS.map(hydrateEnvEntry);

export function findEnvEntry(name: string) {
  return ENV_SEASON_M4.find((e) => e.name === name);
}

/** dex互換の英語種族IDで引く（表示名がメガ表記等で揺れても種族IDは一意なため確実）。 */
export function findEnvEntryBySpecies(species: string) {
  return ENV_SEASON_M4.find((e) => e.species === species);
}
