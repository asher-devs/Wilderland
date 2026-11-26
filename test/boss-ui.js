// Visual check of the boss, fists, projectiles and sigil/boss icons. node test/boss-ui.js [port]
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer-core'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.argv[2] || 3000; let fail = 0; const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘ FAIL:', m); if (!c) fail++; };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await page.setViewport({ width: 1100, height: 700 }); await page.goto('http://localhost:' + PORT); await sleep(400);
  await page.evaluate(() => { UI.go('worlds'); document.getElementById('cw-size').value = 'medium'; document.getElementById('cw-seed').value = '9'; document.getElementById('btn-create').click(); });
  await page.waitForFunction(() => document.body.classList.contains('playing')); await sleep(800);
  await page.evaluate(() => { __G.S.ws.send = () => {}; __G.S.ws.onmessage = null; });
  for (const ph of [1, 2, 3]) {
    await page.evaluate((ph) => {
      const D = DEFS, w = __G.world(), T = D.T, S = __G.S, m = S.me, W = w.W, gx = Math.floor(m.x), gy = w.surf[gx];
      for (let y = gy - 22; y < gy; y++) for (let x = gx - 16; x < gx + 22; x++) w.tiles[y * W + x] = 0; for (let x = gx - 16; x < gx + 22; x++) w.tiles[gy * W + x] = T.GRASS;
      S.mobs.clear(); const d = D.MOBS.warden, bx = gx + 9, by = ph === 3 ? gy - 14 : gy - d.h;
      S.mobs.set(500, { id: 500, type: 'warden', x: bx, y: by, tx: bx, ty: by, t: 1.3, w: d.w, h: d.h, px: bx, py: by, f: -1, hp: 700 * (ph === 1 ? 0.9 : ph === 2 ? 0.5 : 0.2), maxhp: 700, hurt: 0 });
      S.boss = { id: 500, ph, sh: ph === 2 ? 1 : 0, st: 0, f: ph === 2 ? [[bx - 2.7, by + 2.7, 0], [bx + 8 - 14, by + 3, 1]].map((q, i) => i ? [gx + 3.5, gy - 2, 1] : q) : [] };
      S.arrows = [[gx + 2, gy - 0.1, -9, 0, 3], [gx + 4, gy - 3, -9, 1, 1], [gx - 2, gy - 8, 0, 4, 2], [gx - 1, gy - 5, 3, 5, 2]];
      m.x = gx + 0.5; m.y = gy - m.h; S.cam.x = gx + 4; S.cam.y = gy - 5; window.__done = 1;
    }, ph);
    await sleep(500); await page.screenshot({ path: `/tmp/boss${ph}.png` });
  }
  const icons = await page.evaluate(() => { const I = DEFS.I, ids = [I.WARDEN_SIGIL, I.WARDEN_CORE, I.WARDEN_BLADE, I.WARDEN_MAIL]; const c = document.createElement('canvas'); c.width = 4 * 64; c.height = 64; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#555'; g.fillRect(0, 0, c.width, 64); ids.forEach((id, i) => g.drawImage(Gfx.icon(id), i * 64, 0, 64, 64)); return c.toDataURL(); });
  require('fs').writeFileSync('/tmp/bossicons.png', Buffer.from(icons.split(',')[1], 'base64'));
  ok(errs.length === 0, 'no JS errors ' + errs.join('|')); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(1); });
