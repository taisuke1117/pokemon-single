import { getStats } from '../calc/damage';
import { getSpecies } from '../calc/dex';
import { toJaTypes } from './type-map';
import type { CalcSpec, EnvSpeciesEntry, PartyMember, StatLine } from '../types';

/** StatLine(h/a/b/c/d/s) の各キー <-> @smogon/calc の StatsTable(hp/atk/def/spa/spd/spe) の対応表。 */
export const STAT_KEY_MAP = {
  h: 'hp',
  a: 'atk',
  b: 'def',
  c: 'spa',
  d: 'spd',
  s: 'spe',
} as const;

/**
 * StatLine(h/a/b/c/d/s) <-> @smogon/calc の StatsTable(hp/atk/def/spa/spd/spe) 変換。
 *
 * 注意: 未指定のキーは省略する（`undefined` を明示すると @smogon/calc が
 * そのステータスを `null` として扱ってしまい実数値が壊れるため、検証済み）。
 */
export function toStatsTableEvs(evs: Partial<StatLine>): Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>> {
  const out: Partial<Record<'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe', number>> = {};
  for (const [k, v] of Object.entries(evs) as [keyof StatLine, number | undefined][]) {
    if (v !== undefined) out[STAT_KEY_MAP[k]] = v;
  }
  return out;
}

/** CalcSpec から実数値(StatLine)を算出する。種族値・性格・努力値は calc に一任し、手計算はしない。 */
export function hydrateStats(calc: CalcSpec): StatLine {
  const stats = getStats({
    species: calc.species,
    item: calc.itemId,
    ability: calc.abilityId,
    nature: calc.natureId,
    evs: toStatsTableEvs(calc.evs),
  });
  return {
    h: stats.hp,
    a: stats.atk,
    b: stats.def,
    c: stats.spa,
    d: stats.spd,
    s: stats.spe,
  };
}

export type PartyMemberSeed = Omit<PartyMember, 'types' | 'stats'>;

/** シード（表示用JP情報 + calc用スペック）から types/stats を算出して完全な PartyMember を作る。 */
export function hydratePartyMember(seed: PartyMemberSeed): PartyMember {
  const species = getSpecies(seed.calc.species);
  return {
    ...seed,
    types: species ? toJaTypes(species.types) : [],
    stats: hydrateStats(seed.calc),
  };
}

export type EnvSpeciesEntrySeed = Omit<EnvSpeciesEntry, 'types'>;

/** シードから types を算出して EnvSpeciesEntry を作る。 */
export function hydrateEnvEntry(seed: EnvSpeciesEntrySeed): EnvSpeciesEntry {
  const species = getSpecies(seed.species);
  return {
    ...seed,
    types: species ? toJaTypes(species.types) : [],
  };
}
