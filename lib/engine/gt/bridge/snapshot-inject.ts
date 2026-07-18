/**
 * 生成済みの @pkmn/sim Battle に対して、対戦中スナップショット(HP/ランク/状態異常/設置技/場)を
 * 注入するミューテーション関数群。Phase 0スパイクで挙動を実測確認済み。
 *
 * 注意: 場のポケモン変更は必ず battle.actions.switchIn を使う（配列直接操作は slotConditions を壊す）。
 *       注入後は呼び出し側で必ず battle.makeRequest('move') を呼ぶこと（activeRequestがキャッシュされるため）。
 */
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

const WEATHER_ID: Record<NonNullable<BattleFieldState['weather']>, string> = {
  Sand: 'sandstorm',
  Sun: 'sunnyday',
  Rain: 'raindance',
  Snow: 'snow',
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

  // 道具消費済み（きあいのタスキ/きのみ等）: 盤面から道具を除去し、再び1回きり効果が働かないようにする。
  if (p.itemConsumed) mon.item = '' as never;

  // 身代わり: volatile を直接セット（T-Spikeで実測確認済み。addVolatileはonStartで再度HPを削るため使わない）。
  if (p.subHpPercent && p.subHpPercent > 0) {
    const subHp = Math.max(1, Math.round((mon.maxhp * p.subHpPercent) / 100));
    mon.volatiles['substitute'] = { id: 'substitute', hp: subHp } as never;
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
}

/** 天候/フィールド/トリックルームを注入する。source は任意の場の個体。 */
export function injectField(battle: Battle, field: BattleFieldState, source: SimPokemon): void {
  if (field.weather) battle.field.setWeather(WEATHER_ID[field.weather], source);
  if (field.terrain) battle.field.setTerrain(TERRAIN_ID[field.terrain], source);
  if (field.isTrickRoom) battle.field.addPseudoWeather('trickroom', source);
}
