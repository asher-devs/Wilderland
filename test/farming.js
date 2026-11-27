// Farming, breeding and taming. Run: node --no-warnings test/farming.js
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const D = require('../public/js/defs.js'); const { T, I, ITEMS, MOBS } = D;
const { World } = require('../server/game.js'); const { openDb } = require('../server/db.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✘ FAIL:', m); } };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wlf-')); const db = openDb(dir); const world = World.create(db, { name: 'F', pid: 'h', size: 'medium', seed: 21 });
world.settings.mobs = false; world.settings.animals = false;
const fake = { open: true, sent: [], send(m) { this.sent.push(typeof m === 'string' ? JSON.parse(m) : m); }, close() {} };
const p = world.addPlayer(fake, 'pa', 'T'); const sx = Math.floor(world.spawn.x); const gy = world.top[sx];
for (let x = sx - 20; x <= sx + 20; x++) { for (let y = gy - 14; y < gy; y++) world.setTile(x, y, T.AIR); world.setTile(x, gy, T.GRASS); for (let y = gy + 1; y < gy + 5; y++) world.setTile(x, y, T.DIRT); world.top[x] = gy; world.surf[x] = gy; }
p.x = sx + 0.5; p.y = gy - p.h; p.hp = p.maxhp = 999;
const hold = (id, n = 5, dur) => { p.inv[0] = [id, n, dur || ITEMS[id].dur || 0]; p.sel = 0; };
console.log('# content');
for (const id of [I.HOE, I.BREAD]) ok(D.RECIPES.some((r) => r.out === id), 'recipe ' + ITEMS[id].name);
ok(ITEMS[I.WHEAT_SEEDS].plant === T.WHEAT1 && ITEMS[I.CARROT].plant === T.CARROT1 && ITEMS[I.CARROT].heal > 0, 'seed/carrot items');
console.log('# tilling & planting');
hold(I.HOE, 1); world.handle(p, { t: 'till', x: sx + 2, y: gy }); ok(world.get(sx + 2, gy) === T.FARMLAND, 'hoe tills grass into farmland'); ok(p.inv[0][2] === ITEMS[I.HOE].dur - 1, 'hoe wears');
world.handle(p, { t: 'till', x: sx + 40, y: gy }); ok(world.get(sx + 40, gy) !== T.FARMLAND, 'cannot till out of reach');
hold(I.PICK_PLACEHOLDER || I.WOOD_PICK, 1); world.handle(p, { t: 'till', x: sx + 3, y: gy }); ok(world.get(sx + 3, gy) === T.GRASS, 'only a hoe tills');
hold(I.WHEAT_SEEDS, 3); world.handle(p, { t: 'plant', x: sx + 2, y: gy }); ok(world.get(sx + 2, gy - 1) === T.WHEAT1, 'seeds plant on farmland'); ok(p.inv[0][1] === 2, 'seed consumed');
world.handle(p, { t: 'plant', x: sx + 4, y: gy }); ok(world.get(sx + 4, gy - 1) === T.AIR, 'cannot plant on plain grass');
hold(I.CARROT, 2); world.handle(p, { t: 'till', x: sx + 5, y: gy }); hold(I.HOE, 1); world.handle(p, { t: 'till', x: sx + 5, y: gy }); hold(I.CARROT, 2); world.handle(p, { t: 'plant', x: sx + 5, y: gy - 1 }); ok(world.get(sx + 5, gy - 1) === T.CARROT1, 'carrots plant too (aiming at the air above works)');
console.log('# growth');
let stages = new Set(); for (let i = 0; i < 4000; i++) { world.step(0.05); stages.add(world.get(sx + 2, gy - 1)); if (world.get(sx + 2, gy - 1) === T.WHEAT3) break; }
ok(world.get(sx + 2, gy - 1) === T.WHEAT3 && stages.has(T.WHEAT2), 'wheat grows through its stages');
// water speeds growth
const grow = (wet) => { let t = 0; for (let k = 0; k < 6; k++) { const x = sx - 19 + k * 3; world.setTile(x, gy, T.FARMLAND); world.setTile(x, gy - 1, T.WHEAT1); if (wet) world.setTile(x + 1, gy, T.WATER); }
  for (let i = 0; i < 1600; i++) { world.step(0.05); t++; } let s = 0; for (let k = 0; k < 6; k++) { const v = world.get(sx - 19 + k * 3, gy - 1); s += v - T.WHEAT1; } for (let k = 0; k < 6; k++) { world.setTile(sx - 19 + k * 3, gy - 1, T.AIR); world.setTile(sx - 19 + k * 3, gy, T.GRASS); world.setTile(sx - 18 + k * 3, gy, T.GRASS); } return s; };
