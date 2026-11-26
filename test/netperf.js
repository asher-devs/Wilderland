// Bandwidth culling + interpolation smoothness. Run: node --no-warnings test/netperf.js  (browser part needs a server: PORT=3000)
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const D = require('../public/js/defs.js'); const { T, MOBS } = D;
const { World } = require('../server/game.js'); const { openDb } = require('../server/db.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✘ FAIL:', m); } };
const db = openDb(fs.mkdtempSync(path.join(os.tmpdir(), 'wln-'))); const world = World.create(db, { name: 'N', pid: 'h', size: 'large', seed: 3 });
world.settings.mobs = false; world.settings.animals = false;
const mk = (i) => { const f = { open: true, sent: [], send(m) { this.sent.push(m); }, close() {} }; const p = world.addPlayer(f, 'p' + i, 'P' + i); return { p, f }; };
const A = mk(1), B = mk(2); const W = world.W;
A.p.x = 100; A.p.y = world.surf[100] - 2; B.p.x = W - 100; B.p.y = world.surf[W - 100] - 2;
const types = ['cow', 'pig', 'sheep', 'zombie', 'skeleton', 'deer'];
for (let i = 0; i < 160; i++) { const x = 20 + ((i * 53) % (W - 40)); const t = types[i % types.length]; world.addMob(t, x + 0.5, world.surf[x] - MOBS[t].h - 0.1, 0, { hp: 1, dmg: 1 }); }
for (let i = 0; i < 40; i++) { const x = 20 + ((i * 97) % (W - 40)); world.spawnDrop(D.I.APPLE, 1, x, world.surf[x] - 1); }
world.fx.push(['hit', 100, 50, 0], ['hit', W - 100, 50, 0]);
const all = world.snapshotAll(); const full = JSON.stringify({ ...all, t: 'snap', fx: world.fx });
const sa = JSON.stringify(world.snapshotFor(all, A.p)), sb = JSON.stringify(world.snapshotFor(all, B.p));
console.log(`full snapshot ${full.length} B, player A ${sa.length} B, player B ${sb.length} B`);
ok(sa.length < full.length * 0.4, 'a player gets well under half of the world'); ok(sb.length < full.length * 0.4, 'same for the other side of the map');
const ja = JSON.parse(sa); ok(ja.m.every((o) => Math.abs(o[2] - 100) < 58), 'only nearby mobs are sent'); ok(ja.fx.length === 1 && ja.fx[0][1] === 100, 'only nearby effects are sent');
ok(ja.p.length === 2, 'all players are always visible in the list');
// a nearby mob does appear
world.addMob('cow', 105.5, world.surf[105] - 2, 0, { hp: 1, dmg: 1 }); ok(JSON.parse(JSON.stringify(world.snapshotFor(world.snapshotAll(), A.p))).m.some((o) => o[1] === 'cow' && Math.abs(o[2] - 105.5) < 0.1), 'nearby mob is included');
// full tick keeps working and sends per-player snapshots
A.f.sent.length = 0; B.f.sent.length = 0; world.step(0.05); world.flush();
const snapA = JSON.parse(A.f.sent.filter((s) => s.includes('"t":"snap"')).pop()); ok(snapA && snapA.m.every((o) => Math.abs(o[2] - A.p.x) < 58), 'flush sends culled snapshots');
// ping
A.f.sent.length = 0; world.handle(A.p, { t: 'ping', c: 123 }); ok(A.f.sent.some((s) => s.includes('"pong"') && s.includes('123')), 'server answers ping');
// per-tick cost
const t0 = process.hrtime.bigint(); for (let i = 0; i < 200; i++) { const a = world.snapshotAll(); world.snapshotFor(a, A.p); world.snapshotFor(a, B.p); }
const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 200; console.log(`snapshot build for 2 players: ${ms.toFixed(3)} ms`); ok(ms < 3, 'snapshot cost is small');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
