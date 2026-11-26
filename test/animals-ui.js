// Visual check of animals, fishing line and new item icons in a real browser. Usage: node test/animals-ui.js [port]
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer-core'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.argv[2] || 3000; let fail = 0; const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘ FAIL:', m); if (!c) fail++; };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.stack || e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.setViewport({ width: 1280, height: 720 }); await page.goto('http://localhost:' + PORT); await sleep(400);
  await page.evaluate(() => { UI.go('worlds'); document.getElementById('cw-size').value = 'medium'; document.getElementById('cw-seed').value = '777'; document.getElementById('btn-create').click(); });
  await page.waitForFunction(() => document.body.classList.contains('playing')); await sleep(800);
  await page.evaluate(() => { __G.S.ws.send = () => {}; __G.S.ws.onmessage = null; });
  await page.evaluate(() => {
    const D = DEFS, w = __G.world(), T = D.T, S = __G.S, m = S.me, W = w.W, gx = Math.floor(m.x), gy = w.surf[gx];
    for (let y = gy - 14; y < gy; y++) for (let x = gx - 14; x < gx + 20; x++) w.tiles[y * W + x] = 0;
    for (let x = gx - 14; x < gx + 20; x++) w.tiles[gy * W + x] = T.GRASS;
    for (let y = gy; y < gy + 4; y++) for (let x = gx + 8; x < gx + 18; x++) w.tiles[y * W + x] = T.WATER;
    S.mobs.clear(); const types = ['cow', 'pig', 'sheep', 'chicken', 'deer', 'fox', 'camel', 'penguin', 'skeleton', 'boomer', 'spider', 'zombie'];
    types.forEach((t, i) => { const d = DEFS.MOBS[t]; if (!d) return; const x = gx - 11 + i * 1.5 + (i > 5 ? 0 : 0), y = t === 'bird' ? gy - 4 : gy - d.h; S.mobs.set(100 + i, { id: 100 + i, type: t, x, y, tx: x, ty: y, t: i, w: d.w, h: d.h, px: x, py: y, f: 1, hp: d.hp, maxhp: d.hp }); });
    S.mobs.set(200, { id: 200, type: 'fish', x: gx + 12, y: gy + 1.5, tx: gx + 12, ty: gy + 1.5, t: 0, w: 1, h: .6, px: 0, py: 0, f: 1, hp: 3, maxhp: 3 });
    S.mobs.set(201, { id: 201, type: 'fish', x: gx + 14, y: gy + 2.2, tx: gx + 14, ty: gy + 2.2, t: 0, w: 1, h: .6, px: 0, py: 0, f: -1, hp: 3, maxhp: 3 });
    m.x = gx + 6; m.y = gy - 1.8; S.cam.x = gx + 3; S.cam.y = gy - 1;
    S.lines = []; S.arrows = [[gx + 1, gy - 2.2, 14, 1], [gx - 2, gy - 1.5, 14, 0]]; S.mobs.get(106).fuse = 1.1;
    S.inv[0] = [D.I.FISHING_ROD, 1, 120]; S.sel = 0; window.__gx = gx;
  });
  await sleep(500); await page.screenshot({ path: '/tmp/animals.png' });
  
  // item icons
  const icons = await page.evaluate(() => { const I = DEFS.I, ids = [I.LEATHER, I.WOOL, I.FEATHER, I.RAW_FISH, I.COOKED_FISH, I.GOLDEN_CARP, I.FISHING_ROD, I.LURE, I.LEATHER_CAP, I.LEATHER_TUNIC, DEFS.T.WOOL_BLOCK, DEFS.T.FISH_TANK]; const c = document.createElement('canvas'); c.width = 12 * 64; c.height = 64; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#555'; g.fillRect(0, 0, c.width, 64); ids.forEach((id, i) => { const cv = Gfx.icon(id); g.drawImage(cv, i * 64, 0, 64, 64); }); return c.toDataURL(); });
  require('fs').writeFileSync('/tmp/icons.png', Buffer.from(icons.split(',')[1], 'base64'));
  ok(errs.length === 0, 'no JS errors ' + errs.join('|')); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(1); });
