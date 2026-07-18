/**
 * makeRequest('move') 後の activeRequest から合法手を列挙する。
 *
 * 行列の肥大化を防ぐため、技×{通常/メガ}の2値に抑える（1技につき最大2バリエーション）。
 * 加えて場に出せる控えへの交代を列挙する。
 *
 * 注意: テラスタルは現在の対戦環境（レギュレーション）では使用されないため、
 * @pkmn/sim が canTerastallize を返しても意図的に選択肢へ含めない（ユーザー確認済み）。
 */
import type { Battle } from '@pkmn/sim';
import type { GtAction } from './types';

interface MoveRequestSlot {
  moves: { id: string; disabled?: boolean }[];
  canMegaEvo?: boolean;
  canTerastallize?: string | boolean;
  trapped?: boolean;
}
interface SwitchSlotData {
  active?: boolean;
  condition?: string;
}
interface MoveRequest {
  active?: MoveRequestSlot[];
  forceSwitch?: boolean[];
  side: { pokemon: SwitchSlotData[] };
}

/** request側データから、場に出せる控え(生存・非active)のインデックスを列挙する。 */
function switchableIndices(req: MoveRequest): number[] {
  const out: number[] = [];
  req.side.pokemon.forEach((p, i) => {
    if (!p.active && p.condition !== '0 fnt') out.push(i);
  });
  return out;
}

export type SideId = 'p1' | 'p2';

/** そのサイドが今「交代を強制されている」（瀕死後の送り出し）か。 */
export function isForceSwitch(battle: Battle, sideId: SideId): boolean {
  const req = battle[sideId].activeRequest as MoveRequest | null;
  return Boolean(req?.forceSwitch?.[0]);
}

/**
 * @param choiceLockedMoveId 前ターンから引き継いだこだわり系の縛り技ID（sim小文字ID表記、
 *   例:"earthquake"）。@pkmn/sim へのvolatile合成注入では request.active[0].moves[].disabled に
 *   伝播しない（T-Spikeで実測確認済み）ため、ここで明示的にフィルタして強制する。
 */
export function enumerateLegalActions(battle: Battle, sideId: SideId, choiceLockedMoveId?: string): GtAction[] {
  const side = battle[sideId];
  const req = side.activeRequest as MoveRequest | null;
  if (!req) return [];

  const actions: GtAction[] = [];

  // 瀕死後の送り出し要求時は交代のみ
  if (req.forceSwitch?.[0]) {
    for (const i of switchableIndices(req)) actions.push({ kind: 'switch', toIndex: i });
    return actions;
  }

  const slot = req.active?.[0];
  if (slot) {
    for (const m of slot.moves) {
      if (m.disabled) continue;
      if (choiceLockedMoveId && m.id !== choiceLockedMoveId) continue;
      actions.push({ kind: 'move', moveId: m.id });
      if (slot.canMegaEvo) actions.push({ kind: 'move', moveId: m.id, mega: true });
      // テラスタルはこの対戦環境では使用しないため列挙しない（slot.canTerastallizeは意図的に無視）。
    }
    // トラップ中(こだわり/くろいまなざし等)でなければ交代も列挙
    if (!slot.trapped) {
      for (const i of switchableIndices(req)) actions.push({ kind: 'switch', toIndex: i });
    }
  }

  return actions;
}

/** GtAction を @pkmn/sim の choose コマンド文字列に変換する。 */
export function actionToChoice(action: GtAction): string {
  if (action.kind === 'switch') return `switch ${action.toIndex + 1}`;
  let cmd = `move ${action.moveId}`;
  if (action.mega) cmd += ' mega';
  if (action.terastallize) cmd += ' terastallize';
  return cmd;
}
