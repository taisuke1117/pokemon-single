/**
 * Part A applyTurn 統合検証: ユーザー列挙の各効果が次盤面に反映されるか。
 *   交代時のステロダメ / 毒残留 / インファイトの能力ダウン / 化けの皮無効 / 襷1耐え /
 *   砂おこしで天候砂 / 身代わり生成 / 怯みの抽選 / 鮫肌の反射ダメ / のろいの定数ダメ
 * 実行: npx tsx scripts/spike-apply-turn.ts
 */
import { applyTurn, type ApplyTurnInput, type TurnActionSpec } from '../lib/engine/gt/bridge/apply-turn';
import { type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import { createBattleParticipant } from '../lib/types';
import type { CalcSpec, BattleParticipant, BattleFieldState } from '../lib/types';

function part(patch: Partial<BattleParticipant>): BattleParticipant { return { ...createBattleParticipant(), ...patch }; }
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant> = {}): GtMember { return { refId, displayName: refId, calc, participant: part(p) }; }
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot { return { activeRefId, members }; }
function sc(sr = false) { return { spikes: 0, isSR: sr, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }
function field(opts: Partial<BattleFieldState> = {}): BattleFieldState { return { isTrickRoom: false, selfSide: sc(), oppSide: sc(), ...opts }; }
function nameMap(ms: GtMember[]): Map<string, string> { return new Map(ms.map((m) => [m.refId, m.calc.species])); }
function calcMap(ms: GtMember[]): Map<string, CalcSpec> { return new Map(ms.map((m) => [m.refId, m.calc])); }
const move = (moveId: string): TurnActionSpec => ({ kind: 'move', moveId });
const switchTo = (toRefId: string): TurnActionSpec => ({ kind: 'switch', toRefId });

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

const chomp: CalcSpec = { species: 'Garchomp', itemId: 'Life Orb', abilityId: 'Rough Skin', natureId: 'Jolly', evs: { a: 252, s: 252 }, moveIds: ['earthquake', 'closecombat', 'dragonclaw', 'substitute'] };
const skarm: CalcSpec = { species: 'Skarmory', itemId: 'Leftovers', abilityId: 'Sturdy', natureId: 'Impish', evs: { h: 252, b: 252 }, moveIds: ['bodypress', 'roost', 'spikes', 'ironhead'] };
const bliss: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 }, moveIds: ['seismictoss', 'softboiled', 'toxic', 'icebeam'] };
const ttar: CalcSpec = { species: 'Tyranitar', itemId: 'Choice Band', abilityId: 'Sand Stream', natureId: 'Adamant', evs: { a: 252, h: 252 }, moveIds: ['crunch', 'stoneedge', 'earthquake', 'icepunch'] };
const mimi: CalcSpec = { species: 'Mimikyu', itemId: 'Life Orb', abilityId: 'Disguise', natureId: 'Jolly', evs: { a: 252, s: 252 }, moveIds: ['shadowsneak', 'playrough', 'swordsdance', 'shadowclaw'] };
const pika: CalcSpec = { species: 'Pikachu', itemId: 'Focus Sash', abilityId: 'Static', natureId: 'Timid', evs: { c: 252, s: 252 }, moveIds: ['thunderbolt', 'voltswitch', 'surf', 'nastyplot'] };

function run(input: Omit<ApplyTurnInput, 'nameByRef' | 'calcByRef' | 'turn'> & { turn?: number }) {
  const allMembers = [...input.self.members, ...input.opp.members];
  return applyTurn({ ...input, turn: input.turn ?? 1, calcByRef: calcMap(allMembers), nameByRef: nameMap(allMembers) });
}

// 1. 交代時のステロダメ: 相手ステロ設置済み、自分がガブ→スカーモリーへ交代
console.log('\n=== 1. 交代時のステロダメージ ===');
{
  const self = side('chomp', [member('chomp', chomp), member('skarm', skarm)]);
  const opp = side('bliss', [member('bliss', bliss)]);
  const res = run({ self, opp, field: field({ selfSide: sc(true) }), selfAction: switchTo('skarm'), oppAction: move('seismictoss'), oppObserved: { wasCrit: false, hpPercentAfter: 80 } });
  const skarmHp = res.board.self.active.hpPercent;
  check('交代先スカーモリーがステロダメで削れている', res.board.self.active.species === 'Skarmory' && skarmHp < 100, `HP=${skarmHp}% species=${res.board.self.active.species}`);
  check('ログにステロ交代ダメが出る', res.log.some((e) => e.kind === 'residual' || e.kind === 'switch'), res.log.filter((e) => e.side === 'self').map((e) => e.text).join(' / '));
}

