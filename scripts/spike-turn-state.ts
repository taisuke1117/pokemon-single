/**
 * T-Spike (Go/No-Go): @pkmn/sim が「対戦途中の特殊状態」を注入して1ターン解決できるか実測する。
 *
 * 検証項目:
 *  1. substitute(身代わり) の volatile 注入 → 攻撃が身代わりに吸われHP本体が減らないか
 *  2. Mimikyu-Busted(化けの皮剥がれ) を直接構築 → 攻撃ダメージが本体に通るか（素の状態）
 *  3. item 除去(タスキ消費済み) → 消費済みなら襷が働かず1発で瀕死になるか
 *  4. choice lock(こだわり縛り) → lastMove/choiceLock 設定で他技が disabled になるか
 *  5. GuidedPRNG で damage roll(random(85,101)) を誘導 → 最小/最大ロールを撃ち分けられるか
 *  6. GuidedPRNG で secondary(randomChance) を誘導 → 追加効果の発動を強制/抑止できるか
 *
 * 実行: npx tsx scripts/spike-turn-state.ts
 */
import { Battle, Teams, PRNG } from '@pkmn/sim';
import type { PokemonSet, PRNGSeed } from '@pkmn/sim';

const SEED: PRNGSeed = 'gen5,1,2,3,4';

function set(partial: Partial<PokemonSet> & { species: string }): PokemonSet {
  return {
    name: partial.name ?? partial.species,
    species: partial.species,
    item: partial.item ?? '',
    ability: partial.ability ?? '',
    moves: partial.moves ?? ['tackle'],
    nature: partial.nature ?? 'Serious',
    gender: '',
    evs: partial.evs ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: partial.ivs ?? { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: partial.level ?? 50,
    teraType: partial.teraType,
  };
}

function newBattle(p1: PokemonSet[], p2: PokemonSet[], prng?: PRNG): Battle {
  const battle = new Battle({ formatid: 'gen9customgame' as never, seed: SEED, prng });
  battle.setPlayer('p1', { name: 'P1', team: Teams.pack(p1) });
  battle.setPlayer('p2', { name: 'P2', team: Teams.pack(p2) });
  battle.choose('p1', 'team 1');
  battle.choose('p2', 'team 1');
  battle.makeRequest('move');
  return battle;
}

function hpPct(mon: { hp: number; maxhp: number }): number {
  return Math.round((mon.hp / mon.maxhp) * 100);
}

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail: string) {
  const mark = cond ? 'PASS' : 'FAIL';
  if (cond) pass++;
  else fail++;
  console.log(`  [${mark}] ${label} — ${detail}`);
}

// ------------------------------------------------------------------
// 1. substitute 注入
// ------------------------------------------------------------------
console.log('\n=== 1. 身代わり(substitute) volatile 注入 ===');
try {
  const b = newBattle([set({ species: 'Blissey', moves: ['softboiled'] })], [set({ species: 'Pikachu', moves: ['thunderbolt'], ability: 'Static', evs: { spa: 252 } })]);
  const blissey = b.sides[0].active[0];
  const before = blissey.hp;
  // addVolatile は onStart でHPを1/4削るので、途中状態の注入としては volatiles を直接セットする方式を試す
  blissey.volatiles['substitute'] = { id: 'substitute', hp: Math.floor(blissey.maxhp / 4) } as never;
  console.log(`  Blissey HP=${before}/${blissey.maxhp}, sub.hp=${(blissey.volatiles['substitute'] as { hp: number }).hp}`);
  b.choose('p1', 'move softboiled');
  b.choose('p2', 'move thunderbolt');
  const subAfter = blissey.volatiles['substitute'] as { hp: number } | undefined;
  const bodyUnchanged = blissey.hp >= before - 1; // 本体はほぼ減らない（急所等除く）
  check('身代わりが攻撃を吸う', Boolean(subAfter) ? subAfter!.hp < Math.floor(blissey.maxhp / 4) || !subAfter : true, `sub.hp=${subAfter?.hp ?? '(消滅)'} 本体HP=${blissey.hp}/${blissey.maxhp}`);
  check('本体HPが守られる', bodyUnchanged, `before=${before} after=${blissey.hp}`);
} catch (e) {
  check('身代わり注入', false, `例外: ${(e as Error).message}`);
}

