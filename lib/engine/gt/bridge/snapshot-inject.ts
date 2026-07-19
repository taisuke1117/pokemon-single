/**
 * 生成済みの @pkmn/sim Battle に対して、対戦中スナップショット(HP/ランク/状態異常/設置技/場)を
 * 注入するミューテーション関数群。Phase 0スパイクで挙動を実測確認済み。
 *
 * 注意: 場のポケモン変更は必ず battle.actions.switchIn を使う（配列直接操作は slotConditions を壊す）。
 *       注入後は呼び出し側で必ず battle.makeRequest('move') を呼ぶこと（activeRequestがキャッシュされるため）。
 */
import { Dex } from '@pkmn/sim';
import type { Battle } from '@pkmn/sim';
import type { BattleFieldState, BattleParticipant, SideConditions, StatKey } from '../../../types';

type SimSide = Battle['sides'][number];
type SimPokemon = SimSide['pokemon'][number];

const BOOST_KEY_MAP: Record<StatKey, 'atk' | 'def' | 'spa' | 'spd' | 'spe'> = {
  a: 'atk',
  b: 'def',
  c: 'spa',
  d: 'spd',
  s: 'spe',
};

// 「ゆき」天候の@pkmn/sim内部IDはGen9で snowscape（'snow'ではない。sim-enum-map.ts参照）。
const WEATHER_ID: Record<NonNullable<BattleFieldState['weather']>, string> = {
  Sand: 'sandstorm',
  Sun: 'sunnyday',
  Rain: 'raindance',
  Snow: 'snowscape',
};

const TERRAIN_ID: Record<NonNullable<BattleFieldState['terrain']>, string> = {
  Electric: 'electricterrain',
  Grassy: 'grassyterrain',
  Psychic: 'psychicterrain',
  Misty: 'mistyterrain',
};

/** 生存個体に HP% / 能力ランク / 状態異常を注入する。瀕死個体は injectFainted で別処理。 */
export function injectParticipantState(mon: SimPokemon, p: BattleParticipant): void {
  if (p.currentHpPercent <= 0) {
    mon.hp = 0;
    mon.fainted = true;
    return;
  }
  mon.hp = Math.max(1, Math.round((mon.maxhp * p.currentHpPercent) / 100));
  const boosts: Partial<Record<'atk' | 'def' | 'spa' | 'spd' | 'spe', number>> = {};
  for (const [k, v] of Object.entries(p.boosts) as [StatKey, number | undefined][]) {
    if (v) boosts[BOOST_KEY_MAP[k]] = v;
  }
  if (Object.keys(boosts).length) mon.setBoost(boosts);
  if (p.status) mon.setStatus(p.status);

  // 直前に使った技: かなしばり(disable)がpokemon.lastMove.idを参照するため、他のvolatile注入より
  // 前に復元しておく（Dexから完全なMoveオブジェクトを取得して設定、ActiveMove固有の付随データ
  // (hit数/累計ダメージ等)までは復元しないが、disable等が参照するidフィールドは共通して持つ）。
  if (p.lastMoveId) {
    const move = Dex.moves.get(p.lastMoveId);
    if (move.exists) mon.lastMove = move as never;
  }

  // 道具消費済み（きあいのタスキ/きのみ等）: 盤面から道具を除去し、再び1回きり効果が働かないようにする。
  if (p.itemConsumed) mon.item = '' as never;

  // 身代わり: volatile を直接セット（T-Spikeで実測確認済み。addVolatileはonStartで再度HPを削るため使わない）。
  if (p.subHpPercent && p.subHpPercent > 0) {
    const subHp = Math.max(1, Math.round((mon.maxhp * p.subHpPercent) / 100));
    mon.volatiles['substitute'] = { id: 'substitute', hp: subHp } as never;
  }

  // あくび: duration:1で直接セットする（読み戻し時点で既にsim側のupkeepにより2→1まで
  // 減っている値なので、次のBattle再構築後もこのターンの終わりに眠りになる=正しい2ターン仕様を維持する）。
  if (p.yawnActive) {
    mon.volatiles['yawn'] = { id: 'yawn', duration: 1 } as never;
  }

  // 以下も全てyawnと同じ理由（ターンをまたぐvolatileの再注入）。sourceのような複雑な
  // オブジェクト参照は保存していないため、各effectが最低限必要とするフィールドのみ復元する。
  if (p.confusionTurns && p.confusionTurns > 0) {
    mon.volatiles['confusion'] = { id: 'confusion', time: p.confusionTurns } as never;
  }
  if (p.encoreMoveId && p.encoreTurns && p.encoreTurns > 0) {
    mon.volatiles['encore'] = { id: 'encore', move: p.encoreMoveId, duration: p.encoreTurns } as never;
  }
  if (p.tauntTurns && p.tauntTurns > 0) {
    mon.volatiles['taunt'] = { id: 'taunt', duration: p.tauntTurns } as never;
  }
  if (p.disableMoveId && p.disableTurns && p.disableTurns > 0) {
    mon.volatiles['disable'] = { id: 'disable', move: p.disableMoveId, duration: p.disableTurns } as never;
  }
  if (p.leechSeedSourceSlot) {
    mon.volatiles['leechseed'] = { id: 'leechseed', sourceSlot: p.leechSeedSourceSlot } as never;
  }
  if (p.partialTrapTurns && p.partialTrapTurns > 0) {
    // partiallytrappedのresidual処理はsource(拘束した側の実Pokemonオブジェクト)と
    // sourceEffect.idを内部で参照するため、最小構成{id,duration}だけだと例外で落ちる（実測確認済み）。
    // シングルバトル固定なので「拘束した側」は常に相手側の現在のアクティブで一意に定まる。
    // sourceEffectはDexから完全なMoveオブジェクトを引いて渡す（ログの技名表示にも使われるため、
    // {id:'bind'}のような簡易オブジェクトだと-damageログの[from]部分が"undefined"になる実害があった）。
    // boundDivisorはアイテム(ねばりのかぎづめ)条件までは再現せず、通常時のデフォルト値(8)で近似する。
    const foeActive = mon.side.foe.active[0];
    const bindMove = p.partialTrapMoveId ? Dex.moves.get(p.partialTrapMoveId) : undefined;
    if (foeActive) {
      mon.volatiles['partiallytrapped'] = {
        id: 'partiallytrapped',
        duration: p.partialTrapTurns,
        source: foeActive,
        sourceEffect: bindMove?.exists ? bindMove : { id: 'bind' },
        boundDivisor: 8,
      } as never;
    }
  }
  if (p.mustRecharge) {
    mon.volatiles['mustrecharge'] = { id: 'mustrecharge', duration: 2 } as never;
  }
  if (p.protectStallCounter && p.protectStallCounter > 1) {
    mon.volatiles['stall'] = { id: 'stall', duration: 2, counter: p.protectStallCounter } as never;
  }
  if (p.stockpileLayers && p.stockpileLayers > 0) {
    mon.volatiles['stockpile'] = { id: 'stockpile', layers: p.stockpileLayers, def: 0, spd: 0 } as never;
  }
  if (p.minimizeActive) {
    mon.volatiles['minimize'] = { id: 'minimize' } as never;
  }
  if (p.aquaRingActive) {
    mon.volatiles['aquaring'] = { id: 'aquaring' } as never;
  }

  // トレース/なりきり/なかまづくり/スキルスワップ/シンプルビーム/うるさいタネ等で元の特性から
  // 変化している場合、Battle再構築のたびに元のcalc.abilityIdへ巻き戻らないよう明示的に再設定する。
  if (p.abilityOverride) {
    mon.setAbility(p.abilityOverride);
  }
  // みずびたし/リフレクタイプ等でタイプが変化している場合も同様に再設定する。
  if (p.typesOverride && p.typesOverride.length > 0) {
    mon.setType(p.typesOverride);
  }

  // テラスタル/メガシンカ済み: @pkmn/sim の canTerastallize/canMegaEvo は Pokemon構築時に1回だけ
  // 計算され、以後「実際に使ったか」を反映して自動更新されない（simの標準仕様）。ここで明示的に
  // falseへ上書きしないと、対戦中に既に使用済みでも合法手列挙に選択肢が出続けてしまう
  // （実測でバグ再現・修正確認済み: scripts/spike-tera-bug.ts）。
  if (p.teraUsed) mon.canTerastallize = false;
  if (p.megaUsed) mon.canMegaEvo = null;
}

