/**
 * 評価関数のオラクル検算（答えが自明な盤面で妥当性を確認する）。
 * ResolvedBoardを手で組み立てて evaluateBreakdown に流す（評価要素は純粋関数）。
 *
 * 実行: npx tsx scripts/verify-oracle-boards.ts
 * 全ケースが期待の符号・大小を満たせば "ALL PASS"。
 */
import { evaluateBreakdown } from '../lib/engine/gt/eval/compose';
import type { CalcSpec } from '../lib/types';
import type { ResolvedBoard, ResolvedPokemon, ResolvedSideConditions } from '../lib/engine/gt/types';

function emptySide(): ResolvedSideConditions {
  return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false };
}

let mkId = 0;
function mon(
  species: string,
  hpPercent: number,
  calc: CalcSpec,
  opts?: { types?: string[]; status?: string; isActive?: boolean; boosts?: ResolvedPokemon['boosts'] },
): ResolvedPokemon {
  return {
    refId: `m${mkId++}`,
    species,
    types: opts?.types ?? [],
    hpPercent,
    status: opts?.status,
    boosts: opts?.boosts ?? {},
    isActive: opts?.isActive ?? false,
    moveIds: calc.moveIds ?? [],
    calc,
    existProbability: 1,
  };
}

// 具体的なcalcスペック（ダメージ計算が現実的な値を出すように実在ポケで）
const garchomp: CalcSpec = { species: 'Garchomp', itemId: 'Life Orb', abilityId: 'Rough Skin', natureId: 'Jolly', evs: { a: 252, s: 252, h: 4 }, moveIds: ['Earthquake', 'Outrage', 'Scale Shot', 'Fire Fang'] };
const blissey: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252, b: 4 }, moveIds: ['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Ice Beam'] };
const magikarp: CalcSpec = { species: 'Magikarp', itemId: '', abilityId: 'Swift Swim', natureId: 'Adamant', evs: {}, moveIds: ['Tackle', 'Splash'] };
const hippo: CalcSpec = { species: 'Hippowdon', itemId: 'Leftovers', abilityId: 'Sand Stream', natureId: 'Impish', evs: { h: 252, b: 252, d: 4 }, moveIds: ['Earthquake', 'Slack Off', 'Stealth Rock', 'Yawn'] };

function board(self: Partial<ResolvedBoard['self']>, opp: Partial<ResolvedBoard['opp']>, extra?: Partial<ResolvedBoard>): ResolvedBoard {
  const fallback = mon('', 0, { species: '', natureId: 'Serious', evs: {} });
  return {
    self: { active: self.active ?? fallback, bench: self.bench ?? [], side: self.side ?? emptySide() },
    opp: { active: opp.active ?? fallback, bench: opp.bench ?? [], side: opp.side ?? emptySide() },
    field: extra?.field ?? { isTrickRoom: false },
    turn: extra?.turn ?? 5,
    ended: extra?.ended ?? false,
    winner: extra?.winner,
  };
}

let failures = 0;
function assert(label: string, cond: boolean, detail: string) {
  const mark = cond ? '✓' : '✗';
  if (!cond) failures++;
  console.log(`  ${mark} ${label} — ${detail}`);
}

// === A: 相手全滅 → +terminalWin ===
{
  const b = board(
    { active: mon('Garchomp', 100, garchomp, { types: ['Dragon', 'Ground'], isActive: true }) },
    {},
    { ended: true, winner: 'self' },
  );
  const e = evaluateBreakdown(b);
  console.log('[A 相手全滅]');
  assert('terminal ≒ +10000', e.terminal === 10000, `terminal=${e.terminal}`);
  assert('total 大きく正', e.total > 9000, `total=${e.total.toFixed(2)}`);
}

// === B: 完全ミラー → 0 ===
{
  const selfMon = mon('Garchomp', 100, garchomp, { types: ['Dragon', 'Ground'], isActive: true });
  const oppMon = mon('Garchomp', 100, garchomp, { types: ['Dragon', 'Ground'], isActive: true });
  const b = board({ active: selfMon }, { active: oppMon });
  const e = evaluateBreakdown(b);
  console.log('[B 完全ミラー]');
  assert('total ≒ 0（符号対称）', Math.abs(e.total) < 1e-6, `total=${e.total}`);
}

// === C: 物量+テンポ有利（自分6体分HP満タン、相手1体瀕死寸前）→ 大きく + ===
{
  const b = board(
    {
      active: mon('Garchomp', 100, garchomp, { types: ['Dragon', 'Ground'], isActive: true }),
      bench: [mon('Hippowdon', 100, hippo, { types: ['Ground'] }), mon('Blissey', 100, blissey, { types: ['Normal'] })],
    },
    { active: mon('Magikarp', 5, magikarp, { types: ['Water'], isActive: true }) },
  );
  const e = evaluateBreakdown(b);
  console.log('[C 物量+テンポ有利]');
  assert('survival 大きく正', e.survival > 3, `survival=${e.survival.toFixed(2)}`);
  assert('total 大きく正', e.total > 3, `total=${e.total.toFixed(2)}`);
}

// === D1: 無傷エースが全抜き圏 → wincon発火（+）===
{
  // ガブ(100%, 速い) vs コイキング1体(遅い・柔らかい) → 上から確定1発で全抜き
  const b = board(
    { active: mon('Garchomp', 100, garchomp, { types: ['Dragon', 'Ground'], isActive: true }) },
    { active: mon('Magikarp', 100, magikarp, { types: ['Water'], isActive: true }) },
  );
  const e = evaluateBreakdown(b);
  console.log('[D1 無傷エース全抜き圏]');
  assert('wincon 正に発火', e.wincon > 0, `wincon=${e.wincon}`);
}

// === D2: 瀕死5%の+6積み → wincon不発（罠回避）===
{
  // ガブが+6でも5%HP。相手は無傷コイキング1体。無傷ゲートでガブはwincon候補にならない。
  const b = board(
    { active: mon('Garchomp', 5, garchomp, { types: ['Dragon', 'Ground'], isActive: true, boosts: { a: 6, s: 6 } }) },
    { active: mon('Magikarp', 100, magikarp, { types: ['Water'], isActive: true }) },
  );
  const e = evaluateBreakdown(b);
  console.log('[D2 瀕死5%+6積み（罠）]');
  // 自分側winconは発火しない（無傷ゲート）。相手コイキングは全抜き力ないので相手winconも0。
  assert('自分wincon発火しない（罠回避）', e.wincon <= 0, `wincon=${e.wincon}`);
  assert('total は正に振れない（死に票）', e.total < 3, `total=${e.total.toFixed(2)}`);
}

console.log(`\n${failures === 0 ? '=== ALL PASS ===' : `=== ${failures} FAILURE(S) ===`}`);
process.exit(failures === 0 ? 0 : 1);
