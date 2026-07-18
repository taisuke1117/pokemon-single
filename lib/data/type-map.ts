import type { PokeType } from '../types';

/** @pkmn/dex の英語タイプ名 -> 表示用の日本語タイプ名。 */
export const EN_TO_JA_TYPE: Record<string, PokeType> = {
  Normal: 'ノーマル',
  Fire: 'ほのお',
  Water: 'みず',
  Electric: 'でんき',
  Grass: 'くさ',
  Ice: 'こおり',
  Fighting: 'かくとう',
  Poison: 'どく',
  Ground: 'じめん',
  Flying: 'ひこう',
  Psychic: 'エスパー',
  Bug: 'むし',
  Rock: 'いわ',
  Ghost: 'ゴースト',
  Dragon: 'ドラゴン',
  Dark: 'あく',
  Steel: 'はがね',
  Fairy: 'フェアリー',
};

export function toJaTypes(enTypes: readonly string[]): PokeType[] {
  return enTypes.map((t) => EN_TO_JA_TYPE[t]).filter((t): t is PokeType => Boolean(t));
}