/** 片側の設置技(ステロ/まきびし/壁/追い風)を注入する。source はその側の任意の個体でよい（帰属表示用）。 */
export function injectSideConditions(battle: Battle, side: SimSide, cond: SideConditions, source: SimPokemon): void {
  if (cond.isSR) side.addSideCondition('stealthrock', source);
  for (let i = 0; i < cond.spikes; i++) side.addSideCondition('spikes', source);
  if (cond.isReflect) side.addSideCondition('reflect', source);
  if (cond.isLightScreen) side.addSideCondition('lightscreen', source);
  if (cond.isAuroraVeil) side.addSideCondition('auroraveil', source);
  if (cond.isTailwind) side.addSideCondition('tailwind', source);

  // ねがいごと: Pokemon個体ではなくside.slotConditions(ダブル用の複数ポジション概念、シングルでは
  // [0]のみ)に保存される。@pkmn/simは絶対ターン番号(getOverflowedTurnCount)で発動判定するが、
  // 毎ターンBattleを作り直す設計では新しいBattleのturnは常に1から始まるため、startingTurnを
  // 「現在のturnより前」の値(-1)に固定すれば、次のresidual処理で確実に発動する
  // （あくびのduration:1固定と同じ発想）。
  const active = side.active[0];
  if (cond.wishHpPercent && active) {
    side.addSlotCondition(active, 'wish', source);
    const state = side.slotConditions[0]?.['wish'] as unknown as { hp?: number; startingTurn?: number } | undefined;
    if (state) {
      state.hp = Math.max(1, Math.round((active.maxhp * cond.wishHpPercent) / 100));
      state.startingTurn = -1;
    }
  }

  // いやしのねがい/げつのひかり: wishと違いresidualではなくonSwitchIn契機で発動するため
  // startingTurnの調整は不要（addSlotConditionするだけで次の交代時に効く）。
  if (cond.switchHealMoveId && active) {
    side.addSlotCondition(active, cond.switchHealMoveId, source);
  }
}

/** 天候/フィールド/トリックルームを注入する。source は任意の場の個体。 */
export function injectField(battle: Battle, field: BattleFieldState, source: SimPokemon): void {
  if (field.weather) battle.field.setWeather(WEATHER_ID[field.weather], source);
  if (field.terrain) battle.field.setTerrain(TERRAIN_ID[field.terrain], source);
  if (field.isTrickRoom) battle.field.addPseudoWeather('trickroom', source);
}
