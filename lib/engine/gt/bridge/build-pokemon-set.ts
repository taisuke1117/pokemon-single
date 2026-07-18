/**
 * CalcSpec(自分は確定・相手はEnvSpreadから合成) → @pkmn/sim の PokemonSet 変換。
 *
 * メガは「ベース種族名+メガストーン」で作る（env-real.jsonは "Metagross-Mega" 形式で
 * 保存しているのでベース種族に戻す）。@pkmn/sim はバトル中の choose('move <id> mega') で
 * メガ進化を処理するため、セット時点ではベース体にしておく必要がある
 * （メガ種族名を直接使うと最初からメガ体になり、メガ枠未消費状態を表現できない）。
 */
import type { PokemonSet } from '@pkmn/sim';
import { STAT_KEY_MAP } from '../../../data/hydrate';
import type { CalcSpec, StatLine } from '../../../types';

/** "Metagross-Mega" → "Metagross", "Charizard-Mega-Y" → "Charizard" */
export function toBaseSpecies(species: string): string {
  return species.replace(/-Mega(-[XY])?$/, '').replace(/-Primal$/, '');
}

/** teraType の @pkmn/dex英語ID（例: "Fairy"）はそのまま @pkmn/sim も受け付ける。 */
function evsToStatsTable(evs: Partial<StatLine>): PokemonSet['evs'] {
  const out = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const [k, v] of Object.entries(evs) as [keyof StatLine, number | undefined][]) {
    if (v) out[STAT_KEY_MAP[k]] = v;
  }
  return out;
}

export interface GtPokemonInput {
  /** 追跡用の識別子（PartyMember.id / OpponentSlot.id）。ResolvedPokemon.refId に引き継ぐ。 */
  refId: string;
  displayName: string;
  calc: CalcSpec;
}

export interface ToPokemonSetOptions {
  /** ミミッキュの化けの皮が剥がれ済みなら、Bustedフォルムで構築する（素の耐久で計算される）。 */
  disguiseBusted?: boolean;
  /**
   * 対戦中に既にメガシンカ済みなら、ベース体ではなくメガ形態（calc.speciesそのまま）で構築する。
   * @pkmn/sim はメガ形態のspecies名を直接受け付け、種族値/タイプ/特性/canMegaEvo=null まで
   * 自動的に正しく構築する（実測確認済み: scripts/spike-mega-species-direct.ts）。
   * 未指定（false/undefined）時は従来通りベース体（choose('move <id> mega')でメガ化する前提）。
   */
  megaUsed?: boolean;
}

export function toPokemonSet(input: GtPokemonInput, opts?: ToPokemonSetOptions): PokemonSet {
  const { calc } = input;
  let species = opts?.megaUsed ? calc.species : toBaseSpecies(calc.species);
  if (opts?.disguiseBusted && /^mimikyu/i.test(species)) species = 'Mimikyu-Busted';
  return {
    name: input.refId, // identに使われる。refIdを入れて後で場のポケモンと突き合わせる
    species,
    item: calc.itemId ?? '',
    ability: calc.abilityId ?? '',
    moves: (calc.moveIds ?? []).slice(0, 4),
    nature: calc.natureId,
    gender: '',
    evs: evsToStatsTable(calc.evs),
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 50, // チャンピオンズはレベル50固定
    teraType: calc.teraTypeId,
  };
}
