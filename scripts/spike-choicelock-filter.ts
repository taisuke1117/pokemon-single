/** タスク#38検証: choiceLockedMoveIdがenumerateLegalActions(GT行列計算)で正しくフィルタされるか。 */
import { PRNG } from '@pkmn/sim';
import { buildBattleFromSnapshot, type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import { enumerateLegalActions } from '../lib/engine/gt/legal-moves';
import { buildPayoffMatrix } from '../lib/engine/gt/matrix-builder';
import { createBattleParticipant } from '../lib/types';
import type { CalcSpec, BattleParticipant } from '../lib/types';

function part(p: Partial<BattleParticipant>): BattleParticipant { return { ...createBattleParticipant(), ...p }; }
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant> = {}): GtMember { return { refId, displayName: refId, calc, participant: part(p) }; }
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot { return { activeRefId, members }; }
function sc() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }
const field = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

const chomp: CalcSpec = { species: 'Garchomp', itemId: 'Choice Scarf', abilityId: 'Rough Skin', natureId: 'Jolly', evs: { a: 252, s: 252 }, moveIds: ['earthquake', 'dragonclaw', 'firefang', 'stoneedge'] };
const bliss: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 }, moveIds: ['seismictoss'] };

console.log('=== enumerateLegalActions: choiceLockedMoveIdなし ===');
{
  const self = side('chomp', [member('chomp', chomp)]);
  const opp = side('bliss', [member('bliss', bliss)]);
  const battle = buildBattleFromSnapshot(self, opp, field, PRNG.generateSeed());
  const actions = enumerateLegalActions(battle, 'p1');
  const moveActions = actions.filter((a) => a.kind === 'move');
  // テラスタルはこの対戦環境では使用しないため列挙されない。4技のみ。
  console.log('  技の選択肢数:', moveActions.length, '(4技のみが正しい。テラスは列挙しない)');
  check('未縛りなら4技すべて出る', moveActions.length === 4, `count=${moveActions.length}`);
}

console.log('\n=== enumerateLegalActions: choiceLockedMoveId="earthquake" ===');
{
  const self = side('chomp', [member('chomp', chomp)]);
  const opp = side('bliss', [member('bliss', bliss)]);
  const battle = buildBattleFromSnapshot(self, opp, field, PRNG.generateSeed());
  const actions = enumerateLegalActions(battle, 'p1', 'earthquake');
  const moveActions = actions.filter((a) => a.kind === 'move');
  console.log('  技の選択肢:', moveActions.map((a) => (a.kind === 'move' ? a.moveId : '')).join(','));
  const allEarthquake = moveActions.every((a) => a.kind === 'move' && a.moveId === 'earthquake');
  check('縛られた技(earthquake)のみに絞られる', moveActions.length === 1 && allEarthquake, `moves=${JSON.stringify(moveActions)}`);
}

console.log('\n=== buildPayoffMatrix経由での統合確認 ===');
{
  const self = side('chomp', [member('chomp', chomp, { choiceLockedMoveId: 'earthquake' })]);
  const opp = side('bliss', [member('bliss', bliss)]);
  const calcByRef = new Map([['chomp', chomp], ['bliss', bliss]]);
  const result = buildPayoffMatrix({ self, opp, field, calcByRef }, { samples: 4 });
  const selfMoveLabels = result.selfActions.filter((a) => a.action.kind === 'move').map((a) => a.label);
  console.log('  行列の自分側選択肢:', selfMoveLabels);
  check('行列でもじしんのみに絞られる', selfMoveLabels.length === 1 && selfMoveLabels[0] === 'じしん', `labels=${JSON.stringify(selfMoveLabels)}`);
}

console.log(`\n===== こだわり縛りフィルタスパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
