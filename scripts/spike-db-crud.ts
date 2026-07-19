/**
 * lib/db/parties.ts のCRUD関数を単体で動作確認する(create→get→update→delete)。
 * DB接続確立後、UI実装前にライブラリ単体の動作を検証する目的(spike文化)。
 */
import { createParty, deleteParty, getParty, listParties, updateParty } from '../lib/db/parties';
import type { PartyMemberSeed } from '../lib/data/hydrate';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

function seed(id: string, species: string): PartyMemberSeed {
  return {
    id,
    name: species,
    item: '',
    ability: '',
    nature: 'まじめ',
    moves: [],
    calc: { species, natureId: 'Serious', evs: {} },
  };
}

const seeds: PartyMemberSeed[] = [
  seed('a', 'Garchomp'), seed('b', 'Ferrothorn'), seed('c', 'Clefable'),
  seed('d', 'Toxapex'), seed('e', 'Corviknight'), seed('f', 'Heatran'),
];

async function main() {
  console.log('=== 1. createParty ===');
  const created = await createParty('テストパーティ', seeds);
  console.log('  created.id:', created.id);
  check('name/seedsが正しく保存される', created.name === 'テストパーティ' && created.seeds.length === 6, `name=${created.name}, len=${created.seeds.length}`);

  console.log('\n=== 2. listParties ===');
  const list = await listParties();
  check('一覧に含まれる', list.some((p) => p.id === created.id), `count=${list.length}`);

  console.log('\n=== 3. getParty ===');
  const got = await getParty(created.id);
  check('個別取得できseedsが復元される', got?.seeds[0]?.calc.species === 'Garchomp', `species=${got?.seeds[0]?.calc.species}`);

  console.log('\n=== 4. updateParty ===');
  const updated = await updateParty(created.id, { name: '更新後の名前' });
  check('name更新が反映される', updated?.name === '更新後の名前', `name=${updated?.name}`);
  check('未指定のseedsは維持される', updated?.seeds.length === 6, `len=${updated?.seeds.length}`);

  console.log('\n=== 5. deleteParty ===');
  const deleted = await deleteParty(created.id);
  check('削除が成功する', deleted === true, `deleted=${deleted}`);
  const afterDelete = await getParty(created.id);
  check('削除後は取得できない', afterDelete === null, `afterDelete=${afterDelete}`);

  console.log(`\n===== DB CRUDスパイク: ${pass} PASS / ${fail} FAIL =====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('実行失敗:', e);
  process.exit(1);
});
