/**
 * 評価要素がダメージ計算に使う共通ヘルパー。
 * ResolvedPokemon(盤面スナップショット) → @smogon/calc の PokemonSpec 変換と、
 * 「最大打点技」の探索を提供する。@pkmn/simには依存しない（@smogon/calc経由）。
 */
import { calcDamage, getStats, type DamageResult, type FieldSpec, type PokemonSpec } from '../../../calc/damage';
import { toStatsTableEvs } from '../../../data/hydrate';
import { SIM_TERRAIN_TO_APP, SIM_WEATHER_TO_APP } from '../sim-enum-map';
import type { ResolvedBoard, ResolvedPokemon, ResolvedSideConditions } from '../types';

function scToSpec(sc: ResolvedSideConditions): FieldSpec['attackerSide'] {
  return { spikes: sc.spikes, isSR: sc.isSR, isReflect: sc.isReflect, isLightScreen: sc.isLightScreen, isAuroraVeil: sc.isAuroraVeil, isTailwind: sc.isTailwind };
}

/**
 * 盤面から @smogon/calc 用の FieldSpec を作る。天候・地形（両者共通）と、
 * 攻撃側/防御側の壁・設置物（リフレクター等は防御側にかかっていると被ダメが減る）を反映する。
 */
export function toFieldSpec(board: ResolvedBoard, attackerSide: 'self' | 'opp'): FieldSpec {
  const atkSc = attackerSide === 'self' ? board.self.side : board.opp.side;
  const defSc = attackerSide === 'self' ? board.opp.side : board.self.side;
  return {
    weather: board.field.weather ? SIM_WEATHER_TO_APP[board.field.weather] : undefined,
    terrain: board.field.terrain ? SIM_TERRAIN_TO_APP[board.field.terrain] : undefined,
    attackerSide: scToSpec(atkSc),
    defenderSide: scToSpec(defSc),
  };
}

const STATUS_MAP: Record<string, PokemonSpec['status']> = {
  brn: 'brn', par: 'par', psn: 'psn', tox: 'tox', slp: 'slp', frz: 'frz',
};

const BOOST_TO_STATS: Record<'a' | 'b' | 'c' | 'd' | 's', 'atk' | 'def' | 'spa' | 'spd' | 'spe'> = {
  a: 'atk', b: 'def', c: 'spa', d: 'spd', s: 'spe',
};

/** ResolvedPokemon → PokemonSpec（現在HP%・ランク補正・状態異常を反映）。 */
export function toSpec(mon: ResolvedPokemon): PokemonSpec {
  const boosts: Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>> = {};
  for (const [k, v] of Object.entries(mon.boosts) as ['a' | 'b' | 'c' | 'd' | 's', number | undefined][]) {
    if (v) boosts[BOOST_TO_STATS[k]] = v;
  }
  return {
    species: mon.calc.species,
    item: mon.itemConsumed ? undefined : mon.calc.itemId,
    ability: mon.calc.abilityId,
    nature: mon.calc.natureId,
    evs: toStatsTableEvs(mon.calc.evs),
    teraType: mon.calc.teraTypeId,
    status: mon.status ? STATUS_MAP[mon.status] : undefined,
    boosts,
    currentHpPercent: mon.hpPercent,
  };
}

export interface BestMove {
  moveId: string;
  result: DamageResult;
}

/** attacker の moveIds から、defender への最大打点技を探す（変化技はスキップ）。field で天候/壁を反映。 */
export function findBestMove(
  attacker: ResolvedPokemon,
  defender: ResolvedPokemon,
  moveIds: string[],
  field?: FieldSpec,
): BestMove | undefined {
  const atk = toSpec(attacker);
  const def = toSpec(defender);
  let best: BestMove | undefined;
  for (const moveId of moveIds) {
    let result: DamageResult;
    try {
      result = calcDamage(atk, def, moveId, field);
    } catch {
      continue;
    }
    if (result.maxDamage <= 0) continue;
    if (!best || result.maxPct > best.result.maxPct) best = { moveId, result };
  }
  return best;
}

/** ダメージ結果の期待ロール%（下振れ〜上振れの中央）。連続的な優劣評価に使う。 */
export function avgPct(result: DamageResult): number {
  return (result.minPct + result.maxPct) / 2;
}

function boostMultiplier(boost: number): number {
  const c = Math.max(-6, Math.min(6, boost));
  return c >= 0 ? (2 + c) / 2 : 2 / (2 - c);
}

/**
 * 実効素早さ（ランク補正・まひ反映）。
 * getStats は素の実数値しか返さない（boost/状態異常を反映しない）ため、ここで手動補正する。
 */
export function effectiveSpeed(mon: ResolvedPokemon): number {
  let spe = getStats(toSpec(mon)).spe;
  spe *= boostMultiplier(mon.boosts.s ?? 0);
  if (mon.status === 'par') spe *= 0.5;
  return spe;
}