// ------------------------------------------------------------------
// 2. Mimikyu-Busted 直接構築
// ------------------------------------------------------------------
console.log('\n=== 2. 化けの皮剥がれ(Mimikyu-Busted)を直接構築 ===');
try {
  const bBusted = newBattle(
    [set({ species: 'Mimikyu-Busted', ability: 'Disguise', moves: ['shadowsneak'] })],
    [set({ species: 'Tyranitar', moves: ['crunch'], ability: 'Sand Stream', evs: { atk: 252 }, nature: 'Adamant' })],
  );
  const mimi = bBusted.sides[0].active[0];
  const before = mimi.hp;
  console.log(`  Mimikyu-Busted species=${mimi.species.name} forme=${mimi.species.forme}`);
  bBusted.choose('p1', 'move shadowsneak');
  bBusted.choose('p2', 'move crunch');
  check('剥がれ状態で本体にダメージが通る', mimi.hp < before, `HP ${before}→${mimi.hp} (${hpPct(mimi)}%)`);

  // 対照: 剥がれていないMimikyuは初回無効
  const bIntact = newBattle(
    [set({ species: 'Mimikyu', ability: 'Disguise', moves: ['shadowsneak'] })],
    [set({ species: 'Tyranitar', moves: ['crunch'], ability: 'Sand Stream', evs: { atk: 252 }, nature: 'Adamant' })],
  );
  const mimi2 = bIntact.sides[0].active[0];
  const before2 = mimi2.hp;
  bIntact.choose('p1', 'move shadowsneak');
  bIntact.choose('p2', 'move crunch');
  // 化けの皮が無効化 → HPは化けの皮ぶん(1/8)しか減らない（砂ダメは別途）
  check('無傷Mimikyuは初回攻撃を無効化', hpPct(mimi2) > hpPct(mimi), `無傷${hpPct(mimi2)}% vs 剥がれ${hpPct(mimi)}% / forme=${mimi2.species.forme}`);
} catch (e) {
  check('Mimikyu-Busted構築', false, `例外: ${(e as Error).message}`);
}

// ------------------------------------------------------------------
// 3. item 除去(タスキ消費済み)
// ------------------------------------------------------------------
console.log('\n=== 3. きあいのタスキ消費済み(item除去) ===');
try {
  // タスキ持ちが高火力を受ける: item有り→1耐え、item除去→瀕死 を比較
  const attacker = () => set({ species: 'Garchomp', ability: 'Rough Skin', moves: ['earthquake'], evs: { atk: 252 }, nature: 'Adamant' });
  const sashMon = () => set({ species: 'Pikachu', item: 'Focus Sash', ability: 'Static', moves: ['thunderbolt'], evs: { spe: 252 } });

  const bWith = newBattle([sashMon()], [attacker()]);
  const pikaWith = bWith.sides[0].active[0];
  bWith.choose('p1', 'move thunderbolt');
  bWith.choose('p2', 'move earthquake');
  check('タスキ有りは1耐え', pikaWith.hp === 1 && !pikaWith.fainted, `HP=${pikaWith.hp} fainted=${pikaWith.fainted}`);

  const bWithout = newBattle([sashMon()], [attacker()]);
  const pikaWithout = bWithout.sides[0].active[0];
  pikaWithout.item = ''; // 消費済みを注入
  bWithout.choose('p1', 'move thunderbolt');
  bWithout.choose('p2', 'move earthquake');
  check('タスキ除去で瀕死になる', pikaWithout.fainted, `HP=${pikaWithout.hp} fainted=${pikaWithout.fainted}`);
} catch (e) {
  check('item除去', false, `例外: ${(e as Error).message}`);
}

// ------------------------------------------------------------------
// 4. choice lock(こだわり縛り)
//    知見: choicelock volatile を合成注入しても makeRequest の disabled 再計算に伝播しない
//    （volatile自体は正しく載るが、request側の moveSlot.disabled は false のまま）。
//    → こだわり縛りは sim注入ではなく「合法手列挙層(enumerateLegalActions)で choiceLockedMoveId
//      により技をフィルタ」して強制する方針にする。applyTurnは常に観測された唯一合法の技を渡すため、
//      sim側の縛り強制は不要。ここでは volatile が例外なく載ること（＝将来使う余地）だけ確認する。
// ------------------------------------------------------------------
console.log('\n=== 4. こだわり縛り(choice lock) ===');
try {
  const b = newBattle(
    [set({ species: 'Garchomp', item: 'Choice Scarf', ability: 'Rough Skin', moves: ['earthquake', 'dragonclaw', 'firefang', 'stoneedge'], evs: { atk: 252, spe: 252 }, nature: 'Jolly' })],
    [set({ species: 'Blissey', moves: ['softboiled'] })],
  );
  const chomp = b.sides[0].active[0];
  const savedActive = b.activeMove;
  b.activeMove = b.dex.getActiveMove('earthquake') as never;
  chomp.addVolatile('choicelock');
  b.activeMove = savedActive;
  const vol = chomp.volatiles['choicelock'] as { move?: string } | undefined;
  check('choicelock volatileは例外なく注入できる（縛り強制は列挙層で行う方針）', vol?.move === 'earthquake', `volatile.move=${vol?.move ?? '(なし)'}`);
} catch (e) {
  check('choice lock', false, `例外: ${(e as Error).message}`);
}

