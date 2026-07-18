/**
 * 対戦中リアルタイム支援の中核エンジン。
 * 「今の場の状態」（BattleState）を元に、技のランキング・先攻/後攻・交代候補を計算する。
 */
import { calcDamage, getStats, type DamageResult, type FieldSpec, type PokemonSpec } from '../calc/damage';
import { STAT_KEY_MAP, toStatsTableEvs } from '../data/hydrate';
import { formatKo, formatPctRange, pickPrimarySpread, spreadToCalcSpec, toPokemonSpec } from './matchup';
import type {
  BattleFieldState,
  BattleParticipant,
  CalcSpec,
  EnvMoveUsage,
  OpponentSlot,
  PartyMember,
  SideConditions,
  StatKey,
} from '../types';
import type { StatsTable } from '@smogon/calc';

function toStatsBoosts(boosts: Partial<Record<StatKey, number>>): Partial<StatsTable> {
  const out: Partial<StatsTable> = {};
  for (const [k, v] of Object.entries(boosts) as [StatKey, number | undefined][]) {
    if (v !== undefined) out[STAT_KEY_MAP[k]] = v;
  }
  return out;
}

/** CalcSpec(登録情報) + BattleParticipant(対戦中の変化) を合成して @smogon/calc 用スペックにする。 */
function toLiveSpec(calc: CalcSpec, participant: BattleParticipant): PokemonSpec {
  return {
    species: calc.species,
    item: participant.revealedItemId ?? calc.itemId,
    ability: participant.revealedAbilityId ?? calc.abilityId,
    nature: calc.natureId,
    evs: toStatsTableEvs(calc.evs),
    // テラスタルは実際に使用済みの場合のみ効果を反映する
    teraType: participant.teraUsed ? calc.teraTypeId : undefined,
    status: participant.status,
    boosts: toStatsBoosts(participant.boosts),
    currentHpPercent: participant.currentHpPercent,
  };
}

function sideConditionsToSpec(side: SideConditions) {
  return {
    spikes: side.spikes,
    isSR: side.isSR,
    isReflect: side.isReflect,
    isLightScreen: side.isLightScreen,
    isAuroraVeil: side.isAuroraVeil,
    isTailwind: side.isTailwind,
  };
}

/**
 * BattleFieldState(selfSide/oppSide=固定した向き) を、@smogon/calc の
 * FieldSpec(attackerSide/defenderSide=攻撃方向依存) に組み替える。
 */
function toFieldSpec(field: BattleFieldState, attackerIsSelf: boolean): FieldSpec {
  const selfSpec = sideConditionsToSpec(field.selfSide);
  const oppSpec = sideConditionsToSpec(field.oppSide);
  return {
    weather: field.weather,
    terrain: field.terrain,
    attackerSide: attackerIsSelf ? selfSpec : oppSpec,
    defenderSide: attackerIsSelf ? oppSpec : selfSpec,
  };
}

export interface MoveRankEntry {
  moveId: string;
  range: string;
  koText: string;
  koChance: number;
  maxPct: number;
}

/** 自分の手持ち技を、現在の場の状態（HP/ランク補正/状態異常/フィールド）を反映してランキングする。 */
export function rankMoves(
  attacker: PartyMember,
  attackerParticipant: BattleParticipant,
  oppSlot: OpponentSlot,
  oppParticipant: BattleParticipant,
  field: BattleFieldState,
): MoveRankEntry[] {
  if (!oppSlot.species) return [];
  const primary = pickPrimarySpread(oppSlot);
  if (!primary) return [];
  const oppCalc = spreadToCalcSpec(oppSlot.species, primary);

  const atkSpec = toLiveSpec(attacker.calc, attackerParticipant);
  const defSpec = toLiveSpec(oppCalc, oppParticipant);
  const fieldSpec = toFieldSpec(field, true);

  const moveIds = attacker.calc.moveIds ?? [];
  const entries: MoveRankEntry[] = moveIds.map((moveId) => {
    let result: DamageResult | undefined;
    try {
      result = calcDamage(atkSpec, defSpec, moveId, fieldSpec);
    } catch {
      result = undefined;
    }
    return {
      moveId,
      range: formatPctRange(result),
      koText: formatKo(result),
      koChance: result?.koChance ?? 0,
      maxPct: result?.maxPct ?? 0,
    };
  });

  return entries.sort((a, b) => b.maxPct - a.maxPct);
}

export type SpeedResult = 'selfFirst' | 'oppFirst' | 'speedTie';

function boostMultiplier(boost: number): number {
  const clamped = Math.max(-6, Math.min(6, boost));
  return clamped >= 0 ? (2 + clamped) / 2 : 2 / (2 - clamped);
}

