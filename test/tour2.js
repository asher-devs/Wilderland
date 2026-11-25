const puppeteer = require('/opt/npm-tools/node_modules/puppeteer-core'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewport({ width: 1280, height: 720 }); await page.goto('http://localhost:3000'); await sleep(400);
  await page.evaluate(() => { UI.go('worlds'); document.getElementById('cw-size').value = 'medium'; document.getElementById('cw-seed').value = '12345'; document.getElementById('btn-create').click(); });
  await page.waitForFunction(() => document.body.classList.contains('playing')); await sleep(500);
  await page.evaluate(() => { __G.S.ws.send = () => {}; });
  const names = ['forest', 'desert', 'snow', 'plains', 'mountain', 'swamp'];
  for (let bi = 0; bi < 6; bi++) {
    const ok = await page.evaluate((bi) => { const w = __G.world(); let xs = []; for (let x = 0; x < w.W; x++) if (w.biome[x] === bi) xs.push(x); if (!xs.length) return false; const x = xs[Math.floor(xs.length * 0.5)]; const m = __G.S.me; m.x = x + 0.5; m.y = w.surf[x] - 3; m.vx = m.vy = 0; __G.S.cam.x = m.x; __G.S.cam.y = m.y; return true; }, bi);
    if (!ok) { console.log('no', names[bi]); continue; }
    await sleep(1800); await page.screenshot({ path: `/tmp/biome-${names[bi]}.png` }); console.log('shot', names[bi]);
  }
  // underground cave with crystals
  await page.evaluate(() => { const w = __G.world(), m = __G.S.me; for (let y = 140; y < 250; y++) for (let x = 100; x < w.W - 100; x++) { if (w.tiles[y * w.W + x] === 10 && w.tiles[y * w.W + x - 1] === 0) { m.x = x - 0.5; m.y = y - 1; m.vx = m.vy = 0; __G.S.cam.x = m.x; __G.S.cam.y = m.y; return; } } }); await sleep(1500); await page.screenshot({ path: '/tmp/cave.png' });
  console.log('errors', errs.join('|') || 'none'); await b.close();
})();
