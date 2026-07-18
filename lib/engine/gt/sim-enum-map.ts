/**
 * ResolvedBoard.field.weather/terrain は @pkmn/sim の内部ID（例: "sandstorm"）。
 * アプリ側の列挙（BattleFieldState.weather等、@smogon/calcのFieldSpecと共通）へ写像する。
 * eval層(calc-helpers.ts)とストア連携層(board-to-state.ts)の両方から使う共有マップ。
 */
// 「ゆき」天候の@pkmn/sim内部IDはGen9で snowscape（'snow'ではない）。hailは旧世代の後方互換用に残る。
export const SIM_WEATHER_TO_APP: Record<string, 'Sand' | 'Sun' | 'Rain' | 'Snow' | undefined> = {
  sandstorm: 'Sand', sunnyday: 'Sun', desolateland: 'Sun', raindance: 'Rain', primordialsea: 'Rain', snowscape: 'Snow', hail: 'Snow',
};
export const SIM_TERRAIN_TO_APP: Record<string, 'Electric' | 'Grassy' | 'Psychic' | 'Misty' | undefined> = {
  electricterrain: 'Electric', grassyterrain: 'Grassy', psychicterrain: 'Psychic', mistyterrain: 'Misty',
};
