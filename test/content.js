// Content integrity test (v1.2): mining progression, drops, placement, crafting and item obtainability.
// Runs the real server World class in-process with a fake socket.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const D = require('../public/js/defs.js'); const { T, I, BLOCKS, ITEMS, RECIPES } = D;
const { generate } = require('../server/worldgen.js');
const { World } = require('../server/game.js'); const { openDb } = require('../server/db.js');
let pass = 0, fail = 0; const bad = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; bad.push(msg); console.log('  ✘ FAIL:', msg); } };
const section = (s) => console.log('# ' + s);

// ---------- 1. static data checks
section('definitions');
for (const b of BLOCKS) {
  if (!b || b.id === T.AIR) continue;
  const unbreakable = !isFinite(b.hard);
  if (unbreakable) { ok(b.id === T.WATER || b.id === T.BEDROCK, `only water/bedrock may be unbreakable (${b.name})`); continue; }
  ok(b.drop === -1 || !!ITEMS[b.drop], `${b.name}: drop item exists`);
  ok(b.tier === 0 || b.tool === 'pick', `${b.name}: tiered blocks require a pickaxe`);
  const picks = Object.values(ITEMS).filter((i) => i.kind === 'pick');
  ok(D.canMine(b.id, null) || picks.some((p) => D.canMine(b.id, p)), `${b.name}: some pickaxe can mine it`);
  ok(isFinite(D.mineTime(b.id, picks[picks.length - 1])), `${b.name}: best pickaxe mines it`);
}
for (const id of D.PLACEABLE) ok(!!ITEMS[id] && ITEMS[id].block === id, `placeable ${BLOCKS[id] && BLOCKS[id].name} has an item`);
for (const [i, r] of RECIPES.entries()) {
  ok(!!ITEMS[r.out], `recipe ${i}: output exists`);
  ok(['hand', 'bench', 'furnace', 'mason'].includes(r.st), `recipe ${i}: valid station`);
  ok(D.CATS.some((c) => c[0] === r.cat), `recipe ${i} (${ITEMS[r.out] && ITEMS[r.out].name}): has a category`);
  for (const [id] of r.ing) ok(!!ITEMS[id], `recipe ${i}: ingredient ${id} exists`);
}
// hardness / tier progression sanity
ok(D.mineTime(T.STONE, null) === Infinity, 'bare hands cannot mine stone');
ok(D.mineTime(T.STONE, ITEMS[I.WOOD_AXE]) === Infinity, 'an axe cannot mine stone (pickaxe required)');
ok(isFinite(D.mineTime(T.STONE, ITEMS[I.WOOD_PICK])), 'wooden pickaxe mines stone');
ok(D.mineTime(T.COPPER, ITEMS[I.WOOD_PICK]) === Infinity && isFinite(D.mineTime(T.COPPER, ITEMS[I.STONE_PICK])), 'copper ore needs a stone pickaxe');
ok(D.mineTime(T.IRON, ITEMS[I.STONE_PICK]) === Infinity && isFinite(D.mineTime(T.IRON, ITEMS[I.COPPER_PICK])), 'iron ore needs a copper pickaxe');
ok(D.mineTime(T.GOLD, ITEMS[I.COPPER_PICK]) === Infinity && isFinite(D.mineTime(T.GOLD, ITEMS[I.IRON_PICK])), 'gold ore needs an iron pickaxe');
ok(D.mineTime(T.STONE, ITEMS[I.IRON_PICK]) < D.mineTime(T.STONE, ITEMS[I.STONE_PICK]) && D.mineTime(T.STONE, ITEMS[I.STONE_PICK]) < D.mineTime(T.STONE, ITEMS[I.WOOD_PICK]), 'better pickaxes are faster');
ok(D.mineTime(T.SAND, ITEMS[I.WOOD_SHOVEL]) < D.mineTime(T.SAND, ITEMS[I.WOOD_PICK]), 'shovels dig soft blocks fastest');
ok(D.mineTime(T.LOG, ITEMS[I.WOOD_AXE]) < D.mineTime(T.LOG, null), 'axes chop wood faster than hands');
ok(isFinite(D.mineTime(T.FURNACE, null)) && isFinite(D.mineTime(T.MASON, null)), 'crafting stations can be picked up by hand');
ok(ITEMS[I.IRON_PICK].dur > ITEMS[I.WOOD_PICK].dur, 'better tools last longer');

