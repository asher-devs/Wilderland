// Visual check: quest book + buff HUD. node test/quests-ui.js [port]
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer-core'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.argv[2] || 3000; let fail = 0; const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘ FAIL:', m); if (!c) fail++; };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await page.setViewport({ width: 1000, height: 600 }); await page.goto('http://localhost:' + PORT); await sleep(400);
  await page.evaluate(() => { UI.go('worlds'); document.getElementById('cw-size').value = 'medium'; document.getElementById('cw-seed').value = '5'; document.getElementById('btn-create').click(); });
  await page.waitForFunction(() => document.body.classList.contains('playing')); await sleep(800);
  await page.keyboard.press('j'); await sleep(300);
  ok(await page.evaluate(() => document.getElementById('quests').classList.contains('on') && document.querySelectorAll('.qrow').length === DEFS.QUESTS.length), 'Q opens the quest book with all quests');
  await page.screenshot({ path: '/tmp/quests.png' }); await page.keyboard.press('Escape'); await sleep(200);
  ok(await page.evaluate(() => !document.getElementById('quests').classList.contains('on')), 'Escape closes it');
  await page.evaluate(() => { const I = DEFS.I; __G.S.inv[0] = [I.SWIFT_POTION, 2, 0]; __G.S.sel = 0; __G.S.ws.send({}); });
  await page.evaluate(() => { __G.S.buffs = { swift: Date.now() + 90000, iron: Date.now() + 60000 }; UI.updateBuffs(); });
  await sleep(300); ok(await page.evaluate(() => document.querySelectorAll('#buffs .bf').length === 2), 'buff icons show in HUD');
  await page.screenshot({ path: '/tmp/buffs.png' });
  ok(errs.length === 0, 'no JS errors ' + errs.join('|')); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(1); });
