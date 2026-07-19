/**
 * @pkmn/sim の Battle → ResolvedBoard(プレーンオブジェクト) への変換。
 *
 * この1回の変換を挟むことで、各評価要素関数が @pkmn/sim を一切importせず純粋関数になる
 * （オラクル盤面テストが書きやすくなる）。selfSideId で「どちらが自分か」を指定する。
 */
import { Dex, toID } from '@pkmn/sim';
import type { Battle } from '@pkmn/sim';
import type { CalcSpec, StatKey } from '../../../types';
import type { ResolvedBoard, ResolvedPokemon, ResolvedSideConditions } from '../types';

type SimSide = Battle['sides'][number];
type SimPokemon = SimSide['pokemon'][number];

const BOOST_KEYS: [StatKey, 'atk' | 'def' | 'spa' | 'spd' | 'spe'][] = [
  ['a', 'atk'],
  ['b', 'def'],
  ['c', 'spa'],
  ['d', 'spd'],
  ['s', 'spe'],
];

function toResolvedPokemon(
  mon: SimPokemon,
  calcByRef: Map<string, CalcSpec>,
  existProbByRef: Map<string, number>,
): ResolvedPokemon {
  const boosts: Partial<Record<StatKey, number>> = {};
  for (const [k, simKey] of BOOST_KEYS) {
    const v = mon.boosts[simKey];
    if (v) boosts[k] = v;
  }
  const calc = calcByRef.get(mon.set.name) ?? {
    species: mon.species.name,
    natureId: 'Serious',
    evs: {},
    moveIds: mon.set.moves,
  };
  // 特殊状態を読み戻す（T-Spike/T1で注入した状態が1ターン解決後も反映されるように）。
  const sub = mon.volatiles['substitute'] as unknown as { hp: number } | undefined;
  const choiceLock = mon.volatiles['choicelock'] as unknown as { move?: string } | undefined;
  const yawn = mon.volatiles['yawn'] as unknown as { duration?: number } | undefined;
  // ここから下は「ターンをまたぐが毎ターンBattleを作り直す設計のため保存しないと消える」
  // volatile群（あくびと同じ問題への対応、詳細は各フィールドのコメント参照）。
  const confusion = mon.volatiles['confusion'] as unknown as { time?: number } | undefined;
  const encore = mon.volatiles['encore'] as unknown as { move?: string; duration?: number } | undefined;
  const taunt = mon.volatiles['taunt'] as unknown as { duration?: number } | undefined;
  const disable = mon.volatiles['disable'] as unknown as { move?: string; duration?: number } | undefined;
  const leechseed = mon.volatiles['leechseed'] as unknown as { sourceSlot?: string } | undefined;
  const partialTrap = mon.volatiles['partiallytrapped'] as unknown as { duration?: number; sourceEffect?: { id?: string } } | undefined;
  const mustRecharge = mon.volatiles['mustrecharge'] as unknown as object | undefined;
  const stall = mon.volatiles['stall'] as unknown as { counter?: number } | undefined;
  const stockpile = mon.volatiles['stockpile'] as unknown as { layers?: number } | undefined;
  const minimize = mon.volatiles['minimize'] as unknown as object | undefined;
  const aquaRing = mon.volatiles['aquaring'] as unknown as object | undefined;
  // トレース/なりきり/なかまづくり/スキルスワップ/シンプルビーム/うるさいタネ等で元のcalc.abilityId
  // から実際の特性(mon.ability)が変わっていれば記録する（次ターンへ引き継ぐため）。
  // @smogon/calc(ダメージ計算)のabilityオプションは正式表記のみ解決できる(toIDのような正規化を
  // 行わない、実測確認済み)ため、sim小文字IDのmon.abilityではなくDexで正式表記に変換して保持する。
  const currentAbilityId =
    calc.abilityId && toID(calc.abilityId) !== mon.ability ? Dex.abilities.get(mon.ability).name : undefined;
  // みずびたし/リフレクタイプ等で本来のタイプ(mon.species.types)と現在のタイプ(mon.types)が
  // 異なっていれば記録する（同上）。
  const baseTypes = mon.species.types;
  const typesChanged = mon.types.length !== baseTypes.length || mon.types.some((t, i) => t !== baseTypes[i]);
  return {
    refId: mon.set.name,
    species: mon.species.name,
    types: mon.types,
    hpPercent: mon.fainted ? 0 : Math.round((mon.hp / mon.maxhp) * 100),
    status: mon.status || undefined,
    boosts,
    isActive: mon.isActive,
    moveIds: mon.set.moves,
    calc,
    existProbability: existProbByRef.get(mon.set.name) ?? 1,
    subHpPercent: sub && sub.hp > 0 ? Math.round((sub.hp / mon.maxhp) * 100) : undefined,
    disguiseBusted: mon.species.forme === 'Busted' || undefined,
    megaActive: /^(Mega|Primal)/.test(mon.species.forme) || undefined,
    teraActive: Boolean(mon.terastallized) || undefined,
    choiceLockedMoveId: choiceLock?.move,
    // 元スペックに道具があったのに盤面上は空 = 消費済み（襷/きのみ等が発動した）。
    itemConsumed: Boolean(calc.itemId) && !mon.item ? true : undefined,
    // mon.trapped は makeRequest('move') 後に getMoveRequestData() 内で計算される
    // （こだわり系ロック中・ありじごく/くろいまなざし等で交代不可の場合 true）。
    trapped: mon.trapped === true ? true : undefined,
    yawnActive: yawn ? true : undefined,
    confusionTurns: confusion?.time,
    encoreMoveId: encore?.move,
    encoreTurns: encore?.duration,
    tauntTurns: taunt?.duration,
    disableMoveId: disable?.move,
    disableTurns: disable?.duration,
    leechSeedSourceSlot: leechseed?.sourceSlot === 'p1a' || leechseed?.sourceSlot === 'p2a' ? leechseed.sourceSlot : undefined,
    partialTrapTurns: partialTrap?.duration,
    partialTrapMoveId: partialTrap?.sourceEffect?.id,
    mustRecharge: mustRecharge ? true : undefined,
    protectStallCounter: stall?.counter,
    stockpileLayers: stockpile?.layers,
    minimizeActive: minimize ? true : undefined,
    aquaRingActive: aquaRing ? true : undefined,
    lastMoveId: mon.lastMove?.id,
    currentAbilityId,
    typesOverride: typesChanged ? [...mon.types] : undefined,
  };
}

