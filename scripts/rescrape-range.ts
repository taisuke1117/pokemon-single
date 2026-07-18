/**
 * scrape-gamewith.ts の結果に生じた特定順位範囲の汚染データを、
 * その範囲だけピンポイントで再取得して修正する。
 *
 * 実行: npx tsx scripts/rescrape-range.ts <開始順位> <終了順位>
 */
import { chromium, type Page } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const RANKING_URL = 'https://gamewith.jp/pokemon-champions/555373';

const SCRAPE_MODAL_SRC = `(() => {
  const modal = document.querySelector('.wd-pkch-ranking-modal');
  if (!modal) return null;
  const name = modal.querySelector('img[alt]')?.getAttribute('alt') ?? '';
  const baseStats = Array.from(modal.querySelectorAll('.wd-pkch-modal-bs span')).map((s) => Number(s.textContent));
  const abilities = [];
  const abilityContainer = modal.querySelector('.wd-pkch-modal-abilities');
  if (abilityContainer) {
    const cards = Array.from(abilityContainer.querySelectorAll('card[data-name]'));
    for (const c of cards) {
      const cname = c.getAttribute('data-name') ?? '';
      let sib = c.nextSibling;
      let pctText = '';
      while (sib && pctText === '') {
        if (sib.nodeType === Node.TEXT_NODE) pctText = sib.textContent ?? '';
        sib = sib.nextSibling;
      }
      const m = pctText.match(/\\(([\\d.]+)%\\)/);
      abilities.push({ name: cname, pct: m ? Number(m[1]) : 0 });
    }
  }
  const sections = ['_move', '_item', '_nature'];
  const bySection = {};
  for (const sectionClass of sections) {
    const section = modal.querySelector('.wd-pkch-battledata.' + sectionClass);
    const rows = section ? Array.from(section.querySelectorAll('._row')) : [];
    bySection[sectionClass] = rows.map((row) => {
      const card = row.querySelector('card[data-name]');
      const rates = row.querySelector('._rates');
      return { name: card ? card.getAttribute('data-name') : '', pct: Number((rates && rates.textContent ? rates.textContent : '0').replace('%', '')) };
    });
  }
  const evSection = modal.querySelector('.wd-pkch-battledata._ev');
  const evSpreads = [];
  if (evSection) {
    const rows = Array.from(evSection.querySelectorAll('._row'));
    for (const row of rows) {
      const spans = Array.from(row.querySelectorAll('._status span[data-value]'));
      const values = spans.map((s) => Number(s.getAttribute('data-value')) * 4);
      const rates = row.querySelector('._rates');
      evSpreads.push({ values, pct: Number((rates && rates.textContent ? rates.textContent : '0').replace('%', '')) });
    }
  }
  return { name, baseStats, abilities, moves: bySection['_move'], items: bySection['_item'], natures: bySection['_nature'], evSpreads };
})()`;

async function scrapeModal(page: Page) {
  return page.evaluate(SCRAPE_MODAL_SRC);
}

async function main() {
  const startRank = Number(process.argv[2]);
  const endRank = Number(process.argv[3]);
  const filePath = new URL('../lib/data/generated/gamewith-raw.json', import.meta.url);
  const existing = JSON.parse(readFileSync(filePath, 'utf-8'));

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(RANKING_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  for (let rank = startRank; rank <= endRank; rank++) {
    const idx = rank - 1;
    try {
      const nameEl = page.locator('.wd-pkch-battleranking span._name').nth(idx);
      const expectedName = await nameEl.textContent();
      await nameEl.click({ force: true, timeout: 8000 });
      await page.waitForTimeout(1000);
      const data: any = await scrapeModal(page);
      if (data && data.name === expectedName) {
        existing[idx] = { rank, ...data };
        console.log(`OK ${rank}位 ${data.name}`);
      } else {
        console.log(`[不一致] ${rank}位 期待=${expectedName} 実際=${data?.name}`);
      }
      await page.locator('button._pkch-modal-close').first().click({ force: true, timeout: 5000 });
      await page.waitForTimeout(500);
    } catch (e) {
      console.log(`[エラー] ${rank}位: ${String(e).slice(0, 150)}`);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(600);
    }
  }

  writeFileSync(filePath, JSON.stringify(existing, null, 0));
  console.log('保存完了');
  await browser.close();
}

main();
