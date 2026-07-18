/**
 * 対戦中スナップショット(BattleState相当) → 使い捨ての @pkmn/sim Battle インスタンス生成。
 *
 * 純粋関数として毎回新しい Battle を作る（既存の BattleState は書き換えない）。
 * 1手の組を評価するたびに呼び、choose を2回して1ターン解決 → 評価関数へ渡す。
 */
import { Battle, Teams } from '@pkmn/sim';
import type { PRNG, PRNGSeed } from '@pkmn/sim';
import { toPokemonSet, type GtPokemonInput } from './build-pokemon-set';
import { injectField, injectParticipantState, injectSideConditions } from './snapshot-inject';
import type { BattleFieldState, BattleParticipant } from '../../../types';

export interface GtMember extends GtPokemonInput {
  participant: BattleParticipant;
}

export interface GtSideSnapshot {
  activeRefId: string;
  /** 選出済みメンバー（自分は3体、相手は判明枠。1体以上必須）。配列順が sim の team 並びになる。 */
  members: GtMember[];
}

/**
 * activeRefIdのメンバーを先頭に並べ替える。
 * こうすることで battle.actions.switchIn による再配置が不要になり、
 * 「既に場にいる個体が設置技ダメージを再度受ける」不具合を避けられる
 * （switchInは newlySwitched を立て、後から注入した設置技がターン開始時に再適用されてしまうため）。
 */
export function orderedMembers(snap: GtSideSnapshot): GtMember[] {
  const idx = snap.members.findIndex((m) => m.refId === snap.activeRefId);
  if (idx <= 0) return snap.members;
  const copy = [...snap.members];
  const [active] = copy.splice(idx, 1);
  return [active, ...copy];
}

export function buildBattleFromSnapshot(
  self: GtSideSnapshot,
  opp: GtSideSnapshot,
  field: BattleFieldState,
  seed: PRNGSeed,
  prng?: PRNG,
): Battle {
  const selfMembers = orderedMembers(self);
  const oppMembers = orderedMembers(opp);
  const p1team = Teams.pack(selfMembers.map((m) => toPokemonSet(m, { disguiseBusted: m.participant.disguiseBusted, megaUsed: m.participant.megaUsed })));
  const p2team = Teams.pack(oppMembers.map((m) => toPokemonSet(m, { disguiseBusted: m.participant.disguiseBusted, megaUsed: m.participant.megaUsed })));

  // prng を渡すと GuidedPRNG による誘導、無ければ seed から通常の乱数。
  const battle = new Battle(prng ? { formatid: 'gen9customgame' as never, prng } : { formatid: 'gen9customgame' as never, seed });
  battle.setPlayer('p1', { name: 'Self', team: p1team });
  battle.setPlayer('p2', { name: 'Opp', team: p2team });

  const teamOrder = (n: number) => 'team ' + Array.from({ length: n }, (_, i) => i + 1).join('');
  battle.choose('p1', teamOrder(selfMembers.length));
  battle.choose('p2', teamOrder(oppMembers.length));

  applySideSnapshot(battle.sides[0], selfMembers);
  applySideSnapshot(battle.sides[1], oppMembers);

  // 場の状態（self視点の selfSide=battle.sides[0]、oppSide=battle.sides[1]）
  injectField(battle, field, battle.sides[0].active[0]);
  injectSideConditions(battle, battle.sides[0], field.selfSide, battle.sides[0].active[0]);
  injectSideConditions(battle, battle.sides[1], field.oppSide, battle.sides[1].active[0]);

  // 最重要: 注入後は必ず makeRequest('move') で合法手を最新化する
  battle.makeRequest('move');
  return battle;
}

function applySideSnapshot(side: Battle['sides'][number], members: GtMember[]): void {
  // activeは既に先頭(index0)に並べ替え済みなので switchIn不要。各個体の状態を注入するだけ。
  side.pokemon.forEach((mon) => {
    const member = members.find((m) => m.refId === mon.set.name);
    if (member) injectParticipantState(mon, member.participant);
  });
  side.pokemonLeft = side.pokemon.filter((m) => !m.fainted).length;
}