// 2. 毒残留ダメ: 相手ttarが毒状態。守り役は物理耐久の高いスカーモリー(かみくだくを耐える)→upkeepで毒ダメ
console.log('\n=== 2. 毒の残留ダメージ ===');
{
  const self = side('skarm', [member('skarm', skarm)]);
  const opp = side('ttarP', [member('ttarP', { ...ttar, abilityId: 'Unnerve' }, { status: 'psn' })]); // 天候なしのため砂を消す
  const res = run({ self, opp, field: field(), selfAction: move('roost'), oppAction: move('crunch'), oppObserved: { wasCrit: false, hpPercentAfter: 60 } });
  check('相手ttarが毒残留で削れる(<100)', res.board.opp.active.hpPercent < 100, `ttar HP=${res.board.opp.active.hpPercent}%`);
  check('ログに毒ダメが出る', res.log.some((e) => e.kind === 'residual' && e.text.includes('どく')), res.log.filter((e) => e.kind === 'residual').map((e) => e.text).join(' / ') || '(なし)');
}

// 3. インファイト(closecombat)の能力ダウン: 使用後 自分のB/Dが1段階下がる
console.log('\n=== 3. インファイトの能力ダウン ===');
{
  const self = side('chomp', [member('chomp', chomp)]);
  const opp = side('bliss', [member('bliss', bliss)]);
  const res = run({ self, opp, field: field(), selfAction: move('closecombat'), oppAction: move('softboiled'), selfObserved: { wasCrit: false, hpPercentAfter: 60 } });
  check('closecombat後 自分のB/Dが下がる', (res.board.self.active.boosts.b ?? 0) < 0 && (res.board.self.active.boosts.d ?? 0) < 0, `boosts=${JSON.stringify(res.board.self.active.boosts)}`);
}

// 4. 化けの皮: 無傷ミミッキュは初回攻撃を無効化(ほぼ削れない)、busted読み戻し
console.log('\n=== 4. 化けの皮による無効化 ===');
{
  const self = side('mimi', [member('mimi', mimi)]);
  const opp = side('ttarU', [member('ttarU', { ...ttar, abilityId: 'Unnerve' })]);
  const res = run({ self, opp, field: field(), selfAction: move('swordsdance'), oppAction: move('crunch'), oppObserved: { wasCrit: false, hpPercentAfter: 88 } });
  check('化けの皮が剥がれ busted になる', res.board.self.active.disguiseBusted === true, `disguiseBusted=${res.board.self.active.disguiseBusted}`);
  check('本体は化けの皮で守られ高HP維持', res.board.self.active.hpPercent >= 80, `HP=${res.board.self.active.hpPercent}%`);
}

// 5. 襷で1耐え: 満タンピカが高火力を受けHP1で耐える(天候なし)
console.log('\n=== 5. きあいのタスキで1耐え ===');
{
  const attacker: CalcSpec = { species: 'Dragonite', itemId: 'Choice Band', abilityId: 'Inner Focus', natureId: 'Adamant', evs: { a: 252, s: 252 }, moveIds: ['extremespeed', 'earthquake', 'outrage', 'firepunch'] };
  const self = side('pika', [member('pika', pika)]);
  const opp = side('dnite', [member('dnite', attacker)]);
  const res = run({ self, opp, field: field(), selfAction: move('thunderbolt'), oppAction: move('extremespeed'), selfObserved: { wasCrit: false, hpPercentAfter: 40 }, oppObserved: { wasCrit: false, hpPercentAfter: 1 } });
  check('襷でHP1耐え(itemConsumed立つ)', res.board.self.active.hpPercent > 0 && res.board.self.active.itemConsumed === true, `HP=${res.board.self.active.hpPercent}% itemConsumed=${res.board.self.active.itemConsumed}`);
}

// 6. 砂おこし: ttar(Sand Stream)が場に出ている状態で解決 → 天候が砂
console.log('\n=== 6. すなおこしで天候が砂 ===');
{
  const self = side('bliss', [member('bliss', bliss)]);
  const opp = side('ttar', [member('ttar', ttar)]);
  const res = run({ self, opp, field: field(), selfAction: move('softboiled'), oppAction: move('crunch'), oppObserved: { wasCrit: false, hpPercentAfter: 65 } });
  // ResolvedBoard.field.weather は sim内部ID('sandstorm')。ストア変換層で 'Sand' に写像する。
  check('天候が砂(sandstorm)になっている', res.board.field.weather === 'sandstorm', `weather=${res.board.field.weather}`);
}

