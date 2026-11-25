// Visual tour: walks through every biome, captures screenshots, previews rain + tree-fall animation.
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer-core'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.setViewport({ width: 1280, height: 720 }); await page.goto('http://localhost:' + (process.argv[2] || 3000)); await sleep(500);
  await page.evaluate(() => { UI.go('worlds'); document.getElementById('cw-size').value = 'medium'; document.getElementById('cw-seed').value = '12345'; document.getElementById('btn-create').click(); });
  await page.waitForFunction(() => document.body.classList.contains('playing')); await sleep(800);
  const names = ['forest', 'desert', 'snow', 'plains', 'mountain', 'swamp']; const seen = {};
  for (const dir of ['d', 'a']) {
    await page.keyboard.down('Shift'); await page.keyboard.down(dir);
    for (let i = 0; i < 160; i++) {
      await sleep(250);
      const st = await page.evaluate(() => { const w = __G.world(), m = __G.S.me; return { b: w.biome[Math.floor(m.x)], x: m.x | 0 }; });
      if (!seen[st.b]) { seen[st.b] = 1; await sleep(500); await page.screenshot({ path: `/tmp/biome-${names[st.b]}.png` }); console.log('captured', names[st.b], 'at x', st.x); }
      if (i > 40 && Object.keys(seen).length >= (dir === 'd' ? 3 : 6)) break;
    }
    await page.keyboard.up(dir); await page.keyboard.up('Shift');
    if (dir === 'd') { /* walk back to spawn side */ }
    await sleep(200);
  }
  await page.evaluate(() => __G.send({ t: 'host', op: 'weather', v: 'rain' })); await sleep(6000); await page.screenshot({ path: '/tmp/weather-rain.png' });
  await page.evaluate(() => { const m = __G.S.me; __G.S.falling.push({ x: m.x + 3, y: Math.floor(m.y) + 2, h: 6, dir: 1, t: 0.55, thud: false, leaves: [[-2, -7, 11], [-1, -7, 11], [0, -7, 11], [1, -7, 11], [-2, -6, 11], [-1, -6, 11], [0, -6, 11], [1, -6, 11], [-1, -8, 11], [0, -8, 11]] }); }); await sleep(120); await page.screenshot({ path: '/tmp/treefall.png' });
  console.log('errors:', errs.length ? errs.join(' | ') : 'none'); await b.close();
})();
