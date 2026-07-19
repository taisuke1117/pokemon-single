/**
 * 多段階先読みPhase 2: 支配戦略除去(dominance.ts)の単体検証。
 * 優越関係が明らかな手作りの小さい行列で検算する。
 */
import { eliminateDominatedCols, eliminateDominatedRows } from '../lib/engine/gt/solve/dominance';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: string) { if (cond) pass++; else fail++; console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label} — ${detail}`); }

console.log('=== 1. 行の狭義優越除去 ===');
{
  // row1([3,4])が全列でrow0([1,2])を上回る → row0は除去される
  const matrix = [
    [1, 2],
    [3, 4],
  ];
  const rows = eliminateDominatedRows(matrix);
  console.log('  rows:', rows);
  check('狭義優越されたrow0が除去され、row1のみ残る', rows.length === 1 && rows[0] === 1, `rows=${JSON.stringify(rows)}`);
}

console.log('\n=== 2. 列の狭義優越除去 ===');
{
  // col0([1,2])が全行でcol1([3,5])より小さい(=相手にとって良い) → col1は除去される
  const matrix = [
    [1, 3],
    [2, 5],
  ];
  const cols = eliminateDominatedCols(matrix);
  console.log('  cols:', cols);
  check('狭義優越されたcol1が除去され、col0のみ残る', cols.length === 1 && cols[0] === 0, `cols=${JSON.stringify(cols)}`);
}

console.log('\n=== 3. 優越関係が無い場合は両方生き残る ===');
{
  const matrix = [
    [1, 5],
    [5, 1],
  ];
  const rows = eliminateDominatedRows(matrix);
  const cols = eliminateDominatedCols(matrix);
  console.log('  rows:', rows, 'cols:', cols);
  check('行は両方生き残る(優越関係無し)', rows.length === 2, `rows=${JSON.stringify(rows)}`);
  check('列は両方生き残る(優越関係無し)', cols.length === 2, `cols=${JSON.stringify(cols)}`);
}

console.log('\n=== 4. 繰り返し除去(iterated elimination)で2段階の優越が連鎖する ===');
{
  // row0は最初row2に優越されないが、row1除去後は...という連鎖ではなく、単純に3行のうち
  // 明確に劣る行が複数ある場合に、1回のループで正しく全部除去されるか確認する。
  const matrix = [
    [1, 1], // 最弱、row2に完全に劣る
    [3, 3], // 中間
    [5, 5], // 最強
  ];
  const rows = eliminateDominatedRows(matrix);
  console.log('  rows:', rows);
  check('最強のrow2のみ残る(row0・row1は連鎖的に除去)', rows.length === 1 && rows[0] === 2, `rows=${JSON.stringify(rows)}`);
}

console.log(`\n===== 支配戦略除去スパイク: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail === 0 ? 0 : 1);
