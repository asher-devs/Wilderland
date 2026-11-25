// Client-side bed/sleep presentation test (server logic is covered by test/content.js). Usage: node test/bed-ui.js [port]
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer-core'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.argv[2] || 3000; let fail = 0; const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘ FAIL:', m); if (!c) fail++; };
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.setViewport({ width: 1280, height: 720 }); await page.goto('http://localhost:' + PORT); await sleep(400);
  await page.evaluate(() => { UI.go('worlds'); document.getElementById('cw-size').value = 'small'; document.getElementById('btn-create').click(); });
  await page.waitForFunction(() => document.body.classList.contains('playing')); await sleep(800);
  const bed = await page.evaluate(() => { const w = __G.world(), m = __G.S.me, W = w.W, gy = w.surf[Math.floor(m.x)], x = Math.floor(m.x) + 3; w.tiles[(gy - 1) * W + x] = DEFS.T.BED; w.tiles[(gy - 1) * W + x + 1] = DEFS.T.BED_R; window.__sent = []; const o = __G.S.ws.send.bind(__G.S.ws); __G.S.ws.send = (d) => { try { const q = JSON.parse(d); if (q.t !== 'mv') window.__sent.push(q.t); } catch (e) {} return o(d); }; return { x, gy }; });
  await sleep(800); await page.screenshot({ path: '/tmp/bed-1.png' });
  await page.evaluate((b) => { __G.S.ws.onmessage({ data: JSON.stringify({ t: 'sleepOn', x: b.x + 1.7, y: b.gy - 1 + 0.75 - 1.7 }) }); }, bed); await sleep(900);
  ok(await page.evaluate(() => __G.S.sleeping === true && document.getElementById('sleepbar').classList.contains('on')), 'sleeping state shows the "Sleeping" bar');
  await page.screenshot({ path: '/tmp/bed-2.png' });
  const x0 = await page.evaluate(() => __G.S.me.x); await sleep(600); const x1 = await page.evaluate(() => __G.S.me.x); ok(Math.abs(x1 - x0) < 0.01, 'you stay put on the bed while asleep'); await page.keyboard.down('d'); await sleep(300); await page.keyboard.up('d');
  const r = await page.evaluate(() => ({ s: __G.S.sleeping, bar: document.getElementById('sleepbar').classList.contains('on'), sent: window.__sent, x: __G.S.me.x }));
  ok(!r.s && !r.bar && r.sent.includes('wake'), 'pressing a move key wakes you and tells the server');
  ok(errs.length === 0, 'no JS errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(fail ? 1 : 0);
})();
