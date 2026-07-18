import { getChampionsSpecies } from '../lib/calc/dex.ts';
import { getStats } from '../lib/calc/damage.ts';

const megas = getChampionsSpecies().filter((s) => s.isMega);
let ok = 0;
let fail: string[] = [];
for (const m of megas) {
  try {
    const stats = getStats({ species: m.name, nature: 'Serious', evs: {} });
    if (stats.hp > 0) ok++;
    else fail.push(m.name + ' (hp=0)');
  } catch (e) {
    fail.push(m.name + ' ERROR: ' + String(e).slice(0, 60));
  }
}
console.log(`計算成功: ${ok}/${megas.length}`);
if (fail.length) console.log('失敗:', fail);
