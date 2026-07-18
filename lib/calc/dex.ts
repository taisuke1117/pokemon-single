/**
 * チャンピオンズ用の種族データ（Dex）。
 *
 * 背景: 本家SV(gen9)にはメガシンカが無いため @pkmn/dex の gen9 データにも
 * メガが含まれない（検証済み: gen9 メガ0件）。チャンピオンズはメガを復活させたので、
 * 「gen9 の全種族 + gen7 の既存メガ + チャンピオンズ/Legends Z-A 由来の新規メガ」を
 * マージしてチャンピオンズ用の種族一覧を作る。
 *
 * 新規メガ（メガシビルドン等49種）は @pkmn/dex 0.10.11 で追加されたが、
 * `isNonstandard: "Future"` タグが付いており、`Generations.get(9)` 等の
 * gen別フィルタからは除外される。そのため `Dex.species.all()` の生データから
 * 直接拾う必要がある（検証済み: scripts/spike-newmega.ts）。
 *
 * さらに、チャンピオンズの実際のランキング(gamewith.jp)には
 * プテラ/カイロス/フーディン等、SV(gen9)の図鑑には無い過去世代の
 * 「メガと無関係な」通常ポケモンも多数含まれることが判明した
 * （scripts/match-unresolved-species.ts で種族値照合により検証）。
 * そのためメガに限らず、生Dexの全種族（CAP/Custom等の非公式データを除く）を
 * マージ対象にしている。
 *
 * ダメージ計算そのもの（lib/calc/damage.ts）は @smogon/calc が gen9 指定のまま
 * メガを解決できるため、この Dex は主に UI 検索・エンジンのスコアリング用。
 */
import { Dex } from '@pkmn/dex';
import { Generations, type Specie } from '@pkmn/data';

const gens = new Generations(Dex);
const gen9 = gens.get(9);
const gen7 = gens.get(7);

export interface ChampionsSpecies {
  id: string;
  name: string;
  types: readonly string[];
  baseStats: Specie['baseStats'];
  abilities: string[];
  isMega: boolean;
  /** メガの場合、必要なメガストーン名 */
  requiredItem?: string;
  /** メガの場合、ベースとなる通常フォルム名（例: Metagross-Mega → Metagross） */
  baseSpecies?: string;
}

function toChampionsSpecies(s: Specie, isMega: boolean): ChampionsSpecies {
  return {
    id: s.id,
    name: s.name,
    types: s.types,
    baseStats: s.baseStats,
    abilities: Object.values(s.abilities),
    isMega,
    requiredItem: (s as unknown as { requiredItem?: string }).requiredItem,
    baseSpecies: isMega ? s.baseSpecies : undefined,
  };
}

let cache: ChampionsSpecies[] | null = null;

/** チャンピオンズで使用しうる全種族（gen9 通常 + gen7 メガ + 新規メガ）を返す。 */
export function getChampionsSpecies(): ChampionsSpecies[] {
  if (cache) return cache;
  const list: ChampionsSpecies[] = [];
  const seen = new Set<string>();

  for (const s of gen9.species) {
    // gen9 に含まれるメガ亜種は現状無いが、念のため通常フォルムのみ採用
    list.push(toChampionsSpecies(s, false));
    seen.add(s.id);
  }
  for (const s of gen7.species) {
    if (!s.name.includes('-Mega') && !s.name.includes('-Primal')) continue;
    if (seen.has(s.id)) continue;
    // ベース種族が gen9 に存在するメガのみ採用（チャンピオンズの範囲に寄せる）
    const base = gen9.species.get(s.baseSpecies);
    if (!base) continue;
    list.push(toChampionsSpecies(s, true));
    seen.add(s.id);
  }
  // チャンピオンズ/Legends Z-A 由来の新規メガ（isNonstandard: "Future" タグ）。
  // Generations の gen フィルタを経由しない生データから直接拾う。
  //
  // 注意: ベース種族の存在確認は gen9(SV) ではなく生の Dex（gen非依存）で行う。
  // 例えばメガガメノデスのベース「バクガメス(Barbaracle)」は SV図鑑には
  // 含まれない(isNonstandard: "Past")が、チャンピオンズ独自ロースターの
  // 一部として新規メガ経由で復活している（検証済み）。gen9限定でベースを
  // 絞ると、こうした「メガで復活した過去世代ポケモン」を誤って除外してしまう。
  for (const s of Dex.species.all()) {
    if (s.isNonstandard !== 'Future' || !s.forme?.includes('Mega')) continue;
    if (seen.has(s.id)) continue;
    const base = Dex.species.get(s.baseSpecies);
    if (!base?.exists) continue;
    list.push(toChampionsSpecies(s as unknown as Specie, true));
    seen.add(s.id);
    // ベース種族（通常フォルム）が gen9 未収録なら合わせて追加する
    if (!seen.has(base.id)) {
      list.push(toChampionsSpecies(base as unknown as Specie, false));
      seen.add(base.id);
    }
  }
  // gen9(SV)図鑑に無い過去世代の通常種族（メガと無関係）も、
  // チャンピオンズでは実際に使用されているため取りこぼさないよう追加する。
  // CAP/Custom等の非公式・開発用データのみ除外する。
  const EXCLUDED_NONSTANDARD = new Set(['CAP', 'Custom', 'LGPE', 'Gigantamax']);
  for (const s of Dex.species.all()) {
    if (seen.has(s.id)) continue;
    if (!s.exists) continue;
    if (s.isNonstandard && EXCLUDED_NONSTANDARD.has(s.isNonstandard)) continue;
    if (s.forme?.includes('Mega')) continue; // メガは上の専用ロジックで処理済み
    list.push(toChampionsSpecies(s as unknown as Specie, false));
    seen.add(s.id);
  }
  cache = list;
  return list;
}

/** 名前 or ID から種族を引く（メガ含む）。 */
export function getSpecies(nameOrId: string): ChampionsSpecies | undefined {
  const id = nameOrId.toLowerCase().replace(/[^a-z0-9]/g, '');
  return getChampionsSpecies().find((s) => s.id === id);
}

/**
 * itemIdがいずれかのメガ種族の必須アイテム(メガストーン)と一致するか。
 * ベース種族のまま登録し持ち物だけメガストーンにしているケース（対戦中にメガシンカする想定）を
 * 検出するために使う（種族そのものをメガ形態として登録したケースは isMega で判定できるため対象外）。
 */
export function isMegaStoneItem(itemId: string | undefined): boolean {
  if (!itemId) return false;
  return getChampionsSpecies().some((s) => s.isMega && s.requiredItem === itemId);
}
