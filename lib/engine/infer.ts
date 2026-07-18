/**
 * 観測ログ(MoveObservation)から、相手の性格・努力値配分・持ち物を絞り込む推定エンジン。
 *
 * 方針: 「断定」ではなく「矛盾しない候補一覧」を返す。1回の観測だけでは絞り切れないことが
 * 多いため、観測が増えるたびに summarizeOpponentInference を呼び直して候補集合を狭めていく。
 *
 * 制約（意図的な単純化。設計上の理由を明記する）:
 * - 自分側の過去の boosts/status は記録していない（「ライブ状態編集」モデルのため、
 *   イベントログ的な過去状態の完全な巻き戻しはしない）。推定計算では自分側は
 *   ランク補正・状態異常の無い「素の状態」として扱う。boosts/状態異常が実際に
 *   かかっていたターンの観測は誤差要因になりうるため、UI側で「その時ブーストしていたか」を
 *   踏まえて候補を割り引いて見てもらう想定。
 * - 持ち物候補は代表的なもの（こだわり系・いのちのたま・とつげきチョッキ）に限定する
 *   （網羅すると候補が薄まりすぎて実用上の意味が無くなるため）。
 */
import { Generations, toID } from '@smogon/calc';
import { calcDamage, type CalcOptions, type DamageResult, type PokemonSpec } from '../calc/damage';
import { STAT_KEY_MAP, toStatsTableEvs } from '../data/hydrate';
import { NATURES } from '../data/nature-ja';
import type { BattleParticipant, CalcSpec, EnvSpread, MoveObservation, OpponentSlot, StatKey } from '../types';

const gen = Generations.get(9);

export function getMoveCategory(moveId: string): 'Physical' | 'Special' | 'Status' | undefined {
  return gen.moves.get(toID(moveId))?.category;
}

/** 推定候補として試す持ち物カタログ。役割・技カテゴリに合わない場合は @smogon/calc 側で自動的に無補正になる。 */
const ITEM_CANDIDATES = ['none', 'Choice Band', 'Choice Specs', 'Life Orb', 'Assault Vest'] as const;

type NatureBucket = 'boosting' | 'neutral' | 'hindering';
const BUCKETS: NatureBucket[] = ['boosting', 'neutral', 'hindering'];

function natureMatchesBucket(statKey: StatKey, bucket: NatureBucket, up?: string, down?: string): boolean {
  if (bucket === 'boosting') return up === statKey;
  if (bucket === 'hindering') return down === statKey;
  return up !== statKey && down !== statKey;
}

function natureIdsInBucket(statKey: StatKey, bucket: NatureBucket): string[] {
  return NATURES.filter((n) => natureMatchesBucket(statKey, bucket, n.up, n.down)).map((n) => n.natureId);
}

function representativeNatureId(statKey: StatKey, bucket: NatureBucket): string {
  return NATURES.find((n) => natureMatchesBucket(statKey, bucket, n.up, n.down))?.natureId ?? 'Hardy';
}

function toBasicSpec(calc: CalcSpec): PokemonSpec {
  return {
    species: calc.species,
    item: calc.itemId,
    ability: calc.abilityId,
    nature: calc.natureId,
    evs: toStatsTableEvs(calc.evs),
    teraType: calc.teraTypeId,
  };
}

/** 観測1件から、攻撃側/防御側どちらの何のステータスを推定すべきかを決める。変化技は対象外。 */
function resolveStatKey(observation: MoveObservation): StatKey | undefined {
  const category = getMoveCategory(observation.moveId);
  if (!category || category === 'Status') return undefined;
  const isOpponentAttacking = observation.attackerSide === 'opponent';
  if (isOpponentAttacking) return category === 'Physical' ? 'a' : 'c';
  return category === 'Physical' ? 'b' : 'd';
}

const EPS = 0.6; // 丸め誤差の許容幅(%)

function isWithinEnvelope(observedPct: number, a: DamageResult, b: DamageResult): boolean {
  const min = Math.min(a.minPct, b.minPct);
  const max = Math.max(a.maxPct, b.maxPct);
  return observedPct >= min - EPS && observedPct <= max + EPS;
}

