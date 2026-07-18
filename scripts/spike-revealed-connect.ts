/**
 * Part C3 検証: 対戦画面で手入力した判明情報(持ち物/特性/性格/努力値/テラスタイプ)が
 * GT計算用のCalcSpecに正しく反映されるか。
 * 実行: npx tsx scripts/spike-revealed-connect.ts
 */
import { applyRevealed, oppToCalc } from '../lib/engine/gt/bridge/battle-state-adapter';
import { createBattleParticipant, type BattleState, type OpponentSlot } from '../lib/types';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

const slot: OpponentSlot = {
  id: 'slot1',
  query: 'ミミッキュ',
  resolvedName: 'ミミッキュ',
  species: 'Mimikyu',
  types: ['ゴースト', 'フェアリー'],
  rank: 3,
  spreads: [
    { name: '主流', prob: 0.7, item: 'いのちのたま', itemId: 'Life Orb', ability: 'ばけのかわ', abilityId: 'Disguise', nature: 'ようき', natureId: 'Jolly', evs: { a: 252, s: 252 } },
  ],
  moveUsage: [],
};

const rawCalc = oppToCalc(slot);
if (!rawCalc) throw new Error('oppToCalc failed');
console.log('=== 代表スプレッドのみ(未判明) ===');
console.log(JSON.stringify(rawCalc));
check('未判明時はitemIdが代表スプレッド由来', rawCalc.itemId === 'Life Orb', `itemId=${rawCalc.itemId}`);

const stateWithReveal: BattleState = {
  turn: 1,
  selfActiveMemberId: 's1',
  oppActiveSlotId: 'slot1',
  self: {},
  opponent: {
    slot1: {
      ...createBattleParticipant(),
      revealedItemId: 'Choice Scarf',
      revealedAbilityId: 'Disguise',
      revealedNatureId: 'Timid',
      revealedEvs: { s: 252, h: 4 },
      revealedTeraTypeId: 'Fairy',
    },
  },
  field: { isTrickRoom: false, selfSide: { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }, oppSide: { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false } },
  observations: [],
};

const revealedCalc = applyRevealed(rawCalc, slot, stateWithReveal);
console.log('\n=== 判明情報を反映後 ===');
console.log(JSON.stringify(revealedCalc));

check('itemIdが判明値(Choice Scarf)で上書きされる', revealedCalc.itemId === 'Choice Scarf', `itemId=${revealedCalc.itemId}`);
check('natureIdが判明値(Timid)で上書きされる', revealedCalc.natureId === 'Timid', `natureId=${revealedCalc.natureId}`);
check('teraTypeIdが判明値(Fairy)で上書きされる', revealedCalc.teraTypeId === 'Fairy', `teraTypeId=${revealedCalc.teraTypeId}`);
check('evsが判明分(s,h)だけ上書きされ、他(a)は代表スプレッド値を維持', revealedCalc.evs.s === 252 && revealedCalc.evs.h === 4 && revealedCalc.evs.a === 252, `evs=${JSON.stringify(revealedCalc.evs)}`);

console.log(`\n===== 判明情報接続スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
