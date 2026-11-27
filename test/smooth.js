// Two real browsers: does the remote player move smoothly? node test/smooth.js [port]
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer-core'); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.argv[2] || 3000; let fail = 0; const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘ FAIL:', m); if (!c) fail++; };
(async () => {
  const launch = () => puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const b1 = await launch(), b2 = await launch(), b = { close: async () => { await b1.close(); await b2.close(); } };
  const A = await b1.newPage(), B = await b2.newPage(); const errs = []; for (const p of [A, B]) p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  for (const p of [A, B]) { await p.setViewport({ width: 800, height: 500 }); await p.goto('http://localhost:' + PORT); }
  await sleep(400);
  await A.bringToFront(); await A.evaluate(() => { UI.go('worlds'); document.getElementById('cw-size').value = 'small'; document.getElementById('cw-seed').value = '12'; document.getElementById('btn-create').click(); });
  await A.waitForFunction(() => document.body.classList.contains('playing')); await sleep(600); const code = await A.evaluate(() => __G.S.code);
  await B.bringToFront(); await B.evaluate((c) => { UI.go('worlds'); document.getElementById('join-code').value = c; document.getElementById('btn-join').click(); }, code);
  await B.waitForFunction(() => document.body.classList.contains('playing')); await sleep(1200);
  // B records the rendered x of A every animation frame while A runs
  await B.evaluate(() => { window.__rec = []; const f = () => { const ps = [...__G.S.players.values()]; if (ps[0]) window.__rec.push([performance.now(), ps[0].x]); window.__raf = requestAnimationFrame(f); }; f(); });
  await A.keyboard.down('d'); await sleep(2500); await A.keyboard.up('d'); await sleep(400);
  const rec = await B.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__rec; });
  const moving = []; for (let i = 1; i < rec.length; i++) { const dx = rec[i][1] - rec[i - 1][1], dt = rec[i][0] - rec[i - 1][0]; if (dt > 5 && dt < 60) moving.push(dx / dt * 1000); }
  const run = moving.filter((v) => v > 1.5); const mean = run.reduce((a, c) => a + c, 0) / (run.length || 1), sd = Math.sqrt(run.reduce((a, c) => a + (c - mean) ** 2, 0) / (run.length || 1));
  console.log(`remote speed samples: ${run.length}, mean ${mean.toFixed(2)} tiles/s, sd ${sd.toFixed(2)}`);
  ok(run.length > 40, 'remote player moved visibly'); ok(sd / mean < 0.45, 'remote motion is even, no stutter (cv=' + (sd / mean).toFixed(2) + ')');
  const net = await B.evaluate(() => ({ ping: __G.S.ping, fps: Math.round(__G.S.fps) })); ok(net.ping != null && net.ping < 500, 'ping measured: ' + net.ping + ' ms');
  ok(errs.length === 0, 'no JS errors ' + errs.join('|')); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); process.exit(1); });
