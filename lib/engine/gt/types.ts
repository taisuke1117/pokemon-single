/**
 * ゲーム理論エンジン(lib/engine/gt/)の共通型。
 *
 * このエンジンは「利得行列(自分の手×相手の手)を @pkmn/sim でターン解決して評価関数で採点し、
 * マキシミン/ナッシュ均衡/相手モデルへの最適応答で解く」ためのもの。
 * 既存の簡易ヒューリスティック(lib/engine/matchup.ts, battle.ts)とは独立に lib/engine/gt/ に隔離する。
 */
import type { CalcSpec, StatKey } from '../../types';

/** 1つの合法手。技×{通常/メガ/テラス}、または交代。 */
export type GtAction =
  | { kind: 'move'; moveId: string; mega?: boolean; terastallize?: boolean }
  | { kind: 'switch'; toIndex: number };

/** 行動の表示用ラベル（UI・デバッグ用）。 */
export interface GtActionLabel {
  action: GtAction;
  label: string; // 日本語表示（moveJa等で変換済み）
}

/**
 * 評価関数の入力となる軽量スナップショット。
 * @pkmn/sim の Battle から1回だけ変換して作る（各評価要素が @pkmn/sim に依存しないようにするため）。
 */
export interface ResolvedPokemon {
  /** 自分は PartyMember.id、相手は OpponentSlot.id（対応が取れる場合）。取れなければ species を使う。 */
  refId: string;
  species: string;
  types: string[];
  hpPercent: number; // 0-100, 0=瀕死
  status?: string; // 'brn' | 'par' | ... | '' (@pkmn/simのStatusName)
  boosts: Partial<Record<StatKey, number>>;
  isActive: boolean;
  /** 自分は確定した手持ち技、相手はEnvMoveUsage採用率上位（判明技があればそれも含む）。 */
  moveIds: string[];
  /**
   * ダメージ計算用の元スペック（対面の脅威・引き先・勝ち筋の各要素が @smogon/calc で使う）。
   * 相手はEnvSpreadから合成した代表型。メガは代表形(例:Metagross-Mega)のまま持つ
   * （既存matchup.tsと同じ扱い。未メガ状態との差はこの最小版では区別しない=既知の簡略化）。
   */
  calc: CalcSpec;
  /**
   * この個体が実際に相手の選出に含まれている確率（0-1）。
   * 自分は常に1、相手も対戦中に場に出た(seenInBattle)個体は1。
   * 相手の残り枠でまだ場に出ていない「候補」(6枠スカウティングのうち未確定分)は、
   * 使用率(rank)から推定した1未満の値になる。物量評価・行列セルの重み付けに使う。
   */
  existProbability: number;
  /** 身代わりの残HP%（本体maxhpに対する割合, 0-100）。場に身代わりが無ければ undefined。 */
  subHpPercent?: number;
  /** ミミッキュの化けの皮が剥がれ済みか（剥がれていれば実質 Mimikyu-Busted）。 */
  disguiseBusted?: boolean;
  /** こだわり系等で縛られている技ID（あれば合法手・脅威計算をこの技に絞る）。 */
  choiceLockedMoveId?: string;
  /** 元スペックに持ち物があったが盤面上は消費済み（襷/きのみ等）。評価層のダメ計でitemを落とす。 */
  itemConsumed?: boolean;
  /**
   * 交代不可（ありじごく/くろいまなざし/かげふみ等の交代封じ効果）。今アクティブな個体のみ意味を持つ。
   * こだわり系アイテムは技を絞るだけで交代自体は禁止しないため対象外（実測確認済み）。
   */
  trapped?: boolean;
  /** このターンにメガシンカした（species.forme が Mega/Mega-X/Mega-Y/Primal）。次ターンへ megaUsed として引き継ぐ判定に使う。 */
  megaActive?: boolean;
  /** このターンにテラスタルした（mon.terastallized）。次ターンへ teraUsed として引き継ぐ判定に使う。 */
  teraActive?: boolean;
  /** あくびのvolatile(duration:1)が付いている＝次のターン終了時に眠りになる予約状態。 */
  yawnActive?: boolean;
  /** 混乱の残りターン数。 */
  confusionTurns?: number;
  /** アンコールで固定されている技ID + 残りターン数。 */
  encoreMoveId?: string;
  encoreTurns?: number;
  /** 挑発の残りターン数。 */
  tauntTurns?: number;
  /** かなしばりで禁止されている技ID + 残りターン数。 */
  disableMoveId?: string;
  disableTurns?: number;
  /** やどりぎのタネ: 吸い取る側のsimスロット。 */
  leechSeedSourceSlot?: 'p1a' | 'p2a';
  /** バインド技の残りターン数 + 技ID。 */
  partialTrapTurns?: number;
  partialTrapMoveId?: string;
  /** 反動で次のターン動けない状態か。 */
  mustRecharge?: boolean;
  /** まもる等の連続成功カウンタ。 */
  protectStallCounter?: number;
  /** 蓄えるの回数（1-3）。 */
  stockpileLayers?: number;
  /** 小さくなる済みか。 */
  minimizeActive?: boolean;
  /** アクアリング済みか。 */
  aquaRingActive?: boolean;
  /** 直前に使った技(sim小文字ID)。かなしばり(disable)がこれを参照するため保存が必要。 */
  lastMoveId?: string;
  /**
   * トレース/なりきり/なかまづくり/スキルスワップ/シンプルビーム/うるさいタネ等で元のcalc.abilityId
   * から変化した場合の、今現在の実際の特性(sim小文字ID)。元のままなら未指定。
   */
  currentAbilityId?: string;
  /** みずびたし/リフレクタイプ等でタイプが変化した場合の、今現在の実際のタイプ一覧。元のままなら未指定。 */
  typesOverride?: string[];
}

