/**
 * チャンピオンズ用ダメージ計算アダプタ。
 * @smogon/calc(gen9) をラップし、エンジン層が使いやすい形へ整える。
 * メガは gen9 指定のまま @smogon/calc が解決できる（検証済み）。
 */
import {
  Generations,
  Pokemon,
  Move,
  Field,
  calculate,
  type StatsTable,
} from '@smogon/calc';

const gen = Generations.get(9);

export interface PokemonSpec {
  species: string;
  level?: number; // 既定 50（チャンピオンズはレベル50固定想定）
  item?: string;
  ability?: string;
  nature?: string;
  evs?: Partial<StatsTable>;
  ivs?: Partial<StatsTable>;
  boosts?: Partial<StatsTable>;
  teraType?: string;
  status?: 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz';
  /** 現在HP%（0-100）。対戦中の実HPを反映したKO判定に使う。省略時は満タン扱い。 */
  currentHpPercent?: number;
  /**
   * みずびたし/リフレクタイプ等でタイプが変化している場合の上書き。未指定ならspeciesの
   * 本来のタイプのまま（@smogon/calcはコンストラクタにtypesを渡せないため構築後に直接代入する）。
   */
  types?: [string] | [string, string];
}

export interface DamageResult {
  /** @smogon/calc の説明文（例: "252 Atk Garchomp Earthquake vs. ..."） */
  desc: string;
  minDamage: number;
  maxDamage: number;
  /** 相手最大HPに対する割合(%) */
  minPct: number;
  maxPct: number;
  /** 確定n発 / 乱数n発 等の説明（@smogon/calc の英語文言） */
  koText: string;
  /** そのn発でのKO確率(0-1)。確定なら1 */
  koChance: number;
  /** 何発でKOに至るか（不明な場合 undefined） */
  koHits?: number;
}

function toPokemon(spec: PokemonSpec): Pokemon {
  // types直接代入は@smogon/calc内部のcalculate()がdefender.clone()を経由するため反映されない
  // （clone()はoverrides:this.speciesのみ引き継ぎ、後付けのtypes代入はコンストラクタを通らないと
  // 失われる。実測確認済み）。overridesオプション（species定義への差分マージ）で渡すことで、
  // clone()を経ても正しく引き継がれる。
  const options = {
    level: spec.level ?? 50,
    item: spec.item,
    ability: spec.ability,
    nature: spec.nature,
    evs: spec.evs,
    ivs: spec.ivs,
    boosts: spec.boosts,
    teraType: spec.teraType as never,
    status: spec.status,
    overrides: spec.types ? ({ types: spec.types } as never) : undefined,
  };
  const base = new Pokemon(gen, spec.species, options);
  if (spec.currentHpPercent === undefined || spec.currentHpPercent >= 100) return base;
  const curHP = Math.max(1, Math.round((base.maxHP() * spec.currentHpPercent) / 100));
  return new Pokemon(gen, spec.species, { ...options, curHP });
}

/** 設置技・壁・追い風など、場の片側1面分の状態。 */
export interface SideConditionsSpec {
  spikes?: number;
  isSR?: boolean;
  isReflect?: boolean;
  isLightScreen?: boolean;
  isAuroraVeil?: boolean;
  isTailwind?: boolean;
}

/**
 * @smogon/calc の Field は attackerSide/defenderSide という「技を撃つ側から見た」
 * 攻撃方向依存の構造を持つ（selfSide/oppSide のような固定した向きではない）。
 * そのため本アダプタも同じ命名で受け取り、呼び出し側（エンジン層）で
 * 「今どちらが攻撃しているか」に応じて自陣/相手陣営を正しく組み替えて渡す責務を持つ。
 */
export interface FieldSpec {
  weather?: 'Sand' | 'Sun' | 'Rain' | 'Snow';
  terrain?: 'Electric' | 'Grassy' | 'Psychic' | 'Misty';
  attackerSide?: SideConditionsSpec;
  defenderSide?: SideConditionsSpec;
}

export interface CalcOptions {
  /** 急所だった場合の再現用（推定エンジンが観測値を急所抜きの値へ正規化する際に使う）。 */
  isCrit?: boolean;
}

/** 1回のダメージ計算。攻撃側 spec の技 moveName で防御側を殴る。 */
export function calcDamage(
  attacker: PokemonSpec,
  defender: PokemonSpec,
  moveName: string,
  field?: FieldSpec,
  options?: CalcOptions,
): DamageResult {
  const atk = toPokemon(attacker);
  const def = toPokemon(defender);
  const move = new Move(gen, moveName, { isCrit: options?.isCrit ?? false });
  const f = field
    ? new Field({
        weather: field.weather,
        terrain: field.terrain,
        attackerSide: field.attackerSide,
        defenderSide: field.defenderSide,
      })
    : undefined;
  const result = calculate(gen, atk, def, move, f);

  const range = result.range(); // [min, max]
  const maxHP = def.maxHP();
  const ko = result.kochance();

  return {
    desc: result.desc(),
    minDamage: range[0],
    maxDamage: range[1],
    minPct: round1((range[0] / maxHP) * 100),
    maxPct: round1((range[1] / maxHP) * 100),
    koText: ko.text ?? '',
    koChance: ko.chance ?? (range[0] >= maxHP ? 1 : 0),
    koHits: ko.n,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 実数値（ステータス）を取得。素早さ比較などに使う。 */
export function getStats(spec: PokemonSpec): StatsTable {
  return toPokemon(spec).stats;
}