function toResolvedSideConditions(side: SimSide): ResolvedSideConditions {
  const sc = side.sideConditions;
  // ねがいごとはPokemon個体ではなくside.slotConditions（ダブル用の複数ポジション概念、
  // シングルバトルでは[0]のみ意味を持つ）に保存される。hpは発動時に固定される回復量(実数値)
  // なので、%換算するにはactive個体の最大HPが必要（maxhp未確定=枠が空なら換算できず無視）。
  const wish = side.slotConditions[0]?.['wish'] as unknown as { hp?: number } | undefined;
  const activeMaxHp = side.active[0]?.maxhp;
  const switchHealMoveId = side.slotConditions[0]?.['healingwish']
    ? 'healingwish'
    : side.slotConditions[0]?.['lunardance']
      ? 'lunardance'
      : undefined;
  // みらいよち/はめつのねがい: GTエンジンが明示的に注入した予約(endingTurn=-1)はそのターンの
  // 残留処理で即発動し消費されるため、この読み取り時点で残っているのは「simが技解決中に
  // 自動生成した新規発動分」のみ。よって検出できた時点で常にturnsRemaining:2として扱ってよい
  // （1→0への持ち越し・消費判定はアプリ側でboard-to-state.tsのmergeFutureAttackPendingが担う）。
  const futuremove = side.slotConditions[0]?.['futuremove'] as
    | { move?: string; source?: { set: { name: string } } }
    | undefined;
  const futureAttackPending =
    futuremove?.move && futuremove.source && (futuremove.move === 'futuresight' || futuremove.move === 'doomdesire')
      ? { moveId: futuremove.move as 'futuresight' | 'doomdesire', turnsRemaining: 2 as const, attackerRefId: futuremove.source.set.name }
      : undefined;
  return {
    spikes: (sc['spikes']?.layers as number | undefined) ?? 0,
    isSR: Boolean(sc['stealthrock']),
    isReflect: Boolean(sc['reflect']),
    isLightScreen: Boolean(sc['lightscreen']),
    isAuroraVeil: Boolean(sc['auroraveil']),
    isTailwind: Boolean(sc['tailwind']),
    wishHpPercent: wish?.hp && activeMaxHp ? Math.round((wish.hp / activeMaxHp) * 100) : undefined,
    switchHealMoveId,
    futureAttackPending,
  };
}

