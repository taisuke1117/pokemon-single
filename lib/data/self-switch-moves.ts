/**
 * とんぼがえり/ボルトチェンジ等、命中後に必ず控えへ交代する技(sim内部でselfSwitch:trueを持つ技)。
 * @pkmn/sim/data/moves.ts から抽出（scripts/spike-check-whirlwind.ts等での実測確認と同じ方法）。
 * クライアントバンドルを肥大化させないよう @pkmn/sim を丸ごとimportせず、IDのみを列挙する。
 */
export const SELF_SWITCH_MOVE_IDS = new Set([
  'batonpass',
  'chillyreception',
  'flipturn',
  'partingshot',
  'revivalblessing',
  'teleport',
  'uturn',
  'voltswitch',
]);

function toID(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function isSelfSwitchMove(moveId: string): boolean {
  return SELF_SWITCH_MOVE_IDS.has(toID(moveId));
}
