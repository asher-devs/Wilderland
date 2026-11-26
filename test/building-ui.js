// Real-browser check: climbing ladders, doors blocking/passing, back-wall rendering. node test/building-ui.js [port]
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer-core'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.argv[2] || 3000; let fail = 0; const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘ FAIL:', m); if (!c) fail++; };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await page.setViewport({ width: 1100, height: 650 }); await page.goto('http://localhost:' + PORT); await sleep(400);
  await page.evaluate(() => { UI.go('worlds'); document.getElementById('cw-size').value = 'medium'; document.getElementById('cw-seed').value = '31'; document.getElementById('btn-create').click(); });
  await page.waitForFunction(() => document.body.classList.contains('playing')); await sleep(800);
  await page.evaluate(() => { __G.S.ws.send = () => {}; __G.S.ws.onmessage = null; });
  const gx = await page.evaluate(() => {
    const T = DEFS.T, w = __G.world(), S = __G.S, W = w.W, gx = Math.floor(S.me.x) + 6, gy = w.surf[gx - 6] + 0; window.__gy = gy; window.__gx = gx;
    const set = (x, y, v) => { w.tiles[y * W + x] = v; };
    for (let y = gy - 16; y < gy; y++) for (let x = gx - 10; x < gx + 18; x++) set(x, y, 0);
    for (let x = gx - 10; x < gx + 18; x++) { set(x, gy, T.GRASS); for (let y = gy + 1; y < gy + 5; y++) set(x, y, T.DIRT); }
    // tower with a ledge: stone block 6 high at gx+8..gx+10, ladder on its left face
    for (let y = gy - 6; y < gy; y++) for (let x = gx + 8; x < gx + 11; x++) set(x, y, T.STONE);
    for (let y = gy - 6; y < gy; y++) set(gx + 7, y, T.LADDER);
    // house: walls of planks from gx-6..gx+2, roof, back walls inside, closed door at gx+2
    for (let x = gx - 6; x <= gx + 2; x++) { set(x, gy - 5, T.PLANKS); } for (let y = gy - 4; y < gy; y++) { set(gx - 6, y, T.PLANKS); set(gx + 2, y, T.PLANKS); }
    for (let y = gy - 4; y < gy; y++) for (let x = gx - 5; x < gx + 2; x++) set(x, y, (x + y) % 5 === 0 ? T.WALL_BRICK : x < gx - 2 ? T.WALL_PLANKS : T.WALL_STONE);
    set(gx + 2, gy - 1, T.DOOR); set(gx + 2, gy - 2, T.DOOR_T); set(gx - 2, gy - 3, T.TORCH); set(gx - 4, gy - 1, T.BED);
    for (let x = gx - 10; x < gx + 18; x++) { let y = 0; while (y < w.H && !DEFS.OPAQUE[w.tiles[y * W + x]]) y++; w.top[x] = y; }
    return gx;
  });
  // closed door blocks the player walking in from the right
  await page.evaluate(() => { const m = __G.S.me; m.x = __gx + 4.5; m.y = __gy - m.h; m.vx = 0; m.vy = 0; __G.S.cam.x = __gx; __G.S.cam.y = __gy - 3; });
  await page.keyboard.down('a'); await sleep(1600); await page.keyboard.up('a');
  let x = await page.evaluate(() => __G.S.me.x - __gx); ok(x > 2.6, 'closed door blocks you (x=' + x.toFixed(2) + ')');
  await page.screenshot({ path: '/tmp/house-closed.png' });
  // open it, walk in
  await page.evaluate(() => { const w = __G.world(), W = w.W, T = DEFS.T; w.tiles[(__gy - 1) * W + __gx + 2] = T.DOOR_BO; w.tiles[(__gy - 2) * W + __gx + 2] = T.DOOR_TO; });
  await page.keyboard.down('a'); await sleep(1500); await page.keyboard.up('a');
  x = await page.evaluate(() => __G.S.me.x - __gx); ok(x < 1.5, 'open door lets you in (x=' + x.toFixed(2) + ')');
  await sleep(300); await page.screenshot({ path: '/tmp/house-open.png' });
  // ladder: walk to it and climb to the ledge
  await page.evaluate(() => { const m = __G.S.me; m.x = __gx + 7.5; m.y = __gy - m.h; m.vx = 0; m.vy = 0; });
  await page.keyboard.down('w'); await sleep(900); await page.keyboard.up('w');
  const y1 = await page.evaluate(() => __gy - (__G.S.me.y + __G.S.me.h)); ok(y1 > 2.5, 'climbing the ladder lifts you ' + y1.toFixed(1) + ' tiles');
  // cling: release, should hold position
  const yA = await page.evaluate(() => __G.S.me.y); await sleep(700); const yB = await page.evaluate(() => __G.S.me.y); ok(Math.abs(yA - yB) < 0.15, 'you cling to the ladder when not pressing anything');
  await page.screenshot({ path: '/tmp/ladder.png' });
  // climb to the top and step off onto the ledge
  await page.keyboard.down('w'); await sleep(1500); await page.keyboard.up('w'); await page.keyboard.down('d'); await sleep(350); await page.keyboard.up('d'); await sleep(400);
  const top = await page.evaluate(() => ({ h: __gy - (__G.S.me.y + __G.S.me.h), dx: __G.S.me.x - __gx })); ok(top.h > 5.6 && top.dx > 7.9 && top.dx < 11, 'can climb to the top and step onto the ledge (h=' + top.h.toFixed(1) + ' dx=' + top.dx.toFixed(1) + ')');
  await page.evaluate(() => { const m = __G.S.me; m.x = __gx + 7.5; m.y = __gy - 3 - m.h; m.vy = 0; });
  await page.keyboard.down('s'); await sleep(2300); await page.keyboard.up('s');
  const y2 = await page.evaluate(() => __gy - (__G.S.me.y + __G.S.me.h)); ok(y2 < 0.6, 'S climbs back down to the ground (' + y2.toFixed(2) + ')');
  // without a ladder you cannot climb the same height
  await page.evaluate(() => { const w = __G.world(), W = w.W; for (let y = __gy - 6; y < __gy; y++) w.tiles[y * W + __gx + 7] = 0; const m = __G.S.me; m.x = __gx + 7.5; m.y = __gy - m.h; m.vy = 0; });
  await page.keyboard.down('w'); await sleep(1200); await page.keyboard.up('w'); await sleep(900);
  const y3 = await page.evaluate(() => __gy - (__G.S.me.y + __G.S.me.h)); ok(y3 < 2, 'no ladder, no climbing (' + y3.toFixed(2) + ')');
  ok(errs.length === 0, 'no JS errors ' + errs.join('|')); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(1); });
