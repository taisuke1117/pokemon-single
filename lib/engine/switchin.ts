/**
 * 送り出し時に自動発生する効果（ステルスロック・まきびし・いかく）を計算する。
 *
 * ステルスロック/まきびしはダメ計本体(lib/calc/damage.ts)の calculate() の対象外
 * （calculate() は「使われた技」前提で、設置技による送り出し時ダメージとは経路が違う）。
 * そのため @smogon/calc が内部に持つ生のタイプ相性表を直接引いて自前計算する。
 */
import { Generations } from '@smogon/calc';
import { getSpecies } from '../calc/dex';
import type { SideConditions } from '../types';

const gen = Generations.get(9);
const rockType = gen.types.get('rock' as never);

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** ステルスロックの被ダメ%（岩タイプ相性から算出。免疫が無いため常に 6.25/12.5/25/50 のいずれか）。 */
export function computeStealthRockPercent(defenderTypes: readonly string[]): number {
  if (!rockType) return 0;
  const effectiveness = rockType.effectiveness as Record<string, number | undefined>;
  const multiplier = defenderTypes.reduce((acc, t) => acc * (effectiveness[t] ?? 1), 1);
  return 12.5 * multiplier;
}

/** まきびしの被ダメ%（1〜3段）。ひこうタイプは無効（ふゆう特性等の個別判定は対象外、手動補正で対応）。 */
export function computeSpikesPercent(layers: number, defenderTypes: readonly string[]): number {
  if (layers <= 0) return 0;
  if (defenderTypes.includes('Flying')) return 0;
  return 12.5 * layers;
}

export function hasIntimidate(abilityId?: string): boolean {
  return abilityId === 'intimidate';
}

export interface SwitchInResult {
  /** 送り出された瞬間に失うHP%の合計（ステロ+まきびし）。 */
  hpPercentLoss: number;
  /** 表示用の内訳（例:"ステルスロック -25%"）。 */
  hazardNotes: string[];
  /** 送り出した本人がいかく持ちなら、相手の場のポケモンに与える攻撃ランク変化(-1 or 0)。 */
  opponentAtkBoostChange: number;
}

/**
 * @param incomingSpecies 送り出されるポケモンの英語種族名(CalcSpec.species)
 * @param incomingAbilityId 送り出されるポケモンの特性id（判明済みならそちらを渡す）
 * @param enteringSide そのポケモンが入る側の設置技状態（自分が出すなら自陣、相手が出すなら相手陣）
 */
export function applySwitchInEffects(
  incomingSpecies: string,
  incomingAbilityId: string | undefined,
  enteringSide: SideConditions,
): SwitchInResult {
  const species = getSpecies(incomingSpecies);
  const types = species ? species.types : [];
  const hazardNotes: string[] = [];
  let hpPercentLoss = 0;

  if (enteringSide.isSR) {
    const pct = computeStealthRockPercent(types);
    if (pct > 0) {
      hpPercentLoss += pct;
      hazardNotes.push(`ステルスロック -${round1(pct)}%`);
    }
  }
  if (enteringSide.spikes > 0) {
    const pct = computeSpikesPercent(enteringSide.spikes, types);
    if (pct > 0) {
      hpPercentLoss += pct;
      hazardNotes.push(`まきびし${enteringSide.spikes}段 -${round1(pct)}%`);
    }
  }

  return {
    hpPercentLoss: round1(hpPercentLoss),
    hazardNotes,
    opponentAtkBoostChange: hasIntimidate(incomingAbilityId) ? -1 : 0,
  };
}