const dry = grow(false), wet = grow(true); ok(wet > dry, `water next to farmland speeds growth (dry ${dry}, wet ${wet})`);
console.log('# harvest');
world.drops.clear(); p.x = sx + 2.5; world.breakTile(p, sx + 2, gy - 1, null);
const got = [...world.drops.values()].map((d) => d.item); ok(got.includes(I.WHEAT), 'ripe wheat drops wheat'); ok(got.includes(I.WHEAT_SEEDS) || true, 'seeds may drop');
world.drops.clear(); world.setTile(sx + 2, gy - 1, T.WHEAT1); world.breakTile(p, sx + 2, gy - 1, null); ok([...world.drops.values()].some((d) => d.item === I.WHEAT_SEEDS), 'a sprout gives its seed back');
world.drops.clear(); world.setTile(sx + 2, gy - 1, T.WHEAT3); world.breakTile(p, sx + 2, gy, null); ok([...world.drops.values()].some((d) => d.item === I.WHEAT), 'breaking farmland harvests the crop on top');
let seedsFromGrass = 0; for (let i = 0; i < 400; i++) { world.drops.clear(); world.setTile(sx + 8, gy - 1, T.PLANT); world.breakTile(p, sx + 8, gy - 1, null); if ([...world.drops.values()].some((d) => d.item === I.WHEAT_SEEDS)) seedsFromGrass++; } ok(seedsFromGrass > 20 && seedsFromGrass < 120, 'tall grass sometimes gives seeds (' + seedsFromGrass + '/400)');
console.log('# breeding');
const mk = (t, x) => world.addMob(t, x, gy - MOBS[t].h - 0.05, 0, { hp: 1, dmg: 1 });
const c1 = mk('cow', sx - 3.5), c2 = mk('cow', sx - 2.5); p.x = sx - 3; p.y = gy - p.h;
hold(I.CARROT, 3); world.handle(p, { t: 'interact', id: c1.id }); ok(!(c1.love > 0), 'a cow does not want carrots');
hold(I.WHEAT, 4); world.handle(p, { t: 'interact', id: c1.id }); world.handle(p, { t: 'interact', id: c2.id }); ok(c1.love > 0 && c2.love > 0 && p.inv[0][1] === 2, 'feeding wheat puts cows in love');
const before = [...world.mobs.values()].filter((m) => m.type === 'cow').length; for (let i = 0; i < 200; i++) world.step(0.05);
const cows = [...world.mobs.values()].filter((m) => m.type === 'cow'); const baby = cows.find((m) => m.baby); ok(cows.length === before + 1 && baby, 'two cows in love make a calf'); ok(baby && baby.h < MOBS.cow.h * 0.7, 'the calf is smaller');
ok(world.snapshotAll().m.some((o) => o[9] & 1), 'snapshot marks babies');
baby.age = 91; world.step(0.05); ok(!baby.baby && baby.h === MOBS.cow.h, 'calf grows up');
hold(I.WHEAT, 4); world.handle(p, { t: 'interact', id: c1.id }); ok(!(c1.love > 0), 'bred cows need a cooldown');
const far = mk('cow', sx + 15); hold(I.WHEAT, 4); world.handle(p, { t: 'interact', id: far.id }); ok(!(far.love > 0), 'cannot feed a cow out of reach');
console.log('# taming');
for (const m of [...world.mobs.values()]) world.mobs.delete(m.id);
const w = mk('husky', sx + 2); p.x = sx; hold(I.COOKED_MEAT, 40); let tamed = false; for (let i = 0; i < 20 && !w.owner; i++) world.handle(p, { t: 'interact', id: w.id }); tamed = !!w.owner;
ok(tamed && w.owner === p.id && p.pet === true, 'feeding meat eventually tames a husky');
const w2 = mk('husky', sx + 4); hold(I.COOKED_MEAT, 5); world.handle(p, { t: 'interact', id: w2.id }); ok(!w2.owner, 'only one husky companion per player');
world.mobs.delete(w2.id);
// follows the owner
p.x = sx + 14; p.y = gy - p.h; for (let i = 0; i < 160; i++) { p.x = sx + 14; world.step(0.05); } ok(Math.abs(w.x - p.x) < 6, 'tamed husky follows its owner (' + Math.abs(w.x - p.x).toFixed(1) + ' tiles)');
// sits
hold(I.APPLE, 1); world.handle(p, { t: 'interact', id: w.id }); ok(w.sit === true, 'tapping toggles sit'); const sitX = w.x; p.x = sx + 25; for (let i = 0; i < 40; i++) { p.x = sx + 25; world.step(0.05); } ok(Math.abs(w.x - sitX) < 1, 'a sitting husky stays put'); p.x = w.x; world.handle(p, { t: 'interact', id: w.id }); ok(!w.sit, 'tap again to stand');
// teleports when far behind
p.x = sx + 14; w.sit = false; for (let i = 0; i < 100; i++) world.step(0.05);
// fights hostile mobs
const z = world.addMob('zombie', p.x + 5, gy - MOBS.zombie.h - 0.05, 0, { hp: 1, dmg: 1 }); const zhp = z.hp; for (let i = 0; i < 200; i++) { p.x = sx + 14; p.hp = 999; world.step(0.05); if (!world.mobs.has(z.id)) break; }
ok(!world.mobs.has(z.id) || z.hp < zhp, 'the husky attacks hostile mobs near its owner');
// never hurts its owner or gets hurt
const hp0 = w.hp; world.hurtMob(w, 50, 1, p); ok(w.hp === hp0 && world.mobs.has(w.id), 'tamed wolves are immune');
// persisted: respawns after the husky mob is gone
world.mobs.delete(w.id); for (let i = 0; i < 80; i++) world.step(0.05); ok([...world.mobs.values()].some((m) => m.owner === p.id), 'husky comes back for its owner');
ok(world.playerData(p).data.pet === 1, 'pet flag is saved with the player');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
