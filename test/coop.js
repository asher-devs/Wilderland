// Fence block + map markers. Run: node --no-warnings test/coop.js
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const D = require('../public/js/defs.js'); const { T, I } = D;
const { World } = require('../server/game.js'); const { openDb } = require('../server/db.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✘ FAIL:', m); } };
const world = World.create(openDb(fs.mkdtempSync(path.join(os.tmpdir(), 'wlc-'))), { name: 'C', pid: 'h', size: 'medium', seed: 9 }); world.settings.mobs = false; world.settings.animals = false;
const mkf = () => ({ open: true, sent: [], send(m) { this.sent.push(typeof m === 'string' ? JSON.parse(m) : m); }, close() {} });
const fa = mkf, A = mkf(), B = mkf(); const a = world.addPlayer(A, 'a', 'Ann'), b = world.addPlayer(B, 'b', 'Bob');
ok(D.BLOCKS[T.FENCE] && D.SOLID[T.FENCE] && D.CLEAR[T.FENCE] && D.PLACEABLE.has(T.FENCE), 'fence is solid, see-through and placeable');
ok(D.RECIPES.some((r) => r.out === T.FENCE), 'fence recipe');
const sx = Math.floor(world.spawn.x), gy = world.top[sx]; a.x = sx + 0.5; a.y = gy - a.h; world.setTile(sx + 2, gy - 1, T.AIR);
a.inv[0] = [T.FENCE, 4, 0]; a.sel = 0; world.handle(a, { t: 'place', x: sx + 2, y: gy - 1 }); ok(world.get(sx + 2, gy - 1) === T.FENCE, 'fence places');
world.handle(a, { t: 'mark', x: 10.5, y: 20.5 }); ok(B.sent.some((m) => m.t === 'mark' && m.n === 'Ann' && m.x === 10.5), 'marker reaches teammates');
const n = B.sent.length; world.handle(a, { t: 'mark', x: 11, y: 20 }); ok(B.sent.length === n, 'marker rate limited');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