/** 実効素早さ（ランク補正・まひ・おいかぜを反映）。トリックルームは compareSpeed 側で反転させる。 */
function effectiveSpeed(calc: CalcSpec, participant: BattleParticipant, tailwind: boolean): number {
  const baseSpe = getStats(toPokemonSpec(calc)).spe;
  let spe = baseSpe * boostMultiplier(participant.boosts.s ?? 0);
  if (participant.status === 'par') spe *= 0.5;
  if (tailwind) spe *= 2;
  return spe;
}

/** 先攻/後攻判定。まひ・おいかぜ・トリックルームを考慮する（@smogon/calc の Field にはトリックルームが無いためここで自前反転する）。 */
export function compareSpeed(
  selfCalc: CalcSpec,
  selfParticipant: BattleParticipant,
  oppCalc: CalcSpec,
  oppParticipant: BattleParticipant,
  field: BattleFieldState,
): SpeedResult {
  const selfSpeed = effectiveSpeed(selfCalc, selfParticipant, field.selfSide.isTailwind);
  const oppSpeed = effectiveSpeed(oppCalc, oppParticipant, field.oppSide.isTailwind);
  if (selfSpeed === oppSpeed) return 'speedTie';
  const selfIsFaster = selfSpeed > oppSpeed;
  const selfGoesFirst = field.isTrickRoom ? !selfIsFaster : selfIsFaster;
  return selfGoesFirst ? 'selfFirst' : 'oppFirst';
}

export interface ThreatMove {
  moveId: string;
  usage: number;
  /** 自分の現在の場のポケモンに対する被ダメ（警戒技を選ぶ根拠） */
  vsCurrentActive: DamageResult;
}

/**
 * 相手の採用率リストの中から、「採用率が高く、かつ自分の現在の場のポケモンに刺さる」
 * 技を1つ特定する（採用率×被ダメ率のスコアで選ぶ）。
 */
export function findThreatMove(
  oppCalc: CalcSpec,
  oppParticipant: BattleParticipant,
  moveUsage: EnvMoveUsage[],
  currentActiveCalc: CalcSpec,
  currentActiveParticipant: BattleParticipant,
  field: BattleFieldState,
): ThreatMove | undefined {
  const oppSpec = toLiveSpec(oppCalc, oppParticipant);
  const defSpec = toLiveSpec(currentActiveCalc, currentActiveParticipant);
  const fieldSpec = toFieldSpec(field, false);

  let best: (ThreatMove & { score: number }) | undefined;
  for (const m of moveUsage) {
    let result: DamageResult;
    try {
      result = calcDamage(oppSpec, defSpec, m.moveId, fieldSpec);
    } catch {
      continue;
    }
    if (result.maxDamage <= 0) continue;
    const score = result.maxPct * m.usage;
    if (!best || score > best.score) {
      best = { moveId: m.moveId, usage: m.usage, vsCurrentActive: result, score };
    }
  }
  if (!best) return undefined;
  const { score: _score, ...rest } = best;
  return rest;
}

export interface SwitchInRankEntry {
  memberId: string;
  /** 警戒技が特定できた場合のみ、その技に対する受け具合。 */
  threatMoveId?: string;
  threatUsage?: number;
  range: string;
  koText: string;
  survives: boolean;
}

/**
 * 控えメンバーごとに、「相手が今の場のポケモンに対して打ってくるだろう警戒技」への
 * 受け具合をランキングする（要望: 交代判断支援）。
 */
export function rankSwitchIns(
  bench: PartyMember[],
  selfParticipants: Record<string, BattleParticipant>,
  currentActiveCalc: CalcSpec,
  currentActiveParticipant: BattleParticipant,
  oppSlot: OpponentSlot,
  oppParticipant: BattleParticipant,
  field: BattleFieldState,
): SwitchInRankEntry[] {
  if (!oppSlot.species) return [];
  const primary = pickPrimarySpread(oppSlot);
  if (!primary) return [];
  const oppCalc = spreadToCalcSpec(oppSlot.species, primary);

  const threat = findThreatMove(
    oppCalc,
    oppParticipant,
    oppSlot.moveUsage ?? [],
    currentActiveCalc,
    currentActiveParticipant,
    field,
  );

  const oppSpec = toLiveSpec(oppCalc, oppParticipant);
  const fieldSpec = toFieldSpec(field, false);

  return bench.map((member) => {
    if (!threat) {
      return { memberId: member.id, range: '--', koText: '--', survives: true };
    }
    const participant = selfParticipants[member.id];
    const defSpec = participant ? toLiveSpec(member.calc, participant) : toPokemonSpec(member.calc);
    let result: DamageResult | undefined;
    try {
      result = calcDamage(oppSpec, defSpec, threat.moveId, fieldSpec);
    } catch {
      result = undefined;
    }
    return {
      memberId: member.id,
      threatMoveId: threat.moveId,
      threatUsage: threat.usage,
      range: formatPctRange(result),
      koText: formatKo(result),
      survives: (result?.koChance ?? 0) < 1,
    };
  });
}
