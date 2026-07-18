import { calcDamage, type DamageResult, type PokemonSpec } from '../calc/damage';
import { hydrateStats, toStatsTableEvs } from '../data/hydrate';
import type { CalcSpec, EnvSpread, MatchupCell, OpponentSlot, PartyMember, Verdict } from '../types';

/** CalcSpec(hydrate用) -> @smogon/calc 用スペック。バトル中の状態(HP/boosts/status)は含めない素の変換。 */
export function toPokemonSpec(calc: CalcSpec): PokemonSpec {
  return {
    species: calc.species,
    item: calc.itemId,
    ability: calc.abilityId,
    nature: calc.natureId,
    evs: toStatsTableEvs(calc.evs),
    teraType: calc.teraTypeId,
  };
}

/** 使用率が最も高い傾向を「代表スプレッド」として採用する。 */
export function pickPrimarySpread(opponent: OpponentSlot): EnvSpread | undefined {
  if (!opponent.spreads?.length) return undefined;
  return [...opponent.spreads].sort((a, b) => b.prob - a.prob)[0];
}

/** 相手の種族+代表スプレッドから calc 用スペックを組み立てる（技はここに含めない）。 */
export function spreadToCalcSpec(species: string, spread: EnvSpread): CalcSpec {
  return {
    species,
    itemId: spread.itemId,
    abilityId: spread.abilityId,
    natureId: spread.natureId,
    evs: spread.evs,
    teraTypeId: spread.teraTypeId,
  };
}

interface BestMoveResult {
  move: string;
  result: DamageResult;
}

/** 変化技などダメージ計算不能な技はスキップし、最大ダメージの技を選ぶ（簡易技選択）。 */
function findBestMove(attacker: CalcSpec, defender: CalcSpec, moveIds: string[]): BestMoveResult | undefined {
  let best: BestMoveResult | undefined;
  const atkSpec = toPokemonSpec(attacker);
  const defSpec = toPokemonSpec(defender);
  for (const move of moveIds) {
    let result: DamageResult;
    try {
      result = calcDamage(atkSpec, defSpec, move);
    } catch {
      continue; // 変化技・失敗など
    }
    if (result.maxDamage <= 0) continue;
    if (!best || result.maxDamage > best.result.maxDamage) {
      best = { move, result };
    }
  }
  return best;
}

export function formatPctRange(result?: DamageResult): string {
  if (!result) return '--';
  if (result.maxPct === 0) return '0%';
  const min = Math.round(result.minPct);
  const max = Math.round(result.maxPct);
  return min === max ? `${max}%` : `${min}-${max}%`;
}

export function formatKo(result?: DamageResult): string {
  if (!result) return '--';
  if (result.maxPct === 0) return '無効';
  if (!result.koHits) return result.maxPct >= 100 ? '確定1発' : '--';
  return result.koChance >= 1 ? `確定${result.koHits}発` : `乱数${result.koHits}発`;
}

/** 自分のポケモン1匹 x 相手1枠 の相性セルを計算する。 */
export function buildMatchupCell(member: PartyMember, opponent: OpponentSlot): MatchupCell | undefined {
  if (!opponent.species) return undefined;
  const primary = pickPrimarySpread(opponent);
  if (!primary) return undefined;

  const oppCalc = spreadToCalcSpec(opponent.species, primary);
  const oppMoveIds = (opponent.moveUsage ?? []).map((m) => m.moveId);

  // 自分の攻撃: 手持ちの技から最大打点を探索（簡易技選択）
  const atkBest = findBestMove(member.calc, oppCalc, member.calc.moveIds ?? []);
  // 相手の攻撃: 採用率上位の技から最大打点を探索（型を1つに固定しない）
  const defBest = findBestMove(oppCalc, member.calc, oppMoveIds);

  const oppSpeed = hydrateStats(oppCalc).s;
  const mySpeed = member.stats.s;
  const speed: MatchupCell['speed'] = mySpeed === oppSpeed ? 'tie50' : mySpeed > oppSpeed ? 'win' : 'lose';

  const atkPct = atkBest?.result.maxPct ?? 0;
  const defPct = defBest?.result.maxPct ?? 0;
  const speedBonus = speed === 'win' ? 15 : speed === 'lose' ? -15 : 0;
  const score = Math.max(-100, Math.min(100, Math.round(atkPct - defPct + speedBonus)));

  let verdict: Verdict;
  if (score >= 40) verdict = 'strong';
  else if (score >= 12) verdict = 'mild';
  else if (score <= -40) verdict = 'strongRisk';
  else if (score <= -12) verdict = 'mildRisk';
  else verdict = 'neutral';

  const note =
    opponent.spreads && opponent.spreads.length > 1
      ? `代表傾向「${primary.name}」基準（他の傾向もあり）`
      : undefined;

  return {
    verdict,
    score,
    atkRange: formatPctRange(atkBest?.result),
    atkKo: formatKo(atkBest?.result),
    defRange: formatPctRange(defBest?.result),
    defKo: formatKo(defBest?.result),
    speed,
    note,
  };
}

/** 自分パーティ x 相手6枠 の相性マトリクスを計算する。 */
export function buildMatchupMatrix(
  party: PartyMember[],
  opponents: OpponentSlot[],
): Record<string, Record<string, MatchupCell>> {
  const matrix: Record<string, Record<string, MatchupCell>> = {};
  for (const member of party) {
    matrix[member.id] = {};
    for (const opponent of opponents) {
      const cell = buildMatchupCell(member, opponent);
      if (cell) matrix[member.id][opponent.id] = cell;
    }
  }
  return matrix;
}
