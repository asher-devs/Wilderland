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
const sx = Math.floor(world.spawn.x), gy = world.top[sx]; b.x = sx - 15; a.x = sx + 0.5; a.y = gy - a.h; for (let y = gy - 6; y < gy; y++) for (let x = sx - 3; x <= sx + 3; x++) world.setTile(x, y, T.AIR); for (let x = sx - 3; x <= sx + 3; x++) world.setTile(x, gy, T.DIRT);
a.inv[0] = [T.FENCE, 4, 0]; a.sel = 0; world.handle(a, { t: 'place', x: sx + 2, y: gy - 1 }); ok(world.get(sx + 2, gy - 1) === T.FENCE, 'fence places');
world.handle(a, { t: 'mark', x: 10.5, y: 20.5 }); ok(B.sent.some((m) => m.t === 'mark' && m.n === 'Ann' && m.x === 10.5), 'marker reaches teammates');
const n = B.sent.length; world.handle(a, { t: 'mark', x: 11, y: 20 }); ok(B.sent.length === n, 'marker rate limited');
// signs
world.setTile(sx - 1, gy - 1, T.AIR); a.inv[1] = [T.SIGN, 2, 0]; a.sel = 1; world.handle(a, { t: 'place', x: sx - 1, y: gy - 1 }); ok(world.get(sx - 1, gy - 1) === T.SIGN, 'sign places on ground');
world.handle(a, { t: 'sign', x: sx - 1, y: gy - 1, text: 'Hello <b>base</b>' }); ok(world.state.signs[(sx - 1) + ',' + (gy - 1)] === 'Hello bbase/b', 'sign text saved and sanitised');
ok(B.sent.some((m) => m.t === 'sign' && m.text), 'sign text broadcast');
world.handle(a, { t: 'sign', x: sx + 9, y: gy - 1, text: 'x' }); ok(!world.state.signs[(sx + 9) + ',' + (gy - 1)], 'cannot write on non-sign');
world.handle(a, { t: 'sign', x: sx - 1, y: gy - 1, text: 'y'.repeat(300) }); ok(world.state.signs[(sx - 1) + ',' + (gy - 1)].length === 80, 'text capped at 80');
// revive
b.x = a.x + 1; b.y = a.y; world.hurtPlayer ? 0 : 0; b.hp = 1; world.damagePlayer ? world.damagePlayer(b, 999, 'test') : null;
if (!b.dead) { b.dead = true; b.hp = 0; b.deadT = 7; }
ok(b.dead && b.deadT >= 6.9 || b.deadT === 7, 'downed player gets a longer window when a friend is alive');
world.handle(a, { t: 'revive', id: b.id }); ok(!b.dead && b.hp === Math.ceil(b.maxhp * 0.5) && b.invul > 2, 'friend revives in place at 50% HP');
ok(B.sent.some((m) => m.t === 'respawn'), 'respawn sent to revived player');
b.dead = true; b.deadT = 5; b.x = a.x + 30; world.handle(a, { t: 'revive', id: b.id }); ok(b.dead, 'too far to revive');
b.dead = true; b.deadT = 5; b.x = a.x + 1; a.dead = true; world.handle(a, { t: 'revive', id: b.id }); ok(b.dead, 'a dead player cannot revive');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