// ---------- 2. obtainability closure over real generated worlds
section('obtainability');
const natural = new Set();
for (const seed of [1, 777, 31337]) { const g = generate(seed, 1300, 320); for (const v of g.tiles) natural.add(v); for (const ch of Object.values(g.chests)) for (const s of ch) if (s) natural.add('item' + s[0]); }
const have = new Set(); const add = (id) => { if (!have.has(id)) { have.add(id); return true; } return false; };
for (const m of Object.values(D.MOBS)) for (const d of m.drops) add(d[0]);
add(I.APPLE); add(T.TORCH);
for (const k of natural) if (typeof k === 'string') add(+k.slice(4));
let changed = true;
while (changed) {
  changed = false;
  const picks = [...have].filter((id) => ITEMS[id] && ITEMS[id].kind === 'pick').map((id) => ITEMS[id]);
  const best = picks.sort((a, b) => b.tier - a.tier)[0] || null;
  for (const k of natural) { if (typeof k === 'string') continue; const b = BLOCKS[k]; if (!b || !isFinite(b.hard)) continue; if (D.canMine(k, best) && b.drop >= 0 && add(b.drop)) changed = true; }
  const hasAxe = [...have].some((id) => ITEMS[id] && ITEMS[id].kind === 'axe');
  if (hasAxe) for (const k in D.STRIPPED) if (have.has(+k) && add(D.STRIPPED[k])) changed = true;
  const stn = { hand: true, bench: have.has(T.BENCH), furnace: have.has(T.FURNACE), mason: have.has(T.MASON) };
  for (const r of RECIPES) if (stn[r.st] && r.ing.every(([id]) => have.has(id)) && add(r.out)) changed = true;
}
for (const id of Object.keys(ITEMS)) ok(have.has(+id), `obtainable in normal play: ${ITEMS[id].name}`);
for (const id of [T.CLAY, T.GRAVEL, T.MOSS, T.PINE_LOG, T.MAPLE_LOG, T.WILLOW_LOG]) ok(natural.has(id), `${BLOCKS[id].name} generates naturally`);

