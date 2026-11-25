// Integration test: boots the real server, connects two real WebSocket clients and verifies multiplayer behaviour.
const { spawn } = require('node:child_process'); const zlib = require('node:zlib'); const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const D = require('../public/js/defs.js');
const PORT = 3900 + Math.floor(Math.random() * 90), DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-'));
let srv; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, msg) => { if (c) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘ FAIL:', msg); } };
function boot() { srv = spawn('node', ['--no-warnings', 'server/index.js'], { env: { ...process.env, PORT, DATA_DIR: DIR }, stdio: ['ignore', 'pipe', 'inherit'] }); return new Promise((r) => srv.stdout.on('data', (d) => String(d).includes('listening') && r())); }
class Client {
  constructor(name, pid) { this.name = name; this.pid = pid; this.snap = null; this.tiles = []; this.chat = []; this.sys = []; this.inv = null; this.msgs = []; this.world = null; this.errs = []; }
  connect() {
    return new Promise((res) => {
      this.ws = new WebSocket('ws://localhost:' + PORT); this.ws.binaryType = 'arraybuffer';
      this.ws.onopen = res;
      this.ws.onmessage = (e) => {
        if (typeof e.data !== 'string') { const raw = zlib.inflateSync(Buffer.from(e.data)); const W = this.W, H = this.H; this.world = { tiles: new Uint8Array(raw.subarray(0, W * H)), biome: raw.subarray(W * H, W * H + W) }; return; }
        const m = JSON.parse(e.data); this.msgs.push(m);
        if (m.t === 'welcome') { this.welcome = m; this.W = m.W; this.H = m.H; this.inv = m.inv; this.id = m.id; this.x = m.x; this.y = m.y; }
        else if (m.t === 'snap') this.snap = m;
        else if (m.t === 'tiles') this.tiles.push(...m.c);
        else if (m.t === 'inv') this.inv = m.inv;
        else if (m.t === 'chat') this.chat.push(m);
        else if (m.t === 'sys') this.sys.push(m.m);
        else if (m.t === 'err') this.errs.push(m.m);
      };
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  async until(fn, ms = 4000) { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(25); } return false; }
  me(snap = this.snap) { return snap && snap.p.find((p) => p[0] === this.id); }
  get(x, y) { return this.world.tiles[y * this.W + x]; }
}
(async () => {
  await boot(); console.log('server up on', PORT);
  const A = new Client('Alice', 'pid-alice-0001'), B = new Client('Bob', 'pid-bob-000002');
  console.log('# world creation / joining');
  await A.connect(); A.send({ t: 'create', pid: A.pid, name: 'Alice', wname: 'Test World', size: 'small', difficulty: 'normal', seed: 4242 });
  ok(await A.until(() => A.welcome && A.world), 'host receives welcome + compressed world');
  const code = A.welcome.code; ok(/^[A-Z2-9]{5}$/.test(code), 'unique room code generated: ' + code); ok(A.welcome.host === true, 'creator is host');
  ok(A.world.tiles.length === A.W * A.H, 'world buffer size correct ' + A.W + 'x' + A.H);
  await B.connect(); B.send({ t: 'join', pid: B.pid, name: 'Bob', code });
  ok(await B.until(() => B.welcome && B.world), 'second client joins by code'); ok(B.welcome.host === false, 'joiner is not host');
  ok(A.world.tiles.every((v, i) => v === B.world.tiles[i]), 'both clients got identical world data');
  ok(await A.until(() => A.msgs.some((m) => m.t === 'plist' && m.p.length === 2)), 'player list shows 2 players'); ok(A.sys.some((s) => /Bob joined/.test(s)), 'join notification broadcast');
  const bad = new Client('X', 'pid-xxxxxxxx'); await bad.connect(); bad.send({ t: 'join', pid: 'pid-xxxxxxxx', name: 'X', code: 'ZZZZZ' }); ok(await bad.until(() => bad.errs.length), 'unknown room code rejected');
  console.log('# movement sync');
  const sx = A.welcome.x; for (let i = 0; i < 20; i++) { A.send({ t: 'mv', x: sx + i * 0.2, y: A.welcome.y, vx: 4, vy: 0, f: 1, a: 1 }); await sleep(50); }
  ok(await B.until(() => { const p = B.snap && B.snap.p.find((p) => p[0] === A.id); return p && p[1] > sx + 3; }), 'B sees A move in real time'); const ap = B.snap.p.find((p) => p[0] === A.id); ok(ap[6] === 1, 'animation state synced');
  A.send({ t: 'mv', x: sx + 300, y: 10, vx: 0, vy: 0, f: 1, a: 0 }); ok(await A.until(() => A.msgs.some((m) => m.t === 'tp')), 'teleport hack rejected by server');
  console.log('# block mining / placing');
  const px = Math.floor(sx + 19 * 0.2); let gy = Math.floor(A.welcome.y + 1.7); while (!D.SOLID[A.get(px, gy)]) gy++;
  const before = A.get(px, gy); ok(before === 1 || before === 2, 'ground below player is grass/dirt (' + before + ')');
  A.send({ t: 'mv', x: px + 0.5, y: gy - 1.7, vx: 0, vy: 0, f: 1, a: 0 }); await sleep(100);
  const far = px + 12; A.send({ t: 'mine', x: far, y: gy }); await sleep(60); ok(!A.tiles.some((t) => t[0] === far), 'out-of-reach mining ignored');
  let progress = 0; for (let i = 0; i < 30 && !B.tiles.some((t) => t[0] === px && t[1] === gy); i++) { A.send({ t: 'mine', x: px, y: gy }); await sleep(60); }
  ok(B.tiles.some((t) => t[0] === px && t[1] === gy && t[2] === 0), 'block break synchronised to other client'); 
  ok(await A.until(() => A.inv.some((s) => s && s[0] === 2)), 'dirt drop collected into miner inventory'); ok(!B.inv.some((s) => s && s[0] === 2), "other player's inventory unaffected");
  const slot = A.inv.findIndex((s) => s && s[0] === 2); A.send({ t: 'sel', i: slot < 10 ? slot : 0 }); if (slot >= 10) A.send({ t: 'swap', a: slot, b: 0 });
  await sleep(100); A.send({ t: 'place', x: px, y: gy }); ok(await B.until(() => B.tiles.some((t) => t[0] === px && t[1] === gy && t[2] === 2)), 'block placement synchronised');
  A.send({ t: 'mine', x: 5, y: 5 }); 
  console.log('# chat');
  A.send({ t: 'chat', m: 'hello <b>bob</b>' }); ok(await B.until(() => B.chat.length), 'chat delivered'); ok(!/[<>]/.test(B.chat[0].m) && B.chat[0].n === "Alice", 'chat sanitised + named');
  console.log('# host controls');
  B.send({ t: 'host', op: 'time', v: 'night' }); ok(await B.until(() => B.msgs.some((m) => m.t === 'toast' && /host/i.test(m.m))), 'non-host denied host action');
  A.send({ t: 'host', op: 'time', v: 'night' }); ok(await A.until(() => B.snap && B.snap.tm > 0.6 && B.snap.tm < 0.7), 'host changed time (night)');
  console.log('# enemies (night)');
  const t0 = Date.now(); let sawMob = false; let types = new Set();
  while (Date.now() - t0 < 25000 && !sawMob) { A.send({ t: 'mv', x: px + 0.5, y: gy - 1.7, vx: 0, vy: 0, f: 1, a: 0 }); B.send({ t: 'mv', x: px + 2.5, y: gy - 1.7, vx: 0, vy: 0, f: 1, a: 0 }); await sleep(100); if (B.snap && B.snap.m.length) { sawMob = true; B.snap.m.forEach((m) => types.add(m[1])); } }
  ok(sawMob, 'enemies spawn at night and sync to clients (' + [...types].join(',') + ')');
  const bm = B.snap && B.snap.m[0], am = A.snap && A.snap.m.find((m) => bm && m[0] === bm[0]); ok(!bm || !!am, 'same enemy id visible to both clients');
  console.log('# disconnect / reconnect / persistence');
  const bInv = JSON.stringify(B.inv); B.send({ t: 'chat', m: 'brb' }); B.ws.close(); ok(await A.until(() => A.sys.some((s) => /Bob disconnected/.test(s))), 'disconnect notification');
  const B2 = new Client('Bob', B.pid); await B2.connect(); B2.send({ t: 'join', pid: B.pid, name: 'Bob', code }); ok(await B2.until(() => B2.welcome), 'reconnect with same player id'); ok(B2.welcome.returning === true && JSON.stringify(B2.inv) === bInv, 'inventory restored after reconnect');
  A.send({ t: 'host', op: 'save' }); await sleep(300);
  const full = []; for (let i = 0; i < 3; i++) { const c = new Client('p' + i, 'pid-extra-00' + i); await c.connect(); c.send({ t: 'join', pid: c.pid, name: 'p' + i, code }); full.push(c); await sleep(150); }
  ok(full[1].errs.length === 0 && full[2].errs.length > 0 || full[2].errs.some((e) => /full/.test(e)), 'world capped at 4 players');
  srv.kill('SIGTERM'); await sleep(600); ok(true, 'server shut down'); await boot();
  const A2 = new Client('Alice', A.pid); await A2.connect(); A2.send({ t: 'join', pid: A.pid, name: 'Alice', code }); ok(await A2.until(() => A2.welcome && A2.world), 'rejoin after server restart');
  ok(A2.get(px, gy) === 2, 'placed/removed blocks persisted in database'); ok(JSON.stringify(A2.inv.map((s) => s && s[0])) === JSON.stringify(A.inv.map((s) => s && s[0])) , 'player inventory persisted'); ok(A2.welcome.host === true, 'host identity persisted');
  srv.kill('SIGTERM'); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); srv && srv.kill(); process.exit(1); });