// ------------------------------------------------------------------
// 5. GuidedPRNG で damage roll を誘導
// ------------------------------------------------------------------
console.log('\n=== 5. GuidedPRNG: damage roll(random(85,101)) 誘導 ===');
try {
  // ダメージロールは randomizer(): baseDamage * (100 - random(16)) / 100（battle.js:2194）。
  // random(16)=0 → 最大(100%)、random(16)=15 → 最小(85%)。random(100)(secondary)とはfromで判別可。
  class RollPRNG extends PRNG {
    constructor(private reduction: number) {
      super(SEED);
    }
    random(from?: number, to?: number): number {
      if (from === 16 && to === undefined) return this.reduction;
      return super.random(from, to);
    }
  }
  function damageWithReduction(reduction: number): number {
    const prng = new RollPRNG(reduction);
    const b = newBattle(
      [set({ species: 'Garchomp', ability: 'Rough Skin', moves: ['earthquake'], evs: { atk: 252 }, nature: 'Adamant' })],
      [set({ species: 'Blissey', ability: 'Natural Cure', moves: ['thunderwave'], evs: { hp: 252, def: 252 }, nature: 'Bold' })],
      prng,
    );
    const target = b.sides[1].active[0];
    const before = target.hp;
    b.choose('p1', 'move earthquake');
    b.choose('p2', 'move thunderwave');
    return before - target.hp;
  }
  const maxDmg = damageWithReduction(0); // 減衰0 = 最大ロール
  const minDmg = damageWithReduction(15); // 減衰15 = 最小ロール
  check('最小ロールと最大ロールで差が出る', maxDmg > minDmg, `min(reduc15)=${minDmg} max(reduc0)=${maxDmg}`);
  const midDmg = damageWithReduction(8);
  check('中央ロールが範囲内', midDmg >= minDmg && midDmg <= maxDmg, `mid(reduc8)=${midDmg}`);
} catch (e) {
  check('damage roll誘導', false, `例外: ${(e as Error).message}`);
}

// ------------------------------------------------------------------
// 6. GuidedPRNG で secondary を誘導
// ------------------------------------------------------------------
console.log('\n=== 6. GuidedPRNG: secondary(randomChance) 誘導 ===');
try {
  class SecondaryPRNG extends PRNG {
    constructor(private forceProc: boolean) {
      super(SEED);
    }
    // 追加効果は random(100) を引き、secondaryRoll < chance で発動する（battle-actions.js:1333）。
    // 0を返せば必ず発動、99を返せばまず発動しない。命中は randomChance(acc,100) なので別系統。
    random(from?: number, to?: number): number {
      if (from === 100 && to === undefined) return this.forceProc ? 0 : 99;
      return super.random(from, to);
    }
  }
  function iceBeamFreeze(force: boolean): boolean {
    const prng = new SecondaryPRNG(force);
    const b = newBattle(
      [set({ species: 'Articuno', moves: ['icebeam'], ability: 'Pressure', evs: { spa: 252 }, nature: 'Modest' })],
      [set({ species: 'Blissey', moves: ['softboiled'], evs: { hp: 252 } })],
      prng,
    );
    b.choose('p1', 'move icebeam');
    b.choose('p2', 'move softboiled');
    return b.sides[1].active[0].status === 'frz';
  }
  const forced = iceBeamFreeze(true);
  const suppressed = iceBeamFreeze(false);
  check('secondary発動を強制できる', forced === true, `force=true→凍結=${forced}`);
  check('secondary発動を抑止できる', suppressed === false, `force=false→凍結=${suppressed}`);
} catch (e) {
  check('secondary誘導', false, `例外: ${(e as Error).message}`);
}

console.log(`\n===== T-Spike 結果: ${pass} PASS / ${fail} FAIL =====`);
if (fail > 0) console.log('一部FAIL: 該当項目の注入方式を再検討する必要あり。');
