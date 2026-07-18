export type PokeType =
  | 'ノーマル'
  | 'ほのお'
  | 'みず'
  | 'でんき'
  | 'くさ'
  | 'こおり'
  | 'かくとう'
  | 'どく'
  | 'じめん'
  | 'ひこう'
  | 'エスパー'
  | 'むし'
  | 'いわ'
  | 'ゴースト'
  | 'ドラゴン'
  | 'あく'
  | 'はがね'
  | 'フェアリー';

export const TYPE_COLORS: Record<PokeType, string> = {
  ノーマル: '#9CA3AF',
  ほのお: '#FB7A3C',
  みず: '#38BDF8',
  でんき: '#F4CB3A',
  くさ: '#63C76A',
  こおり: '#7DD9E0',
  かくとう: '#C0524A',
  どく: '#A466C4',
  じめん: '#C9A24B',
  ひこう: '#8FB4E3',
  エスパー: '#EC6FA0',
  むし: '#96C23C',
  いわ: '#B8A369',
  ゴースト: '#6C6BB0',
  ドラゴン: '#7C6CF0',
  あく: '#6B7280',
  はがね: '#9FB4C7',
  フェアリー: '#F0A8C4',
};

export interface StatLine {
  h: number;
  a: number;
  b: number;
  c: number;
  d: number;
  s: number;
}

/**
 * ダメ計エンジン(@smogon/calc)に渡すための計算用スペック。
 * species/itemId/abilityId/natureId/moveIds は全て @pkmn/dex 互換の英語名。
 * 日本語の表示名は呼び出し側（PartyMember/EnvSpread）が別途保持する。
 */
export interface CalcSpec {
  species: string;
  itemId?: string;
  abilityId?: string;
  natureId: string;
  evs: Partial<StatLine>;
  /** 自パーティは常に指定。相手の傾向(EnvSpread)から動的に組み立てる場合は省略可 — 技は別途 EnvMoveUsage から渡す。 */
  moveIds?: string[];
  teraTypeId?: string;
}

export interface PartyMember {
  id: string;
  /** 表示名（日本語） */
  name: string;
  /** dexから導出される表示用タイプ */
  types: PokeType[];
  /** 表示用（日本語） */
  item: string;
  ability: string;
  nature: string;
  /** 実数値。hydratePartyMember() で calc から算出する */
  stats: StatLine;
  /** 表示用（日本語） */
  moves: string[];
  isMega?: boolean;
  /** ダメ計・素早さ比較に使う計算用スペック */
  calc: CalcSpec;
}

/**
 * 相手の「傾向」（持ち物・特性・性格・努力値の代表的な組み合わせ）。
 * 技はここに含めない — 30匹規模のキュレーションに耐えるよう、
 * 技は EnvMoveUsage としてポケモン単位でフラットに持つ設計にしている
 * （型ごとに4技をフルセットで手作業キュレーションするのはスケールしないため）。
 */
export interface EnvSpread {
  /** 傾向の呼び名（日本語。例:"アタッカー" "耐久型"） */
  name: string;
  prob: number;
  item: string;
  itemId?: string;
  ability: string;
  abilityId?: string;
  nature: string;
  natureId: string;
  evs: Partial<StatLine>;
  teraType?: PokeType;
  teraTypeId?: string;
}

/** 技1つ分の採用率エントリ。型を問わずポケモン全体での採用率として持つ。 */
export interface EnvMoveUsage {
  /** 表示用（日本語） */
  move: string;
  /** calc用（英語） */
  moveId: string;
  usage: number;
}

/**
 * 環境データ（シーズンごとの代表的な型キュレーション）1匹分のエントリ。
 *
 * usage(使用率%)は公開データソース(gamewith.jp)に存在しないため持たない
 * （無い数値を創作しないため）。実際に公開されている「順位」のみ rank として持つ。
 */
export interface EnvSpeciesEntry {
  /** 表示名（日本語） */
  name: string;
  /** dex互換の英語種族ID */
  species: string;
  types: PokeType[];
  /** 使用率ランキングでの順位（1が最上位）。実データがある場合のみ存在。 */
  rank?: number;
  /** 代表的な持ち物・特性・性格・努力値の傾向（1〜2個で十分） */
  spreads: EnvSpread[];
  /** 採用率の高い技トップ5〜8個（型を問わずフラットなリスト） */
  moveUsage: EnvMoveUsage[];
}

export interface OpponentSlot {
  id: string;
  query: string;
  resolvedName?: string;
  /** dex互換の英語種族ID（型推定・ダメ計に使う） */
  species?: string;
  types?: PokeType[];
  rank?: number;
  spreads?: EnvSpread[];
  moveUsage?: EnvMoveUsage[];
  /** 実戦で持ち物・技が判明済みか（型が1つに絞れている）。選出そのものの確定とは別概念。 */
  confirmed?: boolean;
  /**
   * 今回の対戦で実際に場に出たことがあるか（対戦中のみ意味を持つ）。
   * 相手6枠は対戦前のスカウティング入力であり、実際に selected されて場に出るまでは
   * 「相手が持っている可能性がある種族」に過ぎない。GTエンジン等で相手の残り枠を
   * 確定情報として扱ってよいかの判定に使う（未確定の枠を確定扱いして計算しないため）。
   */
  seenInBattle?: boolean;
}