export interface ObservationInference {
  turn: number;
  statKey: StatKey;
  consistentNatureIds: string[];
  consistentItemIds: string[];
}

/**
 * 1件の観測から、相手の性格・持ち物について「矛盾しない候補」を求める。
 * @param knownCalc その観測時点で技を受けていない側(=既知)のスペック。
 * @param targetSpecies 推定対象(相手)の種族。
 * @param knownRevealedAbilityId 相手の特性が判明済みならそれを渡す(精度が上がる)。
 */
export function inferFromObservation(
  observation: MoveObservation,
  knownCalc: CalcSpec,
  targetSpecies: string,
  knownRevealedItemId?: string,
  knownRevealedAbilityId?: string,
): ObservationInference | undefined {
  const statKey = resolveStatKey(observation);
  if (!statKey) return undefined;

  const isOpponentAttacking = observation.attackerSide === 'opponent';
  const observedPct = observation.defenderHpPercentBefore - observation.defenderHpPercentAfter;
  const calcOptions: CalcOptions = { isCrit: observation.wasCrit };
  const knownSpec = toBasicSpec(knownCalc);
  const evKey = STAT_KEY_MAP[statKey];
  const itemCandidates = knownRevealedItemId ? [knownRevealedItemId] : ITEM_CANDIDATES;

  const consistentNatureIds = new Set<string>();
  const consistentItemIds = new Set<string>();

  for (const bucket of BUCKETS) {
    const natureId = representativeNatureId(statKey, bucket);
    for (const itemId of itemCandidates) {
      const buildTarget = (evValue: number): PokemonSpec => ({
        species: targetSpecies,
        item: itemId === 'none' ? undefined : itemId,
        ability: knownRevealedAbilityId,
        nature: natureId,
        evs: { [evKey]: evValue },
      });

      let low: DamageResult;
      let high: DamageResult;
      try {
        if (isOpponentAttacking) {
          low = calcDamage(buildTarget(0), knownSpec, observation.moveId, undefined, calcOptions);
          high = calcDamage(buildTarget(252), knownSpec, observation.moveId, undefined, calcOptions);
        } else {
          low = calcDamage(knownSpec, buildTarget(252), observation.moveId, undefined, calcOptions);
          high = calcDamage(knownSpec, buildTarget(0), observation.moveId, undefined, calcOptions);
        }
      } catch {
        continue;
      }

      if (isWithinEnvelope(observedPct, low, high)) {
        for (const id of natureIdsInBucket(statKey, bucket)) consistentNatureIds.add(id);
        consistentItemIds.add(itemId);
      }
    }
  }

  return {
    turn: observation.turn,
    statKey,
    consistentNatureIds: [...consistentNatureIds],
    consistentItemIds: [...consistentItemIds],
  };
}

export type EvBucket = 'low' | 'high' | 'unknown';

/** 相手の攻撃力/耐久のEV傾向（振り無し寄り/振り有り寄り/判定不能）。素早さは観測ログに行動順情報が
 *  無いため推定対象外（自分の技→相手の技の記録順は常に固定で、実際の行動順とは無関係）。 */
export interface EvBucketEstimate {
  physicalAtk: EvBucket;
  specialAtk: EvBucket;
  physicalBulk: EvBucket;
  specialBulk: EvBucket;
}

export function emptyEvBucketEstimate(): EvBucketEstimate {
  return { physicalAtk: 'unknown', specialAtk: 'unknown', physicalBulk: 'unknown', specialBulk: 'unknown' };
}

function mergeEvBucket(current: EvBucket, next: EvBucket): EvBucket {
  if (next === 'unknown') return current;
  if (current === 'unknown') return next;
  return current === next ? current : 'unknown'; // 観測同士が食い違ったら判定不能に後退
}

