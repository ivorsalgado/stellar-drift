import { chromium } from 'playwright';

const URL = 'http://localhost:5174/';
const OUT = 'verify-output';
const consoleErrors = [];
const pageErrors = [];

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`📸 ${name}.png`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') { consoleErrors.push(msg.text()); console.log(`[err] ${msg.text()}`); }
  });
  page.on('pageerror', (err) => { pageErrors.push(String(err)); console.log(`[pageerror] ${err}`); });

  // Clear localStorage so we start fresh
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  await shoot(page, 'r2-01-start');

  // Tap PLAY
  console.log('→ tap PLAY');
  await page.locator('button[aria-label="Play"]').click();
  await page.waitForTimeout(400);

  // Inject a paced tap loop into the page. Tap every 350ms via space.
  console.log('→ start paced tapping');
  await page.evaluate(() => {
    window.__taps = 0;
    window.__interval = setInterval(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
      window.__taps++;
    }, 360);
  });

  // Watch the game state for several seconds, screenshot a few times
  await page.waitForTimeout(2500);
  await shoot(page, 'r2-02-playing-early');
  await page.waitForTimeout(2500);
  await shoot(page, 'r2-03-playing-mid');
  await page.waitForTimeout(3000);
  await shoot(page, 'r2-04-playing-late');

  // Stop tapping; let it die
  await page.evaluate(() => clearInterval(window.__interval));
  console.log('→ stopped tapping, letting it fall');
  await page.waitForTimeout(2500);
  await shoot(page, 'r2-05-dead');

  // Capture localStorage for evidence of fragments/leaderboard
  const ls = await page.evaluate(() => ({
    fragments: localStorage.getItem('stellardrift_fragments'),
    best: localStorage.getItem('stellardrift_best'),
    leaderboard: localStorage.getItem('stellardrift_leaderboard_v1'),
    ship: localStorage.getItem('stellardrift_ship'),
    color: localStorage.getItem('stellardrift_color'),
  }));
  console.log(`localStorage after run: ${JSON.stringify(ls)}`);

  // Check for initials modal
  const initials = await page.locator('text=NEW HIGH SCORE').isVisible().catch(() => false);
  console.log(`initials modal visible: ${initials}`);

  if (initials) {
    const inputs = await page.locator('input[type="text"]').all();
    if (inputs.length >= 3) {
      await inputs[0].fill('I');
      await inputs[1].fill('V');
      await inputs[2].fill('R');
    }
    await shoot(page, 'r2-06-initials');
    await page.locator('button:has-text("SAVE")').click();
    await page.waitForTimeout(500);
    await shoot(page, 'r2-07-death-saved');
    // Open leaderboard from the death overlay
    await page.locator('button[aria-label="Open leaderboard"]').click().catch(() => {});
    await page.waitForTimeout(600);
    await shoot(page, 'r2-08-leaderboard-entry');
  }

  console.log('=== DONE ===');
  console.log(`console errors: ${consoleErrors.length}`);
  console.log(`page errors: ${pageErrors.length}`);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