export type Verdict = 'strong' | 'mild' | 'neutral' | 'mildRisk' | 'strongRisk';

export interface MatchupCell {
  verdict: Verdict;
  /** ヒートマップの強度ソート用（-100〜100） */
  score: number;
  atkRange: string;
  atkKo: string;
  defRange: string;
  defKo: string;
  speed: 'win' | 'lose' | 'tie50';
  note?: string;
}

export interface SelectionPick {
  memberId: string;
  role: '先発' | '後発';
  reasons: string[];
  watchOut: string[];
}

// ============================================================
// 対戦中リアルタイム支援（Phase 3）
// ============================================================

export type StatKey = 'a' | 'b' | 'c' | 'd' | 's';

/**
 * 場に出ているポケモン1匹分の「今の状態」。
 * 選出時点のPartyMember/OpponentSlotとは別に、対戦中に変化する値だけを持つ。
 */
export interface BattleParticipant {
  currentHpPercent: number; // 0-100
  status?: 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz';
  boosts: Partial<Record<StatKey, number>>; // -6..+6
  teraUsed: boolean;
  megaUsed: boolean;
  /** きあいのタスキ/ばけのかわ等、1度きりの効果を消費済みか */
  itemConsumed?: boolean;
  /** 身代わりの残HP%(本体maxhpに対する割合、0-100)。身代わりが場に無ければ undefined。 */
  subHpPercent?: number;
  /** ミミッキュの化けの皮が既に剥がれているか（剥がれ済みなら Mimikyu-Busted 相当で計算）。 */
  disguiseBusted?: boolean;
  /** こだわり系/アンコール等で技が縛られている場合の技ID。合法手列挙でこの技のみに絞る。 */
  choiceLockedMoveId?: string;
  /** 交代不可（ありじごく/かげふみ/くろいまなざし等）。UIの控えボタン活性/非活性の表示用。 */
  trapped?: boolean;
  /** 相手について、実際に使われたのを確認した技(moveId)。自分は常に手持ち4技全て使える。 */
  revealedMoveIds: string[];
  /** 判明した持ち物/特性/性格/努力値/テラスタイプ（手動入力）。設定されていれば代表スプレッドより優先する。 */
  revealedItemId?: string;
  revealedAbilityId?: string;
  revealedNatureId?: string;
  revealedEvs?: Partial<StatLine>;
  revealedTeraTypeId?: string;
}

export function createBattleParticipant(): BattleParticipant {
  return {
    currentHpPercent: 100,
    boosts: {},
    teraUsed: false,
    megaUsed: false,
    revealedMoveIds: [],
  };
}

/** 場1面分の設置技・壁・追い風などの状態。 */
export interface SideConditions {
  spikes: number; // 0-3
  isSR: boolean;
  isReflect: boolean;
  isLightScreen: boolean;
  isAuroraVeil: boolean;
  isTailwind: boolean;
}

export function createSideConditions(): SideConditions {
  return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false };
}

export interface BattleFieldState {
  weather?: 'Sand' | 'Sun' | 'Rain' | 'Snow';
  terrain?: 'Electric' | 'Grassy' | 'Psychic' | 'Misty';
  /** @smogon/calcのFieldには存在しないため、速度比較の自前ロジック側で反転させる。 */
  isTrickRoom: boolean;
  selfSide: SideConditions;
  oppSide: SideConditions;
}

export function createBattleFieldState(): BattleFieldState {
  return { isTrickRoom: false, selfSide: createSideConditions(), oppSide: createSideConditions() };
}

/**
 * 技を使った結果の観測記録（推定エンジンへの入力）。
 *
 * selfMemberId/oppSlotIdは、自分の場のポケモン・相手の場のポケモンが対戦中に
 * 入れ替わっても後から正しく紐付けられるよう、観測時点でどちらが場に居たかを記録する
 * （推定エンジンは特定の相手の枠(oppSlotId)に対する観測だけを集めて絞り込む必要があるため）。
 */
export interface MoveObservation {
  turn: number;
  attackerSide: 'self' | 'opponent';
  moveId: string;
  wasCrit: boolean;
  /** 技を受けた側の、命中前のHP%。 */
  defenderHpPercentBefore: number;
  /** 技を受けた側の、命中後のHP%。 */
  defenderHpPercentAfter: number;
  /** 追加効果が確率発動系の技だった場合、発動したか。 */
  secondaryEffectProcced?: boolean;
  selfMemberId: string;
  oppSlotId: string;
}

export interface BattleState {
  turn: number;
  /** 選出した3匹のうち、今場に出ているPartyMember.id */
  selfActiveMemberId: string;
  /** 今場に出ているOpponentSlot.id */
  oppActiveSlotId: string;
  self: Record<string, BattleParticipant>;
  opponent: Record<string, BattleParticipant>;
  field: BattleFieldState;
  observations: MoveObservation[];
}