function sideToBoardSide(side: SimSide, calcByRef: Map<string, CalcSpec>, existProbByRef: Map<string, number>) {
  const active = side.active[0];
  const activeResolved = active ? toResolvedPokemon(active, calcByRef, existProbByRef) : undefined;
  const bench = side.pokemon.filter((m) => m !== active).map((m) => toResolvedPokemon(m, calcByRef, existProbByRef));
  return { active: activeResolved, bench, side: toResolvedSideConditions(side) };
}

/**
 * @param calcByRef refId(=PartyMember.id/OpponentSlot.id) → CalcSpec のマップ。
 *   ダメージ計算に使う元スペックを各ResolvedPokemonへ配線する。
 * @param existProbByRef refId → その個体が実際に選出に含まれている確率(0-1)。省略時は全て1。
 */
export function toResolvedBoard(
  battle: Battle,
  selfSideId: 'p1' | 'p2',
  calcByRef: Map<string, CalcSpec>,
  existProbByRef: Map<string, number> = new Map(),
): ResolvedBoard {
  const selfSim = selfSideId === 'p1' ? battle.sides[0] : battle.sides[1];
  const oppSim = selfSideId === 'p1' ? battle.sides[1] : battle.sides[0];
  const self = sideToBoardSide(selfSim, calcByRef, existProbByRef);
  const opp = sideToBoardSide(oppSim, calcByRef, existProbByRef);

  // active が居ない（両者とも瀕死送り出し前など）場合は瀕死のダミーで埋める
  const fallback: ResolvedPokemon = {
    refId: '',
    species: '',
    types: [],
    hpPercent: 0,
    boosts: {},
    isActive: false,
    moveIds: [],
    calc: { species: '', natureId: 'Serious', evs: {} },
    existProbability: 1,
  };

  let winner: 'self' | 'opp' | undefined;
  if (battle.winner === selfSim.name) winner = 'self';
  else if (battle.winner === oppSim.name) winner = 'opp';
  // winner文字列が取れない場合の保険: 残数で判定
  if (!battle.ended) winner = undefined;
  else if (!winner) {
    if (selfSim.pokemonLeft > 0 && oppSim.pokemonLeft === 0) winner = 'self';
    else if (oppSim.pokemonLeft > 0 && selfSim.pokemonLeft === 0) winner = 'opp';
  }

  return {
    self: { active: self.active ?? fallback, bench: self.bench, side: self.side },
    opp: { active: opp.active ?? fallback, bench: opp.bench, side: opp.side },
    field: {
      weather: battle.field.weather || undefined,
      terrain: battle.field.terrain || undefined,
      isTrickRoom: Boolean(battle.field.pseudoWeather['trickroom']),
    },
    turn: battle.turn,
    ended: battle.ended,
    winner,
  };
}
