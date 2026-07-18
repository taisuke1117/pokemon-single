import { hydratePartyMember, type PartyMemberSeed } from './hydrate';

/**
 * 自軍パーティ（事前登録済み想定）。
 * 各フィールドは @pkmn/dex / @smogon/calc への実在確認を取った上で採用している
 * （scripts/spike-names.ts, spike-moves.ts, spike-items.ts 参照）。
 */
export const PARTY_SEEDS: PartyMemberSeed[] = [
  {
    id: 'gab',
    name: 'ガブリアス',
    item: 'こだわりスカーフ',
    ability: 'さめはだ',
    nature: 'ようき',
    moves: ['じしん', 'げきりん', 'スケイルショット', 'ステルスロック'],
    calc: {
      species: 'Garchomp',
      itemId: 'Choice Scarf',
      abilityId: 'Rough Skin',
      natureId: 'Jolly',
      evs: { a: 252, s: 252, h: 4 },
      moveIds: ['Earthquake', 'Outrage', 'Scale Shot', 'Stealth Rock'],
    },
  },
  {
    id: 'hip',
    name: 'カバルドン',
    item: 'ゴツゴツメット',
    ability: 'すなおこし',
    nature: 'わんぱく',
    moves: ['じしん', 'ステルスロック', 'あくび', 'なげつける'],
    calc: {
      species: 'Hippowdon',
      itemId: 'Rocky Helmet',
      abilityId: 'Sand Stream',
      natureId: 'Impish',
      evs: { h: 252, b: 252, d: 4 },
      moveIds: ['Earthquake', 'Stealth Rock', 'Yawn', 'Fling'],
    },
  },
  {
    id: 'ogr',
    name: 'ハバタクカミ',
    item: 'いのちのたま',
    ability: 'こだいかっせい',
    nature: 'おくびょう',
    moves: ['ムーンフォース', 'シャドーボール', 'マジカルフレイム', 'かなしばり'],
    calc: {
      species: 'Flutter Mane',
      itemId: 'Life Orb',
      abilityId: 'Protosynthesis',
      natureId: 'Timid',
      evs: { c: 252, s: 252, h: 4 },
      moveIds: ['Moonblast', 'Shadow Ball', 'Mystical Fire', 'Disable'],
    },
  },
  {
    id: 'kin',
    name: 'ドドゲザン',
    item: 'こだわりハチマキ',
    ability: 'そうだいしょう',
    nature: 'ようき',
    moves: ['ふいうち', 'アイアンヘッド', 'ととさか', 'とんぼがえり'],
    calc: {
      species: 'Kingambit',
      itemId: 'Choice Band',
      abilityId: 'Supreme Overlord',
      natureId: 'Jolly',
      evs: { a: 252, s: 252, h: 4 },
      moveIds: ['Sucker Punch', 'Iron Head', 'Kowtow Cleave', 'U-turn'],
    },
  },
  {
    id: 'urs',
    name: 'ウーラオス(れんげき)',
    item: 'いのちのたま',
    ability: 'ふかしのこぶし',
    nature: 'ようき',
    moves: ['インファイト', 'とんぼがえり', 'つじぎり', 'アクアジェット'],
    calc: {
      species: 'Urshifu-Rapid-Strike',
      itemId: 'Life Orb',
      abilityId: 'Unseen Fist',
      natureId: 'Jolly',
      evs: { a: 252, s: 252, h: 4 },
      moveIds: ['Close Combat', 'U-turn', 'Surging Strikes', 'Aqua Jet'],
    },
  },
  {
    id: 'ttk',
    name: 'トドロクツキ',
    item: 'いのちのたま',
    ability: 'こだいかっせい',
    nature: 'いじっぱり',
    moves: ['りゅうのまい', 'じしん', 'かみくだく', 'かえんのキバ'],
    calc: {
      species: 'Roaring Moon',
      itemId: 'Life Orb',
      abilityId: 'Protosynthesis',
      natureId: 'Adamant',
      evs: { a: 252, s: 252, h: 4 },
      moveIds: ['Dragon Dance', 'Earthquake', 'Crunch', 'Fire Fang'],
    },
  },
];

export const MOCK_PARTY = PARTY_SEEDS.map(hydratePartyMember);
