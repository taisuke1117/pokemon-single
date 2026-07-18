/**
 * 【発展要素・最小版では未実装スタブ】
 * 排他的な問い: 「相手の選択肢を縛れているか」。
 * こだわりロック・タスキ/持ち物割れ・特性判明(再生力=自由に引ける、てんねん=積み無効)等。
 *
 * TODO(Phase 4): BattleParticipant.itemConsumed / revealedItemId / revealedAbilityId や
 * こだわりロック状態を配線し、情報アドバンテージを薄く加点する。
 */
import type { ResolvedBoard } from '../types';

export function evalInfoAdvantage(_board: ResolvedBoard): number {
  return 0;
}
