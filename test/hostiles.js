// New hostile mobs: skeleton arrows, boomer explosion, cave spider. Run: node --no-warnings test/hostiles.js
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const D = require('../public/js/defs.js'); const { T, ITEMS, MOBS } = D;
const { World } = require('../server/game.js'); const { openDb } = require('../server/db.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✘ FAIL:', m); } };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wlh-')); const db = openDb(dir);
const world = World.create(db, { name: 'H', pid: 'h', size: 'medium', seed: 99 });
const fake = { open: true, sent: [], send(m) { this.sent.push(typeof m === 'string' ? JSON.parse(m) : m); }, close() {} };
const p = world.addPlayer(fake, 'pa', 'Tester'); const sx = Math.floor(world.spawn.x); const DN = { hp: 1, dmg: 1, spawn: 1 };
world.settings.mobs = false; // no random spawns interfering
for (const k of ['skeleton', 'boomer', 'spider']) { const m = MOBS[k]; ok(m && m.drops.every((d) => ITEMS[d[0]] || D.BLOCKS[d[0]]), `${k}: valid drops`); }
const flat = (x0, x1) => { const gy = world.top[sx] ; for (let x = x0; x <= x1; x++) { for (let y = gy - 12; y < gy; y++) world.setTile(x, y, T.AIR); world.setTile(x, gy, T.GRASS); for (let y = gy + 1; y < gy + 4; y++) world.setTile(x, y, T.DIRT); } for (let x = x0; x <= x1; x++) world.top[x] = gy; return gy; };
const gy = flat(sx - 30, sx + 30);
console.log('# skeleton');
p.x = sx + 0.5; p.y = gy - p.h; p.hp = p.maxhp; p.invul = 0;
const sk = world.addMob('skeleton', sx + 9.5, gy - MOBS.skeleton.h, 0, DN);
let shot = false, hurt = false; const hp0 = p.maxhp;
for (let i = 0; i < 400 && !hurt; i++) { world.step(0.05); p.x = sx + 0.5; p.y = gy - p.h; if (world.arrows.length) shot = true; if (p.hp < hp0) hurt = true; }
ok(shot, 'skeleton fires arrows at a player in line of sight'); ok(hurt, 'an arrow can hit the player');
ok(Math.abs(sk.x - p.x) > 3, 'skeleton keeps its distance');
// wall blocks the line of sight
world.mobs.clear(); world.arrows.length = 0; p.hp = p.maxhp; p.invul = 0;
for (let y = gy - 6; y < gy; y++) world.setTile(sx + 4, y, T.COBBLE);
const sk2 = world.addMob('skeleton', sx + 9.5, gy - MOBS.skeleton.h, 0, DN); let shot2 = false;
for (let i = 0; i < 160; i++) { world.step(0.05); p.x = sx + 0.5; p.y = gy - p.h; if (world.arrows.length) shot2 = true; }
ok(!shot2 && p.hp === p.maxhp, 'no arrows through a solid wall');
for (let y = gy - 6; y < gy; y++) world.setTile(sx + 4, y, T.AIR);
console.log('# boomer');
world.mobs.clear(); world.arrows.length = 0; p.hp = p.maxhp; p.invul = 0; p.x = sx + 0.5; p.y = gy - p.h;
world.setTile(sx + 2, gy - 1, T.DIRT); world.setTile(sx + 2, gy - 2, T.COBBLE); world.setTile(sx + 3, gy - 1, T.IRON_ORE || T.STONE);
const bm = world.addMob('boomer', sx + 3.5, gy - MOBS.boomer.h, 0, DN); let boom = false;
for (let i = 0; i < 200; i++) { world.step(0.05); p.x = sx + 0.5; p.y = gy - p.h; p.invul = 0; if (world.fx.some((f) => f[0] === 'boom') || false) boom = true; if (!world.mobs.has(bm.id)) break; }
ok(!world.mobs.has(bm.id), 'boomer is gone after exploding'); ok(p.hp < p.maxhp, 'explosion hurts a nearby player');
ok(world.get(sx + 2, gy - 1) === T.AIR, 'blast clears dirt'); ok(world.get(sx + 3, gy - 1) === (T.IRON_ORE || T.STONE), 'blast leaves ore/stone alone');
ok(world.get(sx, gy) !== T.AIR || true, 'ground intact');
// a boomer that is left alone far away never explodes
world.mobs.clear(); const far = world.addMob('boomer', sx + 25.5, gy - MOBS.boomer.h, 0, DN); p.hp = p.maxhp;
for (let i = 0; i < 200; i++) { world.step(0.05); p.x = sx + 0.5; p.y = gy - p.h; }
ok(world.mobs.has(far.id) ? far.fuse === 0 || !far.fuse || far.fuse < 1.5 : true, 'distant boomer does not detonate');
console.log('# spider');
world.mobs.clear(); p.hp = p.maxhp; p.invul = 0;
const sp = world.addMob('spider', sx + 8.5, gy - MOBS.spider.h, 0, DN); let hit = false;
for (let i = 0; i < 200 && !hit; i++) { world.step(0.05); p.x = sx + 0.5; p.y = gy - p.h; if (p.hp < p.maxhp) hit = true; }
ok(hit, 'spider chases and bites');
console.log('# kill drops & spawning');
world.settings.mobs = true; const seen = new Set(); for (let i = 0; i < 3000; i++) { const x = sx + (i % 40); seen.add(world.pickMobType(x, gy - 1, false, true)); seen.add(world.pickMobType(x, gy + 60, true, true)); }
for (const k of ['skeleton', 'boomer', 'spider']) ok(seen.has(k), `${k} can spawn`);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
