/**
 * 観測誘導PRNG。@pkmn/sim の PRNG を継承し、対戦画面でユーザーが入力した観測乱数
 * （急所・追加効果の発動・削れ量から分かるKO有無）に一致するようターン解決を導く。
 *
 * 乱数の判別は「呼び出し引数のシグネチャ」で行う（T-Spikeで実測確認済み）:
 *   - ダメージロール = random(16)      … 0=最大(100%) … 15=最小(85%)   （battle.js randomizer）
 *   - 追加効果       = random(100)     … secondaryRoll < chance で発動   （battle-actions secondaries）
 *   - 命中           = randomChance(acc, 100)                             （観測=命中したので true）
 *   - 急所           = randomChance(1, N) (N≠100)                         （観測の急所有無）
 *
 * 「どちらの手か」は解決中の battle.activePokemon.side.id で判定する（p1=自分, p2=相手）。
 * 最終HPは applyTurn 側で観測値に補正するため、ダメージロールは厳密一致ではなく
 * 「KO/非KOの分岐が観測と一致する」ことだけ保証する粗い誘導（観測瀕死→最大, 生存→最小）にする。
 */
import { PRNG } from '@pkmn/sim';
import type { Battle } from '@pkmn/sim';
import type { PRNGSeed } from '@pkmn/sim';

/** 片側の手の観測（攻撃側の視点）。 */
export interface SideObservation {
  /** その手が急所だったか。 */
  wasCrit: boolean;
  /** 確率追加効果が発動したか。undefined=不明（自然な抽選に任せる）。 */
  secondaryProcced?: boolean;
  /** その手で相手（防御側）が瀕死になったか（観測HP%が0）。ダメージロールのKO整合に使う。 */
  defenderFainted: boolean;
}

export interface GuidedObservations {
  /** p1(自分)の手の観測。自分が技を使わなかった（交代等）なら undefined。 */
  p1?: SideObservation;
  /** p2(相手)の手の観測。相手が技を使わなかったなら undefined。 */
  p2?: SideObservation;
}

export class GuidedPRNG extends PRNG {
  /** buildBattleFromSnapshot 後に外から差し込む（PRNGは battle を知らないため）。 */
  battle: Battle | null = null;

  constructor(private obs: GuidedObservations, seed?: PRNGSeed) {
    super(seed ?? null);
  }

  /** 解決中に技を撃っている側の観測を返す（判別不能なら undefined）。 */
  private activeObs(): SideObservation | undefined {
    const sideId = this.battle?.activePokemon?.side.id;
    if (sideId === 'p1') return this.obs.p1;
    if (sideId === 'p2') return this.obs.p2;
    return undefined;
  }

  override random(from?: number, to?: number): number {
    // ダメージロール: 0=最大100% … 15=最小85%。観測がKOなら最大、生存なら最小を選ぶ。
    if (from === 16 && to === undefined) {
      const o = this.activeObs();
      if (o) return o.defenderFainted ? 0 : 15;
      return super.random(from, to);
    }
    // 追加効果: 0返し=強制発動, 99返し=抑止, 不明=自然抽選。
    if (from === 100 && to === undefined) {
      const o = this.activeObs();
      if (o && o.secondaryProcced !== undefined) return o.secondaryProcced ? 0 : 99;
      return super.random(from, to);
    }
    return super.random(from, to);
  }

  override randomChance(numerator: number, denominator: number): boolean {
    // 命中判定: 観測された手は命中しているので必ず当てる。
    if (denominator === 100) return true;
    // 急所判定 randomChance(1, N): 観測の急所有無を返す。
    if (numerator === 1) {
      const o = this.activeObs();
      if (o) return o.wasCrit;
    }
    return super.randomChance(numerator, denominator);
  }
}