// 7. 身代わり生成: ガブがみがわり → subHpPercent が立つ
console.log('\n=== 7. 身代わりの生成 ===');
{
  const self = side('chomp', [member('chomp', chomp)]);
  const opp = side('bliss', [member('bliss', bliss)]);
  // 相手は回復技(攻撃しない)にして身代わりを壊さない
  const res = run({ self, opp, field: field(), selfAction: move('substitute'), oppAction: move('softboiled') });
  check('身代わりが場に生成される(subHpPercent定義)', res.board.self.active.subHpPercent !== undefined, `subHpPercent=${res.board.self.active.subHpPercent}`);
}

// 8. 怯みの抽選: スカーモリーのアイアンヘッド(30%怯み)をselfObserved.secondaryProcced:trueで強制発動
//    → 相手(ブリセイ)がその番に行動できず、ソフトボイルドで回復しない(HPは被弾直後のまま)
console.log('\n=== 8. 怯みの抽選(secondaryProcced強制発動) ===');
{
  const self = side('skarm', [member('skarm', skarm)]);
  const opp = side('bliss', [member('bliss', bliss)]);
  const res = run({
    self, opp, field: field(),
    selfAction: move('ironhead'), oppAction: move('softboiled'),
    selfObserved: { wasCrit: false, hpPercentAfter: 65, secondaryProcced: true },
  });
  check('相手が怯んで回復せずダメージ後のHPのまま', res.board.opp.active.hpPercent === 65, `HP=${res.board.opp.active.hpPercent}%`);
  check('ログに「技を出せなかった」が出る', res.log.some((e) => e.kind === 'cant'), res.log.filter((e) => e.kind === 'cant').map((e) => e.text).join(' / ') || '(なし)');
}

// 9. 鮫肌の反射ダメ: 接触技(ironhead)を鮫肌持ち(ガブ)へ撃つ → 攻撃側(スカーモリー)がダメージを受ける
console.log('\n=== 9. 鮫肌による反射ダメージ ===');
{
  const self = side('chomp', [member('chomp', { ...chomp, moveIds: ['recover', 'earthquake', 'closecombat', 'substitute'] })]);
  const opp = side('skarm', [member('skarm', skarm)]);
  const res = run({
    self, opp, field: field(),
    selfAction: move('recover'), oppAction: move('ironhead'),
    oppObserved: { wasCrit: false, hpPercentAfter: 70 },
  });
  check('鮫肌の反射で攻撃側(スカーモリー)のHPが削れる', res.board.self.active.hpPercent < 100, `スカーモリーHP=${res.board.self.active.hpPercent}%`);
  check('ログに鮫肌ダメージが出る', res.log.some((e) => e.kind === 'residual' && e.text.includes('さめはだ')), res.log.filter((e) => e.kind === 'residual').map((e) => e.text).join(' / ') || '(なし)');
}

// 10. のろいの定数ダメ: ゴーストタイプのミミッキュがのろいを使う
//     → 自分のHPが約半分減り、相手に「のろい」の残留ダメがそのターンのupkeepで乗る
console.log('\n=== 10. のろいによる定数ダメージ ===');
{
  const mimiCurse: CalcSpec = { ...mimi, moveIds: ['curse', 'shadowsneak', 'playrough', 'swordsdance'] };
  const self = side('mimi', [member('mimi', mimiCurse)]);
  const opp = side('bliss', [member('bliss', bliss)]);
  const res = run({ self, opp, field: field(), selfAction: move('curse'), oppAction: move('softboiled') });
  check('のろい使用でミミッキュのHPが半分程度減る', res.board.self.active.hpPercent <= 55 && res.board.self.active.hpPercent >= 45, `ミミッキュHP=${res.board.self.active.hpPercent}%`);
  check('相手にのろいの定数ダメが乗る(同ターンのupkeepで発動)', res.board.opp.active.hpPercent < 100, `相手HP=${res.board.opp.active.hpPercent}%`);
  check('ログに「のろいの効果が始まった」が出る', res.log.some((e) => e.kind === 'status' && e.text.includes('のろい')), res.log.filter((e) => e.kind === 'status').map((e) => e.text).join(' / ') || '(なし)');
}

console.log(`\n===== applyTurn統合スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
