// Animals + fishing: in-process server tests. Run: node --no-warnings test/animals.js
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const D = require('../public/js/defs.js'); const { T, I, ITEMS, MOBS } = D;
const { World } = require('../server/game.js'); const { openDb } = require('../server/db.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✘ FAIL:', m); } };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wla-')); const db = openDb(dir);
const world = World.create(db, { name: 'A', pid: 'h', size: 'medium', seed: 777 });
const fake = { open: true, sent: [], send(m) { this.sent.push(typeof m === 'string' ? JSON.parse(m) : m); }, close() {} };
const p = world.addPlayer(fake, 'pa', 'Angler'); const sx = Math.floor(world.spawn.x);
const DIFFN = { hp: 1, dmg: 1, spawn: 1 };
console.log('# animal definitions');
const animals = Object.keys(MOBS).filter((k) => MOBS[k].animal);
ok(animals.length >= 12, `at least 12 animal types (${animals.length})`);
for (const k of animals) { const m = MOBS[k]; ok(m.drops.length > 0 && m.drops.every((d) => ITEMS[d[0]]), `${k}: valid drops`); ok(m.w > 0 && m.h > 0 && m.hp > 0, `${k}: size/hp`); if (!m.neutral) ok(!m.dmg, `${k}: harmless`); }
console.log('# behaviour over 30 simulated seconds');
for (const k of animals.filter((a) => !MOBS[a].swim)) {
  const y = world.top[sx + 10] - 1, def = MOBS[k];
  const mob = world.addMob(k, sx + 10.5, def.fly ? y - 4 : y + 1 - def.h, 0, DIFFN);
  p.x = sx + 10.5; p.y = y - 1; p.hp = p.maxhp; p.invul = 0;
  for (let i = 0; i < 600; i++) { world.step(0.05); p.x = sx + 10.5 + 30; /* keep player near but far from mob */ if (!world.mobs.has(mob.id)) break; }
  const alive = world.mobs.has(mob.id);
  ok(alive ? Number.isFinite(mob.x) && Number.isFinite(mob.y) && mob.y < world.H - 4 && mob.y > 0 : true, `${k}: stays in the world and never goes NaN`);
  ok(p.hp === p.maxhp, `${k}: does not hurt a passer-by`);
  world.mobs.delete(mob.id);
}
p.x = sx + 0.5; p.y = world.top[sx] - 2.7;
console.log('# spawning by biome');
const seen = {}; const origRand = Math.random;
for (let i = 0; i < 4000; i++) { const b = i % 6; const t = world.animalFor(b, i % 5 === 0); (seen[b] = seen[b] || new Set()).add(t); }
for (let b = 0; b < 6; b++) ok(seen[b].size >= 2, `biome ${D.BIOMES[b]} has ${seen[b].size} animal kinds`);
ok(seen[1].has('camel') && seen[2].has('penguin') && seen[3].has('cow') && seen[3].has('sheep') && seen[5].has('turtle') && seen[0].has('deer'), 'signature animals live in their biomes');
// run the real spawner for a while near the surface in every biome
const found = new Set();
for (let b = 0; b < 6; b++) {
  let x = 0; for (let i = 0; i < world.W; i++) if (world.biome[i] === b) { x = i + 40; break; } if (!x) continue;
  world.mobs.clear(); p.x = x + 0.5; p.y = world.top[x] - 2.7;
  for (let i = 0; i < 400; i++) { world.trySpawnAnimals(false); if (i % 20 === 0) for (const m of world.mobs.values()) found.add(m.type); }
  ok([...world.mobs.values()].some((m) => MOBS[m.type].animal && !MOBS[m.type].swim) || b === 5, `spawner places land animals in ${D.BIOMES[b]}`);
}
ok(found.size >= 8, `spawner produced ${found.size} distinct animal types`);
world.mobs.clear();
console.log('# killing animals');
{ const y = world.top[sx + 3] - 1; for (const k of ['cow', 'sheep', 'chicken']) { world.drops.clear(); const m = world.addMob(k, sx + 3.5, y + 1 - MOBS[k].h, 0, DIFFN); for (let i = 0; i < 40 && world.mobs.has(m.id); i++) world.hurtMob(m, 6, 1, p);
  const got = new Set([...world.drops.values()].map((d) => d.item)); const want = { cow: I.RAW_MEAT, sheep: I.WOOL, chicken: I.FEATHER }[k]; ok(got.has(want), `${k} drops ${ITEMS[want].name}`); } }
{ // bear: peaceful until hit
  const y = world.top[sx + 2] - 1, b = world.addMob('bear', sx + 2.5, y + 1 - MOBS.bear.h, 0, DIFFN); p.x = sx + 2.5; p.y = b.y; p.hp = p.maxhp; p.invul = 0;
  for (let i = 0; i < 40; i++) world.step(0.05); ok(p.hp === p.maxhp && !(b.angry > 0), 'bear ignores you until provoked');
  world.hurtMob(b, 3, 1, p); ok(b.angry > 0, 'a hit makes the bear angry'); p.invul = 0; for (let i = 0; i < 40; i++) world.step(0.05); ok(p.hp < p.maxhp, 'an angry bear fights back');
  world.mobs.clear(); p.hp = p.maxhp; p.invul = 0;
}
console.log('# fish & fishing');
// build a pond right next to the player
const px = sx + 2, py = world.top[px] - 1; for (let x = px - 6; x <= px + 6; x++) for (let y = py + 1; y < py + 8; y++) world.setTile(x, y, y >= py + 2 ? T.WATER : T.AIR);
for (let x = px - 7; x <= px + 7; x++) world.setTile(x, py + 8, T.STONE); for (const x of [px - 7, px + 7]) for (let y = py + 1; y < py + 8; y++) world.setTile(x, y, T.STONE);
p.x = px - 2; p.y = py - 1.7 + 1; world.mobs.clear();
for (let i = 0; i < 300; i++) { world.trySpawnAnimals(false); } ok([...world.mobs.values()].some((m) => m.type === 'fish'), 'fish spawn in ponds');
const f = [...world.mobs.values()].find((m) => m.type === 'fish'); let stayed = true;
for (let i = 0; i < 1200; i++) { world.step(0.05); p.x = px - 2; if (f && world.mobs.has(f.id) && world.get(Math.floor(f.x), Math.floor(f.y + f.h / 2)) !== T.WATER) { stayed = false; break; } }
ok(stayed, 'fish stay inside the water for 60 seconds');
// a fish can be killed with a hit and drops raw fish
{ const g = world.addMob('fish', px + 0.5, py + 4, 0, DIFFN); world.drops.clear(); world.hurtMob(g, 9, 1, p); ok([...world.drops.values()].some((d) => d.item === I.RAW_FISH), 'fish drop Raw Fish'); }
const give = (items) => { p.inv.fill(null); items.forEach((it, i) => { p.inv[i] = [it[0], it[1], it[2] || 0]; }); p.sel = 0; };
const lines = () => fake.sent.filter((m) => m.t === 'toast').map((m) => m.m);
const rod = () => [I.FISHING_ROD, 1, 120];
give([rod()]); fake.sent.length = 0; world.onFish(p, { a: 'cast', x: px, y: py - 3 }); ok(!p.line && lines().some((m) => /water/i.test(m)), 'casting at air is refused with a hint');
give([[T.DIRT, 1]]); world.onFish(p, { a: 'cast', x: px, y: py + 3 }); ok(!p.line, 'casting needs a fishing rod in hand');
give([rod()]); world.onFish(p, { a: 'cast', x: px + 40, y: py + 3 }); ok(!p.line, 'casting out of range is refused');
world.onFish(p, { a: 'cast', x: px, y: py + 4 }); ok(p.line && p.line.st === 0 && Math.abs(p.line.y - (py + 2 + 0.38)) < 0.01, 'cast lands on the water surface');
let snap = world.snapshot(); ok(snap.fl.length === 1 && snap.fl[0][0] === p.id, 'other players can see the line in snapshots');
world.onFish(p, { a: 'reel' }); ok(!p.line && p.inv[0][2] === 120, 'reeling before a bite catches nothing (rod not worn)');
// full catch
function fishOnce(lure) { give(lure ? [rod(), [I.LURE, 2]] : [rod()]); world.onFish(p, { a: 'cast', x: px, y: py + 4 }); let n = 0; while (p.line && p.line.st === 0 && n++ < 400) world.step(0.05); return p.line && p.line.st === 1; }
ok(fishOnce(false), 'a fish bites after a few seconds');
ok(fake.sent.length >= 0 && world.fx.some((e) => e[0] === 'bite'), 'bite event is broadcast');
const before = p.inv.filter(Boolean).length; world.onFish(p, { a: 'reel' }); ok(!p.line && p.inv.filter(Boolean).length > before - 0 && p.inv[0][2] === 119, 'reeling during the bite lands a catch and wears the rod');
ok(p.inv.slice(1).some(Boolean), 'the catch goes into your bag');
ok(fishOnce(false), 'bite again'); for (let i = 0; i < 40; i++) world.step(0.05); ok(!p.line && lines().some((m) => /got away/.test(m)), 'a missed bite lets the fish escape');
ok(fishOnce(true) && !p.inv.some((s) => s && s[0] === I.LURE && s[1] === 2), 'a lure is consumed on cast'); world.onFish(p, { a: 'reel' });
give([rod(), [T.DIRT, 1]]); world.onFish(p, { a: 'cast', x: px, y: py + 4 }); p.sel = 1; world.step(0.05); ok(!p.line, 'switching items cancels the line');
give([rod()]); world.onFish(p, { a: 'cast', x: px, y: py + 4 }); p.x += 40; world.step(0.05); ok(!p.line, 'walking away breaks the line'); p.x -= 40;
// loot distribution sanity: mostly fish, sometimes other things, nothing invalid
{ const c = {}; for (let i = 0; i < 6000; i++) { const [id, n] = D.rollCatch(i % 6, i % 7 === 0, i % 3 === 0, Math.random); ok(ITEMS[id] && n >= 1, 'valid catch'); c[id] = (c[id] || 0) + 1; }
  ok(c[I.RAW_FISH] > 2500, 'most catches are fish'); ok(Object.keys(c).length >= 10, `varied loot (${Object.keys(c).length} kinds)`); }
// cooking & crafting
for (const [i, r] of D.RECIPES.entries()) if ([I.COOKED_FISH, I.FISHING_ROD, I.LURE, I.LEATHER_CAP, I.LEATHER_TUNIC, T.FISH_TANK, T.WOOL_BLOCK].includes(r.out)) {
  world.setTile(px - 3, py, r.st === 'furnace' ? T.FURNACE : r.st === 'bench' ? T.BENCH : T.AIR); p.x = px - 2.5; p.inv.fill(null); r.ing.forEach(([id, n], k) => { p.inv[k] = [id, n, 0]; }); world.onCraft(p, { r: i });
  ok(p.inv.some((s) => s && s[0] === r.out), `can craft ${ITEMS[r.out].name}`); world.setTile(px - 3, py, T.AIR);
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
