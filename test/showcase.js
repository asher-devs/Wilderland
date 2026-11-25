// Visual + physics showcase of the v1.2 blocks in a real browser. Usage: node test/showcase.js [port]
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer-core'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.argv[2] || 3000; let fail = 0; const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘ FAIL:', m); if (!c) fail++; };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.setViewport({ width: 1280, height: 720 }); await page.goto('http://localhost:' + PORT); await sleep(400);
  await page.evaluate(() => { UI.go('worlds'); document.getElementById('cw-size').value = 'medium'; document.getElementById('cw-seed').value = '12345'; document.getElementById('btn-create').click(); });
  await page.waitForFunction(() => document.body.classList.contains('playing')); await sleep(800);
  await page.evaluate(() => { __G.S.ws.send = () => {}; });
  // build a showcase wall of every full block + a house, directly in the client's tile array
  const info = await page.evaluate(() => {
    const D = DEFS, w = __G.world(), T = D.T, m = __G.S.me, W = w.W; const x0 = Math.floor(m.x) + 6; const gy = w.surf[Math.floor(m.x)];
    const set = (x, y, v) => { w.tiles[y * W + x] = v; };
    for (let y = gy - 22; y < gy; y++) for (let x = x0 - 2; x < x0 + 60; x++) set(x, y, 0);
    for (let x = x0 - 2; x < x0 + 60; x++) set(x, gy, T.GRASS);
    // gallery: all blocks 36..93 in rows of 15
    let n = 0; for (let id = 36; id <= 94; id++) { const col = n % 15, row = Math.floor(n / 15); set(x0 + col, gy - 8 + row * 1, id); n++; }
    // house
    const hx = x0 + 18; const S = D.SHAPE_OF;
    for (let x = hx; x <= hx + 8; x++) for (let y = gy - 5; y < gy; y++) set(x, y, (x === hx || x === hx + 8) ? T.STONE_BRICK : (y === gy - 5 ? T.BEAM : 0));
    for (let x = hx; x <= hx + 8; x++) set(x, gy - 1, T.PARQUET);
    set(hx + 3, gy - 3, T.FRAMED_GLASS); set(hx + 3, gy - 2, T.FRAMED_GLASS); set(hx + 5, gy - 3, T.STAINED_GLASS); set(hx + 5, gy - 2, T.STAINED_GLASS); set(hx + 4, gy - 2, T.BOOKSHELF); set(hx + 4, gy - 3, T.LANTERN);
    for (let i = 0; i <= 5; i++) { set(hx - 1 + i, gy - 6 - i, S[T.ROOF_TILE + ':stairR']); for (let j = 0; j < i; j++) set(hx - 1 + i, gy - 6 - i + 1 + j, 0); set(hx + 9 - i, gy - 6 - i, S[T.ROOF_TILE + ':stairL']); }
    for (let i = 0; i < 4; i++) set(hx - 5 + i, gy - 1 - i * 0, 0);
    // stairs + slab up the left side of the house
    set(hx - 4, gy - 1, S[T.COBBLE + ':slab']); set(hx - 3, gy - 1, S[T.COBBLE + ':stairR']); set(hx - 3, gy - 2, 0); set(hx - 2, gy - 1, T.COBBLE); set(hx - 2, gy - 2, S[T.COBBLE + ':stairR']);
    set(hx - 1, gy - 1, T.COBBLE); set(hx - 1, gy - 2, T.COBBLE);
    for (let i = 0; i < 4; i++) set(hx + 11 + i, gy - 1, S[T.STONE_BRICK + ':wall']);
    return { x0, gy, hx, gallery: n };
  });
  await page.evaluate((i) => { const m = __G.S.me; m.x = i.x0 + 7.5; m.y = i.gy - 3.5; m.vx = m.vy = 0; __G.S.cam.x = m.x; __G.S.cam.y = i.gy - 6; }, info);
  await sleep(1500); await page.screenshot({ path: '/tmp/v12-gallery.png' });
  await page.evaluate((i) => { const m = __G.S.me; m.x = i.hx + 4.5; m.y = i.gy - 4; m.vx = m.vy = 0; }, info); await sleep(1500);
  await page.screenshot({ path: '/tmp/v12-house.png' });
  // physics: walk right up the cobble steps from the left
  await page.evaluate((i) => { const m = __G.S.me; m.x = i.hx - 7; m.y = i.gy - 2.8; m.vx = m.vy = 0; }, info); await sleep(600);
  const y0 = await page.evaluate(() => __G.S.me.y);
  await page.keyboard.down('d'); await sleep(1500); await page.keyboard.up('d');
  const r = await page.evaluate(() => ({ x: __G.S.me.x, y: __G.S.me.y, g: __G.S.me.onGround }));
  ok(r.y < y0 - 1.1 && r.x > info.hx - 4, `player walks up slab+stairs without jumping (y ${y0.toFixed(2)} -> ${r.y.toFixed(2)}, x=${r.x.toFixed(1)})`);
  // wall posts block movement
  await page.evaluate((i) => { const m = __G.S.me; m.x = i.hx + 10.5; m.y = i.gy - 2.8; m.vx = m.vy = 0; }, info); await sleep(500);
  await page.keyboard.down('d'); await sleep(800); await page.keyboard.up('d');
  const wx = await page.evaluate(() => __G.S.me.x); ok(wx < info.hx + 11.9, `wall block stops the player (x=${wx.toFixed(2)})`);
  // crafting UI
  await page.keyboard.press('e'); await sleep(400);
  const tabs = await page.$$eval('#rtabs button', (e) => e.map((x) => x.textContent)); ok(tabs.length >= 8, 'crafting category tabs: ' + tabs.join(', '));
  const nAll = await page.$$eval('#recipes .slot', (e) => e.length);
  await page.evaluate(() => { [...document.querySelectorAll('#rtabs button')].find((b) => /Stairs/.test(b.textContent)).click(); }); await sleep(200);
  const nShape = await page.$$eval('#recipes .slot', (e) => e.length); ok(nShape > 20 && nShape < nAll, `category filter works (${nAll} -> ${nShape})`);
  await page.screenshot({ path: '/tmp/v12-craft.png' });
  ok(errs.length === 0, 'no JS errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(fail ? 1 : 0);
})();
