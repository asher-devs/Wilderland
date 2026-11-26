// Real-browser test: two headless Chrome contexts play together. Usage: node test/browser.js [port]
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer-core');
const PORT = process.argv[2] || 3000, URL = 'http://localhost:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fail = 0;
const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘ FAIL:', m); if (!c) fail++; };
async function mk(browser, name, look, vp) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport(vp || { width: 1280, height: 720 });
  await page.evaluateOnNewDocument((n, l) => { if (!localStorage.getItem('wl_settings')) localStorage.setItem('wl_settings', JSON.stringify({ name: n, look: l })); }, name, look);
  await page.goto(URL); await sleep(500); return { page, errors, ctx };
}
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const A = await mk(browser, 'Alice', { skin: 0, hairStyle: 2, hair: 4, shirt: 0, pants: 1, accent: 0 });
  await A.page.screenshot({ path: '/tmp/s1-menu.png' });
  await A.page.evaluate(() => { UI.go('char'); }); await sleep(300); await A.page.screenshot({ path: '/tmp/s2-char.png' });
  await A.page.evaluate(() => { UI.go('worlds'); document.getElementById('cw-size').value = 'small'; document.getElementById('btn-create').click(); });
  await A.page.waitForFunction(() => document.body.classList.contains('playing'), { timeout: 20000 }); ok(true, 'world created from UI, game started');
  const code = await A.page.$eval('#info-code', (e) => e.textContent); ok(/^[A-Z2-9]{5}$/.test(code), 'room code shown: ' + code);
  const B = await mk(browser, 'Bob', { skin: 4, hairStyle: 5, hair: 7, shirt: 8, pants: 3, accent: 6 });
  await B.page.evaluate((c) => { UI.go('worlds'); document.getElementById('join-code').value = c; document.getElementById('btn-join').click(); }, code);
  await B.page.waitForFunction(() => document.body.classList.contains('playing'), { timeout: 20000 }); ok(true, 'second browser joined by room code');
  await sleep(1500);
  const pl = await A.page.$$eval('#plist .pl span', (e) => e.map((x) => x.textContent)); ok(pl.length === 2, 'player list shows both: ' + pl.join(', '));
  const looks = await A.page.evaluate(() => Game.S.plist.map((p) => JSON.stringify(p.look))); ok(looks.length === 2 && looks[0] !== looks[1], 'each player has a distinct synced appearance');
  // walk
  await A.page.keyboard.down('d'); await sleep(1200); await A.page.keyboard.up('d');
  const ax = await A.page.evaluate(() => Game.S.me.x), seen = await B.page.evaluate(() => { const p = [...Game.S.players.values()][0]; return p && p.x; });
  const sx = await A.page.evaluate(() => Game.S.me.x); ok(Math.abs(seen - ax) < 2 && ax > 0, `walking synced to other browser (A.x=${ax.toFixed(1)}, B sees ${seen && seen.toFixed(1)})`);
  // mining: aim at block below feet
  const res = await A.page.evaluate(async () => { const m = Game.S.me; let ty = Math.floor(m.y + 1.7); const tx = Math.floor(m.x); while (!DEFS.SOLID[Game.get(tx, ty)]) ty++; return { tx, ty, id: Game.get(tx, ty) }; });
  await A.page.keyboard.press('2'); await sleep(1500);
  const t0 = Date.now(); const cam = await A.page.evaluate(() => ({ x: Game.S.cam.x, y: Game.S.cam.y, TS: Game.S.TS, dpr: Game.S.dpr, cw: Game.S.cw, ch: Game.S.ch }));
  const px = ((res.tx + 0.5 - cam.x) * cam.TS + cam.cw / 2) / cam.dpr, py = ((res.ty + 0.5 - cam.y) * cam.TS + cam.ch / 2) / cam.dpr;
  await A.page.mouse.move(px, py); await A.page.mouse.down(); await sleep(250); await A.page.screenshot({ path: '/tmp/s3-mining.png' });
  await A.page.waitForFunction((r) => Game.get(r.tx, r.ty) === 0, { timeout: 8000 }, res).catch(() => {}); await A.page.mouse.up();
  const broke = await A.page.evaluate((r) => Game.get(r.tx, r.ty), res); ok(broke === 0, `mining is timed and works with real mouse (tile ${res.id}, took ${Date.now() - t0}ms)`);
  await sleep(300); ok((await B.page.evaluate((r) => Game.get(r.tx, r.ty), res)) === 0, "block break visible in other player's browser");
  await sleep(1200); ok((await A.page.evaluate(() => Game.S.inv.some((s) => s && s[0] === 2))), 'drop collected into inventory');
  // inventory UI + crafting list
  await A.page.keyboard.press('e'); await sleep(300); await A.page.screenshot({ path: '/tmp/s4-inv.png' });
  ok((await A.page.$$eval('#inv-grid .slot', (e) => e.length)) === 50 && (await A.page.$$eval('#recipes .slot', (e) => e.length)) > 20, 'inventory (50 slots) and recipes render'); await A.page.keyboard.press('e');
  // chat
  await A.page.keyboard.press('t'); await A.page.keyboard.type('hello bob'); await A.page.keyboard.press('Enter'); await sleep(400);
  ok((await B.page.$eval('#chat-log', (e) => e.textContent)).includes('hello bob'), 'chat delivered between browsers');
  // screenshots both views
  await sleep(500); await B.page.screenshot({ path: '/tmp/s5-bobview.png' });
  // night + underground look
  await A.page.evaluate(() => { Game.send({ t: 'host', op: 'time', v: 'night' }); }); await sleep(2500); await A.page.screenshot({ path: '/tmp/s6-night.png' });
  // mobile viewport
  const M = await mk(browser, 'Mobi', null, { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await M.page.evaluate((c) => { UI.go('worlds'); document.getElementById('join-code').value = c; document.getElementById('btn-join').click(); }, code);
  await M.page.waitForFunction(() => document.body.classList.contains('playing'), { timeout: 20000 }); await sleep(1500); await M.page.screenshot({ path: '/tmp/s7-mobile.png' });
  ok(await M.page.evaluate(() => document.body.classList.contains('touch')), 'touch controls enabled on mobile');
  // reconnect
  await B.page.evaluate(() => Game.S.ws.close()); await B.page.waitForSelector('#reconnect.on', { timeout: 5000 }).catch(() => {}); await B.page.waitForFunction(() => !document.getElementById('reconnect').classList.contains('on') && Game.S.ws, { timeout: 15000 }).catch(() => {});
  ok(await B.page.evaluate(() => !!Game.S.ws && Game.S.ws.readyState === 1), 'client auto-reconnects after connection drop');
  for (const [n, c] of [['A', A], ['B', B], ['M', M]]) { const e = c.errors.filter((x) => !/favicon/.test(x)); ok(e.length === 0, `no JS errors in browser ${n}` + (e.length ? ': ' + e.slice(0, 3).join(' | ') : '')); }
  await browser.close(); console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
