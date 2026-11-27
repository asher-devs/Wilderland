// Visual check: farm, crops, wolf, calf, hearts, new icons. node test/farming-ui.js [port]
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer-core'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.argv[2] || 3000; let fail = 0; const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘ FAIL:', m); if (!c) fail++; };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await page.setViewport({ width: 1000, height: 600 }); await page.goto('http://localhost:' + PORT); await sleep(400);
  await page.evaluate(() => { UI.go('worlds'); document.getElementById('cw-size').value = 'medium'; document.getElementById('cw-seed').value = '5'; document.getElementById('btn-create').click(); });
  await page.waitForFunction(() => document.body.classList.contains('playing')); await sleep(800);
  await page.evaluate(() => { __G.S.ws.send = () => {}; __G.S.ws.onmessage = null; });
  await page.evaluate(() => {
    const D = DEFS, w = __G.world(), T = D.T, S = __G.S, m = S.me, W = w.W, gx = Math.floor(m.x), gy = w.surf[gx];
    for (let y = gy - 14; y < gy; y++) for (let x = gx - 12; x < gx + 20; x++) w.tiles[y * W + x] = 0;
    for (let x = gx - 12; x < gx + 20; x++) w.tiles[gy * W + x] = T.GRASS;
    const row = [T.FARMLAND, T.FARMLAND, T.FARMLAND, T.FARMLAND, T.FARMLAND, T.FARMLAND, T.FARMLAND];
    row.forEach((t, i) => { w.tiles[gy * W + gx + 2 + i] = t; });
    const crops = [T.WHEAT1, T.WHEAT2, T.WHEAT3, T.CARROT1, T.CARROT2, T.CARROT3, T.WHEAT3];
    crops.forEach((t, i) => { w.tiles[(gy - 1) * W + gx + 2 + i] = t; }); w.tiles[gy * W + gx + 9] = T.WATER; w.tiles[(gy + 1) * W + gx + 9] = T.WATER;
    S.mobs.clear(); const add = (id, t, x, fl, mv) => { const d = D.MOBS[t], k = fl & 1 ? 0.55 : 1, h = d.h * k, y = gy - h; S.mobs.set(id, { id, type: t, x, y, tx: x, ty: y, t: id, w: d.w * k, h, px: x, py: y, f: 1, hp: d.hp, maxhp: d.hp, fl }); };
    add(300, 'husky', gx - 3, 2, 0); add(301, 'husky', gx - 6, 6, 0); add(302, 'husky', gx - 9, 0, 0); add(303, 'cow', gx + 12, 8, 0); add(304, 'cow', gx + 14, 9, 0); add(305, 'pig', gx + 16, 1 | 8, 0);
    m.x = gx + 0.5; m.y = gy - m.h; S.cam.x = gx + 4; S.cam.y = gy - 3; S.inv[0] = [D.I.HOE, 1, 100]; S.sel = 0;
  });
  await sleep(600); await page.screenshot({ path: '/tmp/farm.png' });
  const icons = await page.evaluate(() => { const I = DEFS.I, ids = [I.HOE, I.WHEAT_SEEDS, I.WHEAT, I.BREAD, I.CARROT]; const c = document.createElement('canvas'); c.width = 5 * 64; c.height = 64; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#555'; g.fillRect(0, 0, c.width, 64); ids.forEach((id, i) => g.drawImage(Gfx.icon(id), i * 64, 0, 64, 64)); return c.toDataURL(); });
  require('fs').writeFileSync('/tmp/farmicons.png', Buffer.from(icons.split(',')[1], 'base64'));
  ok(errs.length === 0, 'no JS errors ' + errs.join('|')); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(1); });
