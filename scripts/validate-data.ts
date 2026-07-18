/**
 * lib/data 配下のパーティ・環境データについて、
 * calc用ID(英語)が実在し、かつ「その種族が実際に習得/所持できるか」まで検証する。
 * JP<->EN の手動対応ミスを機械的に洗い出すためのスクリプト。
 */
import { Dex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';
import { MOCK_PARTY } from '../lib/data/party.ts';
import { ENV_SEASON_M4 } from '../lib/data/env-season-m4.ts';
import type { StatLine } from '../lib/types.ts';

const gens = new Generations(Dex);
const gen9 = gens.get(9);
const gen7 = gens.get(7);

function speciesAbilities(speciesId: string): string[] {
  const s = gen9.species.get(speciesId) ?? gen7.species.get(speciesId) ?? Dex.species.get(speciesId);
  return s ? Object.values(s.abilities) : [];
}

let errors = 0;

interface SpecLike {
  species: string;
  itemId?: string;
  abilityId?: string;
  natureId: string;
  evs: Partial<StatLine>;
}

function checkSpec(label: string, spec: SpecLike) {
  const species = gen9.species.get(spec.species) ?? gen7.species.get(spec.species) ?? Dex.species.get(spec.species);
  if (!species?.exists) {
    console.log('❌', label, `種族が存在しない: ${spec.species}`);
    errors++;
    return;
  }
  if (spec.abilityId) {
    const abilities = speciesAbilities(spec.species);
    if (!abilities.includes(spec.abilityId)) {
      console.log('❌', label, `特性不一致: ${spec.abilityId} not in [${abilities.join(',')}] (${spec.species})`);
      errors++;
    }
  }
  if (spec.itemId && !gen9.items.get(spec.itemId) && !gen7.items.get(spec.itemId)) {
    console.log('❌', label, `道具が存在しない: ${spec.itemId}`);
    errors++;
  }
  if (!gen9.natures.get(spec.natureId)) {
    console.log('❌', label, `性格が存在しない: ${spec.natureId}`);
    errors++;
  }
  const evSum = Object.values(spec.evs).reduce((a: number, b) => a + (b ?? 0), 0);
  if (evSum > 508) {
    console.log('❌', label, `努力値合計が508超過: ${evSum}`);
    errors++;
  }
  for (const [k, v] of Object.entries(spec.evs)) {
    if ((v ?? 0) > 252) {
      console.log('❌', label, `努力値が252超過: ${k}=${v}`);
      errors++;
    }
  }
}

function checkMoves(label: string, moveIds: string[]) {
  for (const m of moveIds) {
    if (!gen9.moves.get(m)) {
      console.log('❌', label, `技が存在しない: ${m}`);
      errors++;
    }
  }
}

for (const p of MOCK_PARTY) {
  checkSpec(`party:${p.name}`, p.calc);
  checkMoves(`party:${p.name}`, p.calc.moveIds ?? []);
}

for (const e of ENV_SEASON_M4) {
  for (const sp of e.spreads) {
    checkSpec(`env:${e.name}/${sp.name}`, { species: e.species, itemId: sp.itemId, abilityId: sp.abilityId, natureId: sp.natureId, evs: sp.evs });
  }
  checkMoves(`env:${e.name}`, e.moveUsage.map((m) => m.moveId));
}

console.log(errors === 0 ? '\n✅ 全件エラーなし' : `\n⚠️ ${errors}件のエラー`);
