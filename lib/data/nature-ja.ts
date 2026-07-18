import type { StatLine } from '../types';

type StatKey = keyof StatLine;

export interface NatureInfo {
  natureId: string;
  nature: string;
  /** 上昇/下降ステータス。neutralなら両方undefined。 */
  up?: StatKey;
  down?: StatKey;
}

/** 全25性格。英語名(calc用) + 日本語表示名 + 補正ステータス。実在確認済み(Bulbapedia)。 */
export const NATURES: NatureInfo[] = [
  { natureId: 'Hardy', nature: 'がんばりや' },
  { natureId: 'Lonely', nature: 'さみしがり', up: 'a', down: 'b' },
  { natureId: 'Brave', nature: 'ゆうかん', up: 'a', down: 's' },
  { natureId: 'Adamant', nature: 'いじっぱり', up: 'a', down: 'c' },
  { natureId: 'Naughty', nature: 'やんちゃ', up: 'a', down: 'd' },
  { natureId: 'Bold', nature: 'ずぶとい', up: 'b', down: 'a' },
  { natureId: 'Docile', nature: 'すなお' },
  { natureId: 'Relaxed', nature: 'のんき', up: 'b', down: 's' },
  { natureId: 'Impish', nature: 'わんぱく', up: 'b', down: 'c' },
  { natureId: 'Lax', nature: 'のうてんき', up: 'b', down: 'd' },
  { natureId: 'Timid', nature: 'おくびょう', up: 's', down: 'a' },
  { natureId: 'Hasty', nature: 'せっかち', up: 's', down: 'b' },
  { natureId: 'Serious', nature: 'まじめ' },
  { natureId: 'Jolly', nature: 'ようき', up: 's', down: 'c' },
  { natureId: 'Naive', nature: 'むじゃき', up: 's', down: 'd' },
  { natureId: 'Modest', nature: 'ひかえめ', up: 'c', down: 'a' },
  { natureId: 'Mild', nature: 'おっとり', up: 'c', down: 'b' },
  { natureId: 'Quiet', nature: 'れいせい', up: 'c', down: 's' },
  { natureId: 'Bashful', nature: 'てれや' },
  { natureId: 'Rash', nature: 'うっかりや', up: 'c', down: 'd' },
  { natureId: 'Calm', nature: 'おだやか', up: 'd', down: 'a' },
  { natureId: 'Gentle', nature: 'おとなしい', up: 'd', down: 'b' },
  { natureId: 'Sassy', nature: 'なまいき', up: 'd', down: 's' },
  { natureId: 'Careful', nature: 'しんちょう', up: 'd', down: 'c' },
  { natureId: 'Quirky', nature: 'きまぐれ' },
];

const STAT_LABEL: Record<StatKey, string> = { h: 'H', a: 'A', b: 'B', c: 'C', d: 'D', s: 'S' };

export function natureLabel(info: NatureInfo): string {
  if (!info.up || !info.down) return `${info.nature}（無補正）`;
  return `${info.nature}（${STAT_LABEL[info.up]}↑${STAT_LABEL[info.down]}↓）`;
}

export function findNature(natureId: string): NatureInfo | undefined {
  return NATURES.find((n) => n.natureId === natureId);
}
