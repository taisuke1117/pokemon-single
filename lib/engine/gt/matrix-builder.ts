/**
 * 利得行列の構築。自分の合法手×相手の合法手の全ペアについて期待セル値を計算する。
 * 合法手は seed非依存なので1つのBattleから列挙し、各セルはN回サンプリングで期待値を取る。
 */
import { Dex } from '@pkmn/sim';
import { buildBattleFromSnapshot, orderedMembers } from './bridge/build-battle';
import { enumerateLegalActions, isForceSwitch } from './legal-moves';
import { expectedCellValue, type SnapshotArgs, DEFAULT_SAMPLES } from './chance-sampling';
import { moveJa } from '../../data/move-ja';
import type { GtAction, GtActionLabel, PayoffMatrix } from './types';

/**
 * @pkmn/sim の activeRequest が返す技IDは小文字ID(例:"surgingstrikes")。
 * moveJa辞書のキーは正式表記(例:"Surging Strikes")なので、Dexで正式名に直してから日本語化する。
 */
function moveIdToJa(simMoveId: string): string {
  const move = Dex.moves.get(simMoveId);
  return move.exists ? moveJa(move.name) : moveJa(simMoveId);
}

function labelFor(action: GtAction, benchName: (i: number) => string): GtActionLabel {
  if (action.kind === 'switch') return { action, label: `交代→${benchName(action.toIndex)}` };
  let label = moveIdToJa(action.moveId);
  if (action.mega) label += '（メガ）';
  if (action.terastallize) label += '（テラス）';
  return { action, label };
}

export interface MatrixBuildOptions {
  samples?: number;
  /** 行/列の最大手数（肥大化防止）。超えたら先頭から切る。 */
  maxActions?: number;
}

export interface MatrixBuildResult extends PayoffMatrix {
  /** どちらかが瀕死送り出し中で通常の同時手番でない場合 true（呼び出し側で別扱い可能）。 */
  isForceSwitchContext: boolean;
}

export function buildPayoffMatrix(args: SnapshotArgs, options?: MatrixBuildOptions): MatrixBuildResult {
  const samples = options?.samples ?? DEFAULT_SAMPLES;
  const maxActions = options?.maxActions ?? 12;

  // 合法手列挙用に1つBattleをつくるだけならDEFAULTのseedで十分（列挙は乱数非依存）
  const probe = buildBattleFromSnapshot(args.self, args.opp, args.field, '1,2,3,4');
  const forceSwitchContext = isForceSwitch(probe, 'p1') || isForceSwitch(probe, 'p2');

  const selfActiveMember = args.self.members.find((m) => m.refId === args.self.activeRefId);
  const oppActiveMember = args.opp.members.find((m) => m.refId === args.opp.activeRefId);
  let selfActions = enumerateLegalActions(probe, 'p1', selfActiveMember?.participant.choiceLockedMoveId).slice(0, maxActions);
  let oppActions = enumerateLegalActions(probe, 'p2', oppActiveMember?.participant.choiceLockedMoveId).slice(0, maxActions);
  if (selfActions.length === 0) selfActions = [{ kind: 'move', moveId: 'struggle' }];
  if (oppActions.length === 0) oppActions = [{ kind: 'move', moveId: 'struggle' }];

  // enumerateLegalActionsが返すswitch.toIndexは「activeが先頭に並べ替えられた配列」上のインデックス
  // (build-battle.tsのorderedMembers参照)。args.self.members/args.opp.membersは並べ替え前の元順序なので、
  // toIndexで直接引くとactive自身を指してしまい「今場に出ている個体に交代」という誤ったラベル・重み付けになる。
  const selfOrdered = orderedMembers(args.self);
  const oppOrdered = orderedMembers(args.opp);
  const selfBenchName = (i: number) => selfOrdered[i]?.displayName ?? `控え${i + 1}`;
  const oppBenchName = (i: number) => oppOrdered[i]?.displayName ?? `控え${i + 1}`;
  const selfLabels = selfActions.map((a) => labelFor(a, selfBenchName));
  const oppLabels = oppActions.map((a) => labelFor(a, oppBenchName));

  const matrix: number[][] = selfActions.map((sa) =>
    oppActions.map((oa) => expectedCellValue(args, sa, oa, samples)),
  );

  // 相手の交代先がまだ選出確定していない候補(existProbability<1)の場合、そのセルは
  // 「実際にその個体を選出に含んでいる確率」で重み付けし、含まれていない場合の代替として
  // 「相手が今の場のポケモンのまま技を使った」列群の平均値とブレンドする
  // （出てくる割合をかけた上で、相手の全ポケモンが出てくる事象を計算する）。
  const existProbByRef = args.existProbByRef;
  if (existProbByRef) {
    const moveColumnIndices = oppActions.map((a, idx) => (a.kind === 'move' ? idx : -1)).filter((idx) => idx >= 0);
    oppActions.forEach((action, j) => {
      if (action.kind !== 'switch') return;
      const targetRefId = oppOrdered[action.toIndex]?.refId;
      const p = targetRefId ? existProbByRef.get(targetRefId) : undefined;
      if (p === undefined || p >= 1) return;
      matrix.forEach((row) => {
        const fallback = moveColumnIndices.length
          ? moveColumnIndices.reduce((sum, idx) => sum + row[idx], 0) / moveColumnIndices.length
          : row[j];
        row[j] = p * row[j] + (1 - p) * fallback;
      });
    });
  }

  return { selfActions: selfLabels, oppActions: oppLabels, matrix, isForceSwitchContext: forceSwitchContext };
}