/**
 * 1件の観測から、対象ステータスのEVが「0振り想定」「252振り想定」どちらのダメージレンジに
 * 収まるかでバケット判定する。性格は中立(neutral)代表・持ち物は代表候補1つで近似する
 * （EVバケットは参考情報の位置づけのため、性格/持ち物の厳密な絞り込みより実装を単純に保つ）。
 */
function inferEvBucketFromObservation(
  observation: MoveObservation,
  knownCalc: CalcSpec,
  targetSpecies: string,
  statKey: StatKey,
  natureId: string,
  itemId?: string,
  abilityId?: string,
): EvBucket {
  const isOpponentAttacking = observation.attackerSide === 'opponent';
  const observedPct = observation.defenderHpPercentBefore - observation.defenderHpPercentAfter;
  const calcOptions: CalcOptions = { isCrit: observation.wasCrit };
  const knownSpec = toBasicSpec(knownCalc);
  const evKey = STAT_KEY_MAP[statKey];

  const buildTarget = (evValue: number): PokemonSpec => ({
    species: targetSpecies,
    item: itemId,
    ability: abilityId,
    nature: natureId,
    evs: { [evKey]: evValue },
  });

  let dmgAt0: DamageResult;
  let dmgAt252: DamageResult;
  try {
    if (isOpponentAttacking) {
      dmgAt0 = calcDamage(buildTarget(0), knownSpec, observation.moveId, undefined, calcOptions);
      dmgAt252 = calcDamage(buildTarget(252), knownSpec, observation.moveId, undefined, calcOptions);
    } else {
      dmgAt0 = calcDamage(knownSpec, buildTarget(0), observation.moveId, undefined, calcOptions);
      dmgAt252 = calcDamage(knownSpec, buildTarget(252), observation.moveId, undefined, calcOptions);
    }
  } catch {
    return 'unknown';
  }

  const inZeroRange = observedPct >= dmgAt0.minPct - EPS && observedPct <= dmgAt0.maxPct + EPS;
  const inMaxRange = observedPct >= dmgAt252.minPct - EPS && observedPct <= dmgAt252.maxPct + EPS;

  if (inZeroRange && !inMaxRange) return 'low';
  if (inMaxRange && !inZeroRange) return 'high';
  return 'unknown';
}

/** 代表スプレッド(実データ)1つが、その観測と矛盾しないかを判定する（判定不能な観測は矛盾なし扱い）。 */
function isObservationConsistentWithSpread(
  observation: MoveObservation,
  knownCalc: CalcSpec,
  targetSpecies: string,
  spread: EnvSpread,
): boolean {
  const category = getMoveCategory(observation.moveId);
  if (!category || category === 'Status') return true;

  const isOpponentAttacking = observation.attackerSide === 'opponent';
  const observedPct = observation.defenderHpPercentBefore - observation.defenderHpPercentAfter;
  const calcOptions: CalcOptions = { isCrit: observation.wasCrit };
  const knownSpec = toBasicSpec(knownCalc);
  const targetSpec: PokemonSpec = {
    species: targetSpecies,
    item: spread.itemId,
    ability: spread.abilityId,
    nature: spread.natureId,
    evs: toStatsTableEvs(spread.evs),
    teraType: spread.teraTypeId,
  };

  let result: DamageResult;
  try {
    result = isOpponentAttacking
      ? calcDamage(targetSpec, knownSpec, observation.moveId, undefined, calcOptions)
      : calcDamage(knownSpec, targetSpec, observation.moveId, undefined, calcOptions);
  } catch {
    return true;
  }
  return observedPct >= result.minPct - EPS && observedPct <= result.maxPct + EPS;
}

export interface OpponentInferenceSummary {
  oppSlotId: string;
  observationCount: number;
  /** 全観測を通じて矛盾しなかった性格候補（観測が無ければ25種全て）。 */
  natureCandidates: string[];
  /** 全観測を通じて矛盾しなかった持ち物候補（観測が無ければカタログ全て、判明済みならその1つ）。 */
  itemCandidates: string[];
  /** 各代表スプレッド(実データ)が、蓄積された観測と矛盾しないか。 */
  spreadConsistency: { spreadName: string; consistent: boolean }[];
  /** 攻撃力/耐久のEV傾向（振り無し寄り/振り有り寄り）。素早さは推定対象外。 */
  evEstimate: EvBucketEstimate;
  note?: string;
}

