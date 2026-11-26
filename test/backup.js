// End-to-end backup test: play, back up on the phone, wipe the server, restore automatically.
const puppeteer = require('/opt/npm-tools/node_modules/puppeteer-core'); const { spawn } = require('child_process'); const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fail = 0; const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘ FAIL:', m); if (!c) fail++; };
const PORT = 3111, DIR = '/tmp/wl-bk-test';
let srv; const start = () => { srv = spawn('node', ['server/index.js'], { env: { ...process.env, PORT, DATA_DIR: DIR }, stdio: 'ignore' }); return sleep(1500); };
const stop = async () => { srv.kill('SIGTERM'); await sleep(800); };
(async () => {
  fs.rmSync(DIR, { recursive: true, force: true }); await start();
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await page.setViewport({ width: 900, height: 600 }); await page.goto('http://localhost:' + PORT); await sleep(400);
  await page.evaluate(() => { UI.go('worlds'); document.getElementById('cw-size').value = 'small'; document.getElementById('cw-seed').value = '4242'; document.getElementById('btn-create').click(); });
  await page.waitForFunction(() => document.body.classList.contains('playing'), { timeout: 30000 }); await sleep(800);
  const code = await page.evaluate(() => __G.S.code);
  // dig out a recognisable mark: place a block in the sky via server message
  const mark = await page.evaluate(async () => { const m = __G.S.me, x = Math.floor(m.x) + 3, y = Math.floor(m.y) - 6; __G.send({ t: 'dbg' }); return { x, y }; });
  await page.evaluate(() => __G.Backup.pull(__G.S.code)); await sleep(300);
  const bk = await page.evaluate(() => __G.Backup.get(__G.S.code));
  ok(bk && bk.code === code && bk.tiles.length > 1000, 'backup stored on the device (' + (bk ? Math.round(bk.tiles.length / 1024) + ' KB' : 'none') + ')');
  await page.evaluate(() => __G.leave(true)); await sleep(500);
  await stop(); fs.rmSync(DIR, { recursive: true, force: true }); await start();   // simulate a deploy wipe
  const gone = await page.evaluate(async (c) => (await fetch('/api/world/' + c)).status, code); ok(gone === 404, 'server forgot the world after wipe');
  await page.evaluate((c) => { UI.go('worlds'); }, code); await sleep(300);
  await page.evaluate((c) => { document.getElementById('join-code').value = c; document.getElementById('btn-join').click(); }, code);
  await page.waitForFunction(() => document.body.classList.contains('playing'), { timeout: 30000 }).catch(() => {});
  const back = await page.evaluate(() => document.body.classList.contains('playing') && __G.S.code);
  ok(back === code, 'joining the lost room code restored it automatically');
  ok(await page.evaluate(async (c) => (await fetch('/api/world/' + c)).status, code) === 200, 'server has the world again');
  const same = await page.evaluate((orig) => { const w = __G.world(); return w.W * w.H; }, 0); ok(same > 0, 'world loads');
  // deploy while playing: the client reconnects and restores by itself
  await page.evaluate(() => __G.Backup.pull(__G.S.code)); await stop(); fs.rmSync(DIR, { recursive: true, force: true }); await start();
  await page.waitForFunction(() => document.body.classList.contains('playing') && __G.S.ws && __G.S.ws.readyState === 1, { timeout: 40000 }).catch(() => {});
  await sleep(500); ok(await page.evaluate(async (c) => (await fetch('/api/world/' + c)).status, code) === 200 && await page.evaluate(() => !!__G.S.ws), 'mid-game wipe: auto reconnect + restore');
  // wrong player cannot export / import
  const forb = await page.evaluate(async (c) => (await fetch('/api/export/' + c + '?pid=someoneelse12345')).status, code); ok(forb === 403, 'strangers cannot export');
  ok(errs.length === 0, 'no JS errors ' + errs.join('|'));
  await b.close(); await stop(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH', e); try { srv.kill(); } catch (x) { /* */ } process.exit(1); });
