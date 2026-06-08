import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const URL = 'http://localhost:5174/';
const OUT = 'verify-output';
const consoleErrors = [];
const consoleWarnings = [];
const allConsole = [];
const pageErrors = [];

const log = (m) => { console.log(m); allConsole.push(m); };

async function shoot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  log(`📸 ${path}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 420, height: 860 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    const t = msg.type();
    const text = `[${t}] ${msg.text()}`;
    if (t === 'error') consoleErrors.push(text);
    else if (t === 'warning') consoleWarnings.push(text);
    log(text);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err));
    log(`[pageerror] ${err}`);
  });

  log('→ load');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);

  // 1) Start screen
  await shoot(page, '01-start-mobile-420x860');

  // Inspect DOM for fragment counter and buttons
  const startUi = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasFragments: /fragments/i.test(text),
      hasPlay: /\bPLAY\b/.test(text),
      hasTitle: /STELLAR DRIFT/.test(text),
      buttons: [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') || b.innerText.trim()).filter(Boolean),
    };
  });
  log(`start UI: ${JSON.stringify(startUi)}`);

  // 2) Open Ships panel
  log('→ open Ships');
  await page.locator('button[aria-label="Ships"]').click();
  await page.waitForTimeout(450);
  await shoot(page, '02-ships-panel');

  const shipsUi = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      designs: ['Voyager', 'Wedge', 'Orb', 'Comet'].map((n) => ({ name: n, present: text.includes(n) })),
      colors: ['White', 'Coral', 'Mint', 'Lavender', 'Gold'].map((n) => ({ name: n, present: text.includes(n) })),
      hasCost50: text.includes('50'),
      hasCost150: text.includes('150'),
      hasCost300: text.includes('300'),
    };
  });
  log(`ships UI: ${JSON.stringify(shipsUi)}`);

  // Close Ships
  await page.locator('button[aria-label="Close"]').click();
  await page.waitForTimeout(300);

  // 3) Open Settings
  log('→ open Settings');
  await page.locator('button[aria-label="Settings"]').click();
  await page.waitForTimeout(450);
  await shoot(page, '03-settings-panel');
  const settingsUi = await page.evaluate(() => ({
    text: document.body.innerText,
  }));
  log(`settings text fragment: ${settingsUi.text.includes('Sound') && settingsUi.text.includes('Vibration') && settingsUi.text.includes('Color blind')}`);

  // Toggle Sound off (first ToggleRow)
  log('→ toggle Sound');
  const soundBtn = page.locator('button:has-text("Sound")').first();
  await soundBtn.click();
  await page.waitForTimeout(200);
  await shoot(page, '04-settings-muted');
  await page.locator('button[aria-label="Close"]').click();
  await page.waitForTimeout(300);

  // 4) Open Ranks (should be empty initially)
  log('→ open Ranks');
  await page.locator('button[aria-label="Ranks"]').click();
  await page.waitForTimeout(400);
  await shoot(page, '05-leaderboard-empty');
  await page.locator('button[aria-label="Close"]').click();
  await page.waitForTimeout(300);

  // 5) Tap PLAY and capture mid-game
  log('→ tap PLAY');
  await page.locator('button[aria-label="Play"]').click();
  await page.waitForTimeout(800);
  await shoot(page, '06-in-game-early');

  // Capture multiple flap states by triggering Space
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(160);
  }
  await shoot(page, '07-in-game-mid');

  // Pause briefly then try to survive long enough to find a fragment
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
  }
  await shoot(page, '08-in-game-late');

  // Let ship fall to die
  log('→ let it die');
  await page.waitForTimeout(3500);
  await shoot(page, '09-after-death');

  // Check if initials entry is showing
  const initialsVisible = await page.locator('text=NEW HIGH SCORE').isVisible().catch(() => false);
  log(`initials modal visible: ${initialsVisible}`);

  if (initialsVisible) {
    log('→ enter initials');
    const inputs = await page.locator('input[type="text"]').all();
    if (inputs.length >= 3) {
      await inputs[0].fill('I');
      await inputs[1].fill('V');
      await inputs[2].fill('R');
    }
    await shoot(page, '10-initials-entry');
    await page.locator('button:has-text("SAVE")').click();
    await page.waitForTimeout(500);
    await shoot(page, '11-death-after-save');

    // Open leaderboard to verify
    await page.locator('button[aria-label="Open leaderboard"]').click().catch(() => {});
    await page.waitForTimeout(500);
    await shoot(page, '12-leaderboard-with-entry');
    await page.locator('button[aria-label="Close"]').click().catch(() => {});
    await page.waitForTimeout(300);
  } else {
    log('initials modal did not appear (score may have been 0)');
    await shoot(page, '10-death-no-initials');
  }

  // 6) Test responsive — wide viewport
  log('→ resize to 1440x900 (laptop)');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(800);
  await shoot(page, '13-wide-1440x900');

  // 7) Test responsive — iPad portrait
  log('→ resize to 768x1024 (iPad)');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(800);
  await shoot(page, '14-ipad-768x1024');

  log('=== DONE ===');
  log(`console errors: ${consoleErrors.length}`);
  log(`page errors: ${pageErrors.length}`);
  if (consoleErrors.length) log(JSON.stringify(consoleErrors, null, 2));
  if (pageErrors.length) log(JSON.stringify(pageErrors, null, 2));

  writeFileSync(`${OUT}/log.txt`, allConsole.join('\n'));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
