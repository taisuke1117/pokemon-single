/** メガ進化した状態が「次ターン」の盤面構築に引き継がれるか確認。 */
import { PRNG } from '@pkmn/sim';
import { buildBattleFromSnapshot, type GtMember, type GtSideSnapshot } from '../lib/engine/gt/bridge/build-battle';
import { createBattleParticipant } from '../lib/types';
import type { CalcSpec, BattleParticipant } from '../lib/types';

function part(p: Partial<BattleParticipant>): BattleParticipant { return { ...createBattleParticipant(), ...p }; }
function member(refId: string, calc: CalcSpec, p: Partial<BattleParticipant> = {}): GtMember { return { refId, displayName: refId, calc, participant: part(p) }; }
function side(activeRefId: string, members: GtMember[]): GtSideSnapshot { return { activeRefId, members }; }
function sc() { return { spikes: 0, isSR: false, isReflect: false, isLightScreen: false, isAuroraVeil: false, isTailwind: false }; }
const field = { isTrickRoom: false, selfSide: sc(), oppSide: sc() };

const metagross: CalcSpec = { species: 'Metagross-Mega', abilityId: 'Tough Claws', natureId: 'Jolly', evs: { a: 252, s: 252 }, moveIds: ['meteormash'] };
const bliss: CalcSpec = { species: 'Blissey', itemId: 'Leftovers', abilityId: 'Natural Cure', natureId: 'Calm', evs: { h: 252, d: 252 }, moveIds: ['seismictoss'] };

// megaUsed:true(既にメガ済み)の状態で次ターンの盤面を構築 → 実際の種族/特性/素早さがメガ体かベース体か確認
const self = side('meta', [member('meta', metagross, { megaUsed: true })]);
const opp = side('bliss', [member('bliss', bliss)]);
const battle = buildBattleFromSnapshot(self, opp, field, PRNG.generateSeed());
const mon = battle.sides[0].active[0];
console.log('species:', mon.species.name, '(期待: Metagross-Mega)');
console.log('ability:', mon.ability, '(期待: toughclaws。ベース体ならclearbody)');
console.log('speed実数値:', mon.storedStats.spe, '(メガメタ=高速、ベース体=低速)');
