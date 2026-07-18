/**
 * gamewith.jp の「ポケモンチャンピオンズ使用率ランキング」ページから、
 * 技・持ち物・特性・性格・努力値の使用率データを取得する。
 *
 * gamewith.jp の robots.txt には AI/Claude 系クローラーへの明示的な拒否記述が
 * 無く（Sitemapのみ）、ポリシー上の問題は無いと判断して取得している
 * （pokechamdb.com / champs.pokedb.tokyo は robots.txt で ClaudeBot を
 * 明示的に拒否しているため対象外にしている）。
 *
 * 実行: npx tsx scripts/scrape-gamewith.ts
 */
import { chromium, type Page } from 'playwright';
import { writeFileSync } from 'node:fs';

const RANKING_URL = 'https://gamewith.jp/pokemon-champions/555373';

export interface ScrapedSpecies {
  rank: number;
  name: string;
  baseStats: number[];
  abilities: { name: string; pct: number }[];
  moves: { name: string; pct: number }[];
  items: { name: string; pct: number }[];
  natures: { name: string; pct: number }[];
  evSpreads: { values: number[]; pct: number }[];
}

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
  return page.evaluate(SCRAPE_MODAL_SRC) as Promise<Omit<ScrapedSpecies, 'rank'> | null>;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(RANKING_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const names = await page.locator('.wd-pkch-battleranking span._name').evaluateAll((els) =>
    els.map((e) => e.textContent ?? ''),
  );
  console.log(`対象種族数: ${names.length}`);

  const results: ScrapedSpecies[] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    try {
      const nameEl = page.locator('.wd-pkch-battleranking span._name').nth(i);
      await nameEl.click({ force: true, timeout: 8000 });
      await page.waitForTimeout(700);
      const data = await scrapeModal(page);
      if (data) {
        results.push({ rank: i + 1, ...data });
      } else {
        console.log(`[警告] ${i + 1}位 ${name}: モーダル取得失敗`);
      }
      await page.locator('button._pkch-modal-close').first().click({ force: true, timeout: 5000 });
      await page.waitForTimeout(400);
    } catch (e) {
      console.log(`[エラー] ${i + 1}位 ${name}: ${String(e).slice(0, 150)}`);
      // モーダルが変な状態で残っている可能性があるのでEscで復旧を試みる
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    }
    if ((i + 1) % 20 === 0) {
      console.log(`進捗: ${i + 1}/${names.length}`);
      writeFileSync(
        new URL('../lib/data/generated/gamewith-raw.json', import.meta.url),
        JSON.stringify(results, null, 0),
      );
    }
  }

  writeFileSync(
    new URL('../lib/data/generated/gamewith-raw.json', import.meta.url),
    JSON.stringify(results, null, 0),
  );
  console.log(`完了: ${results.length}/${names.length} 件取得`);

  await browser.close();
}

main();
