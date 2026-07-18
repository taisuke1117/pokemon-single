import { MOCK_PARTY } from '../lib/data/party.ts';
import { ENV_SEASON_M4 } from '../lib/data/env-season-m4.ts';

console.log('--- 自軍パーティ実数値 ---');
for (const p of MOCK_PARTY) {
  console.log(p.name.padEnd(14), p.types.join('/').padEnd(12), JSON.stringify(p.stats));
}

console.log('--- 環境データ types 確認 ---');
for (const e of ENV_SEASON_M4) {
  console.log(e.name.padEnd(14), e.types.join('/'));
}