export interface ResolvedSideConditions {
  spikes: number;
  isSR: boolean;
  isReflect: boolean;
  isLightScreen: boolean;
  isAuroraVeil: boolean;
  isTailwind: boolean;
  /** ねがいごとの回復予約（次のターン終了時に発動、%表記）。無ければ未指定。 */
  wishHpPercent?: number;
  /** いやしのねがい/げつのひかりの全回復予約（次に場に出た個体に発動）。無ければ未指定。 */
  switchHealMoveId?: 'healingwish' | 'lunardance';
}

export interface ResolvedBoard {
  self: { active: ResolvedPokemon; bench: ResolvedPokemon[]; side: ResolvedSideConditions };
  opp: { active: ResolvedPokemon; bench: ResolvedPokemon[]; side: ResolvedSideConditions };
  field: { weather?: string; terrain?: string; isTrickRoom: boolean };
  turn: number;
  ended: boolean;
  winner: 'self' | 'opp' | undefined;
}

/** 利得行列。matrix[i][j] = 自分が手i・相手が手jを選んだときの自分視点の期待評価値。 */
export interface PayoffMatrix {
  selfActions: GtActionLabel[];
  oppActions: GtActionLabel[];
  matrix: number[][];
}

/** ソルバの解。 */
export interface NashSolution {
  selfMix: number[]; // 各自分の手の採用確率
  oppMix: number[];
  value: number; // ゲームの値（自分視点の保証期待値）
}

export interface MaximinSolution {
  selfActionIndex: number;
  value: number; // その手の最悪ケース評価値
}

export interface BestResponseSolution {
  oppActionIndex: number; // 相手が最も選びそうな手
  selfActionIndex: number; // それへの最適応答
  value: number;
  note: string;
}

/** エンジンの最終出力（App Routerへ返す形）。 */
export interface GtRecommendation {
  payoff: PayoffMatrix;
  nash: NashSolution;
  maximin: MaximinSolution;
  bestResponse?: BestResponseSolution; // 相手分布が偏っている場合のみ
  recommendedMode: 'nash' | 'bestResponse';
  /** 前提・注意（メガ⇔テラス排他など断定できない事項のUI注記用）。 */
  notes: string[];
}

// ============================================================
// 選出補佐（対戦中エンジンの1つ上の階層。6匹から3匹を選ぶ利得行列）
// ============================================================

/** 3体の選出候補（先発込み）。 */
export interface SelectionCandidate {
  /** 選出した3体のID（自分はPartyMember.id、相手はOpponentSlot.id）。 */
  memberIds: string[];
  /** 先発にする1体のID（memberIdsに含まれる）。 */
  leadId: string;
  /** 表示用ラベル（日本語名を"/"区切り）。 */
  label: string;
}

/** 選出補佐エンジンの最終出力。 */
export interface SelectionGtRecommendation {
  selfCandidates: SelectionCandidate[];
  oppCandidates: SelectionCandidate[];
  /** oppCandidatesと対応する、その組み合わせが選ばれる推定重み（種族人気順位から推定、合計1）。 */
  oppWeights: number[];
  /** matrix[i][j] = 自分がselfCandidates[i]・相手がoppCandidates[j]を選んだ場合の自分視点の静的評価値。 */
  matrix: number[][];
  nash: NashSolution;
  maximin: MaximinSolution;
  bestResponse?: BestResponseSolution;
  recommendedMode: 'nash' | 'bestResponse';
  notes: string[];
}