// ---------- 3. live server rules
section('server rules');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wlc-')); const db = openDb(dir);
const world = World.create(db, { name: 'T', pid: 'host', size: 'small', seed: 4242 });
const fake = { open: true, sent: [], send(m) { this.sent.push(typeof m === 'string' ? JSON.parse(m) : m); }, close() {} };
const p = world.addPlayer(fake, 'pt', 'Tester');
const sx = Math.floor(world.spawn.x), sy = Math.floor(world.spawn.y + 1.8);
p.x = sx + 0.5; p.y = sy - 1.7;
const give = (id, n = 1) => { p.inv.fill(null); p.inv[0] = [id, n, ITEMS[id].dur || 0]; p.sel = 0; };
const clear = () => { for (let y = sy - 4; y <= sy; y++) for (let x = sx - 3; x <= sx + 6; x++) world.setTile(x, y, y === sy ? T.STONE : T.AIR); };
function mine(x, y, maxIter = 400) { for (let i = 0; i < maxIter; i++) { world.onMine(p, { x, y }); if (p.mine) p.mine.last -= 150; if (world.get(x, y) === T.AIR) return i; } return -1; }
clear();
const tx = sx + 2, ty = sy - 1;
const stronger = [null, I.WOOD_PICK, I.STONE_PICK, I.COPPER_PICK, I.IRON_PICK, I.CRYSTAL_PICK];
for (const b of BLOCKS) {
  if (!b || b.id === T.AIR || !isFinite(b.hard) || D.SHAPE[b.id] && D.SHAPE[b.id].kind === 'stairL') continue;
  clear(); world.setTile(tx, ty, b.id); world.drops.clear();
  if (b.tier > 0) {
    // too weak a tool must fail
    give(stronger[b.tier - 1] || I.WOOD_AXE); if (b.tier === 1) { p.inv.fill(null); p.inv[0] = [I.WOOD_AXE, 1, 60]; }
    ok(mine(tx, ty, 60) === -1, `${b.name}: refused with a too-weak tool`);
    world.setTile(tx, ty, b.id);
  }
  const t = stronger[b.tier] ? (give(stronger[b.tier]), stronger[b.tier]) : (p.inv.fill(null), 0);
  const n = mine(tx, ty);
  ok(n >= 0, `${b.name}: breakable with the right tool`);
  if (n >= 0 && b.drop >= 0 && b.dropP === 1) ok([...world.drops.values()].some((d) => d.item === b.drop), `${b.name}: drops ${ITEMS[b.drop].name}`);
}
// regression: chopping a tree with bare hands while standing still must not lose progress (idle clients send few movement packets)
clear(); world.setTile(tx, ty, T.LOG); p.inv.fill(null); p.lastMv = Date.now() - 5000;
let chopped = -1; for (let i = 0; i < 60 && chopped < 0; i++) { world.onMine(p, { x: tx, y: ty }); if (p.mine) p.mine.last -= 100; p.lastMv = Date.now() - 5000; world.step(0.05); if (world.get(tx, ty) === T.AIR) chopped = i; }
ok(chopped >= 0, 'bare-hand tree chopping completes while the player stands still');
// durability
clear(); world.setTile(tx, ty, T.STONE); give(I.WOOD_PICK); const d0 = p.inv[0][2]; mine(tx, ty); ok(p.inv[0] && p.inv[0][2] < d0, 'mining wears the tool down');
// placement
section('placement');
for (const id of D.PLACEABLE) {
  clear(); give(id, 3);
  world.onPlace(p, { x: tx, y: ty }); const placed = world.get(tx, ty);
  ok(placed !== T.AIR && (placed === id || (D.SHAPE[placed] && D.SHAPE[placed].item === id) || (D.SHAPE[id] && D.SHAPE[id].base === (D.SHAPE[placed] || {}).base)), `can place ${BLOCKS[id].name}`);
  ok(p.inv[0] && p.inv[0][1] === 2, `placing ${BLOCKS[id].name} uses one item`);
}
// stairs orientation faces away from the player
clear(); give(D.SHAPE_OF[T.COBBLE + ':stairR'], 2); p.x = tx - 1.5; world.onPlace(p, { x: tx, y: ty }); ok(world.get(tx, ty) === D.SHAPE_OF[T.COBBLE + ':stairR'], 'stairs rise away from you (player on left)');
clear(); give(D.SHAPE_OF[T.COBBLE + ':stairR'], 2); p.x = tx + 2.5; world.onPlace(p, { x: tx, y: ty }); ok(world.get(tx, ty) === D.SHAPE_OF[T.COBBLE + ':stairL'], 'stairs rise away from you (player on right)');
p.x = sx + 0.5;
// strip a log with an axe
clear(); world.setTile(tx, ty, T.PINE_LOG); give(I.STONE_AXE); world.onPlace(p, { x: tx, y: ty }); ok(world.get(tx, ty) === T.STRIPPED_PINE, 'axe strips a pine log');
ok(D.COLL[T.STRIPPED_PINE] === 1, 'stripped logs are solid building blocks');
// felling a pine tree drops pine logs
clear(); for (let k = 0; k < 4; k++) world.setTile(tx, ty - k, T.PINE_LOG); world.setTile(tx, ty - 4, T.PINE); world.drops.clear(); give(I.STONE_AXE); mine(tx, ty);
ok([...world.drops.values()].some((d) => d.item === T.PINE_LOG), 'felled pine tree drops pine logs');
// crafting every recipe
section('crafting');
const stationTile = { bench: T.BENCH, furnace: T.FURNACE, mason: T.MASON };
for (const [i, r] of RECIPES.entries()) {
  clear(); if (r.st !== 'hand') world.setTile(sx + 1, sy - 1, stationTile[r.st]);
  p.inv.fill(null); let k = 0; for (const [id, n] of r.ing) p.inv[k++] = [id, n, ITEMS[id].dur || 0];
  world.onCraft(p, { r: i });
  const got = p.inv.filter((s) => s && s[0] === r.out).reduce((a, s) => a + s[1], 0);
  ok(got === r.n, `craft #${i}: ${ITEMS[r.out].name} x${r.n}`);
  if (r.st !== 'hand') { // refused away from the station
    clear(); p.inv.fill(null); k = 0; for (const [id, n] of r.ing) p.inv[k++] = [id, n, ITEMS[id].dur || 0];
    world.onCraft(p, { r: i }); ok(!p.inv.some((s) => s && s[0] === r.out && !r.ing.some(([id]) => id === r.out)), `craft #${i}: needs a ${r.st}`);
  }
}
// beds & sleeping
section('beds');
const bx = sx + 1;
const putBed = () => { clear(); give(T.BED, 2); world.onPlace(p, { x: bx, y: ty }); };
putBed(); ok(world.get(bx, ty) === T.BED && world.get(bx + 1, ty) === T.BED_R, 'bed places as two tiles'); 
clear(); world.setTile(bx, ty, T.AIR); give(T.BED, 1); world.setTile(bx + 1, ty + 1, T.AIR); world.setTile(bx - 1, ty + 1, T.AIR); world.onPlace(p, { x: bx, y: ty }); ok(world.get(bx, ty) === T.AIR && world.get(bx - 1, ty) === T.AIR, 'bed needs solid ground under both halves'); world.setTile(bx + 1, ty + 1, T.STONE); world.setTile(bx - 1, ty + 1, T.STONE);
putBed(); world.drops.clear(); p.inv.fill(null); mine(bx + 1, ty); ok(world.get(bx, ty) === T.AIR && world.get(bx + 1, ty) === T.AIR, 'breaking one half removes the whole bed');
ok([...world.drops.values()].filter((d) => d.item === T.BED).length === 1, 'a broken bed drops exactly one bed');
const day = 0.1, night = 0.7;
putBed(); world.state.time = day; p.x = bx + 0.5; world.onSleep(p, { x: bx, y: ty });
ok(!p.sleep && p.bed && p.bed[0] === bx, 'right-clicking a bed by day sets spawn but does not sleep');
world.state.time = night; p.hp = 30; const n0 = world.state.nights; world.mobs.set(999, { id: 999, type: 'zombie', x: sx, y: sy - 2, w: .7, h: 1.7, hp: 20, vx: 0, vy: 0 });
world.onSleep(p, { x: bx, y: ty });
ok(world.state.time < 0.1 && world.state.nights === n0 + 1, 'sleeping alone at night skips to morning');
ok(!p.sleep && p.hp === p.maxhp, 'you wake up fully healed'); ok(!world.mobs.has(999), 'hostile mobs vanish when the night is skipped');
ok(fake.sent.some((m) => m.t === 'sleepOn') && fake.sent.some((m) => m.t === 'wake'), 'client is told to lie down and then wake');
// majority rule with 3 players
const f2 = { open: true, sent: [], send(m) { this.sent.push(typeof m === 'string' ? JSON.parse(m) : m); }, close() {} }, f3 = { open: true, sent: [], send(m) { this.sent.push(typeof m === 'string' ? JSON.parse(m) : m); }, close() {} };
const p2 = world.addPlayer(f2, 'p2', 'Bea'), p3 = world.addPlayer(f3, 'p3', 'Cy');
for (const q of [p, p2, p3]) { q.x = bx + 0.5; q.y = sy - 1.7; }
clear(); putBed(); give(T.BED, 1); world.setTile(bx + 3, ty, T.BED); world.setTile(bx + 4, ty, T.BED_R); world.setTile(bx + 3, ty + 1, T.STONE); world.setTile(bx + 4, ty + 1, T.STONE);
world.state.time = night; world.onSleep(p, { x: bx, y: ty });
ok(p.sleep && world.state.time === night, '1 of 3 asleep: night continues');
world.onSleep(p2, { x: bx, y: ty }); ok(!p2.sleep, 'a bed that is taken cannot be shared');
p2.x = bx + 3.5; world.onSleep(p2, { x: bx + 3, y: ty }); ok(world.state.time < 0.1, '2 of 3 asleep: night skipped');
// moving while asleep is ignored, hurt wakes you, death respawns at bed
world.state.time = night; p.x = bx + 0.5; world.onSleep(p, { x: bx, y: ty }); const px0 = p.x; world.onMove(p, { x: px0 + 1, y: p.y, vx: 0, vy: 0, f: 1, a: 0 }); ok(p.x === px0 && p.sleep, 'position updates are ignored while asleep');
p.hp -= 10; world.step(0.05); ok(!p.sleep, 'taking damage wakes you');
p.bed = [bx, ty]; p.dead = true; world.respawn(p); ok(Math.abs(p.x - (bx + 1)) < 0.01 && p.y < ty + 1, 'respawn at your bed');
world.setTile(bx, ty, T.AIR); world.setTile(bx + 1, ty, T.AIR); p.dead = true; world.respawn(p); ok(Math.abs(p.x - world.spawn.x) < 0.01, 'respawn falls back to world spawn if the bed is gone');
world.dropPlayer(p2, true); world.dropPlayer(p3, true);
// sorting
p.inv.fill(null); p.inv[12] = [T.DIRT, 10, 0]; p.inv[30] = [T.DIRT, 20, 0]; p.inv[41] = [T.STONE, 5, 0]; world.onSort(p);
ok(p.inv[10] && p.inv[10][0] === T.DIRT && p.inv[10][1] === 30, 'sort merges stacks'); ok(p.inv.filter(Boolean).length === 2, 'sort packs items together');
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log(bad.slice(0, 40).join('\n')); process.exit(1); }
process.exit(0);
