/** よく使われる持ち物の候補リスト（英語=calc用ID / 日本語=表示名）。実在確認済み。 */
export interface ItemInfo {
  itemId: string;
  item: string;
}

export const COMMON_ITEMS: ItemInfo[] = [
  { itemId: 'Choice Scarf', item: 'こだわりスカーフ' },
  { itemId: 'Choice Band', item: 'こだわりハチマキ' },
  { itemId: 'Choice Specs', item: 'こだわりメガネ' },
  { itemId: 'Life Orb', item: 'いのちのたま' },
  { itemId: 'Leftovers', item: 'たべのこし' },
  { itemId: 'Rocky Helmet', item: 'ゴツゴツメット' },
  { itemId: 'Focus Sash', item: 'きあいのタスキ' },
  { itemId: 'Assault Vest', item: 'とつげきチョッキ' },
  { itemId: 'Heavy-Duty Boots', item: 'こだわりブーツ' },
  { itemId: 'Sitrus Berry', item: 'オボンのみ' },
  { itemId: 'Weakness Policy', item: 'じゃくてんほけん' },
  { itemId: 'Eviolite', item: 'しんかのきせき' },
  { itemId: 'Black Sludge', item: 'くろいヘドロ' },
  { itemId: 'Safety Goggles', item: 'ぼうじんゴーグル' },
  { itemId: 'Grip Claw', item: 'グリップツメ' },
  { itemId: 'Loaded Dice', item: 'イカサマダイス' },
  { itemId: 'Booster Energy', item: 'ブーストエナジー' },
];

/** メガ進化用の「必須アイテム(メガストーン)」。calc/dex.ts の requiredItem(英語) を日本語化する。 */
export const MEGA_STONE_JA: Record<string, string> = {
  Metagrossite: 'メタグロスナイト',
  Lucarionite: 'ルカリオナイト',
  Blazikenite: 'バシャーモナイト',
};

export function itemJa(itemId: string): string {
  return COMMON_ITEMS.find((i) => i.itemId === itemId)?.item ?? MEGA_STONE_JA[itemId] ?? itemId;
}