/**
 * 特定の相手枠(oppSlotId)についての観測を全て集め、性格・持ち物の候補を絞り込む。
 * @param selfCalcById 観測時に場に居た自分側メンバーのCalcSpec（selfMemberId をキーに引く）。
 */
export function summarizeOpponentInference(
  oppSlotId: string,
  observations: MoveObservation[],
  selfCalcById: Record<string, CalcSpec>,
  oppSlot: OpponentSlot,
  oppParticipant: BattleParticipant,
): OpponentInferenceSummary | undefined {
  if (!oppSlot.species) return undefined;
  const relevant = observations.filter((o) => o.oppSlotId === oppSlotId);
  const species = oppSlot.species;

  let natureSet = new Set(NATURES.map((n) => n.natureId));
  let itemSet = new Set<string>(
    oppParticipant.revealedItemId ? [oppParticipant.revealedItemId] : ITEM_CANDIDATES,
  );
  const notes: string[] = [];
  if (oppParticipant.revealedItemId) notes.push('持ち物は手動入力により確定済み');
  if (oppParticipant.revealedAbilityId) notes.push('特性は手動入力により確定済み（推定精度に反映済み）');

  const evEstimate = emptyEvBucketEstimate();

  for (const obs of relevant) {
    const knownCalc = selfCalcById[obs.selfMemberId];
    if (!knownCalc) continue;
    const result = inferFromObservation(
      obs,
      knownCalc,
      species,
      oppParticipant.revealedItemId,
      oppParticipant.revealedAbilityId,
    );
    if (!result) continue;

    if (result.consistentNatureIds.length > 0) {
      const next = new Set([...natureSet].filter((id) => result.consistentNatureIds.includes(id)));
      if (next.size > 0) natureSet = next;
      else notes.push(`ターン${result.turn}の観測が他の観測と矛盾するため、性格の絞り込みを一部見送りました`);
    }
    if (!oppParticipant.revealedItemId && result.consistentItemIds.length > 0) {
      const next = new Set([...itemSet].filter((id) => result.consistentItemIds.includes(id)));
      if (next.size > 0) itemSet = next;
      else notes.push(`ターン${result.turn}の観測が他の観測と矛盾するため、持ち物の絞り込みを一部見送りました`);
    }

    const repNature = representativeNatureId(result.statKey, 'neutral');
    const repItem = oppParticipant.revealedItemId ?? [...itemSet][0];
    const bucket = inferEvBucketFromObservation(
      obs,
      knownCalc,
      species,
      result.statKey,
      repNature,
      repItem && repItem !== 'none' ? repItem : undefined,
      oppParticipant.revealedAbilityId,
    );
    if (result.statKey === 'a') evEstimate.physicalAtk = mergeEvBucket(evEstimate.physicalAtk, bucket);
    else if (result.statKey === 'c') evEstimate.specialAtk = mergeEvBucket(evEstimate.specialAtk, bucket);
    else if (result.statKey === 'b') evEstimate.physicalBulk = mergeEvBucket(evEstimate.physicalBulk, bucket);
    else if (result.statKey === 'd') evEstimate.specialBulk = mergeEvBucket(evEstimate.specialBulk, bucket);
  }

  const spreadConsistency = (oppSlot.spreads ?? []).map((spread) => ({
    spreadName: spread.name,
    consistent: relevant.every((obs) => {
      const knownCalc = selfCalcById[obs.selfMemberId];
      if (!knownCalc) return true;
      return isObservationConsistentWithSpread(obs, knownCalc, species, spread);
    }),
  }));

  return {
    oppSlotId,
    observationCount: relevant.length,
    natureCandidates: [...natureSet],
    itemCandidates: [...itemSet],
    spreadConsistency,
    evEstimate,
    note: notes.length > 0 ? notes.join(' / ') : undefined,
  };
}
