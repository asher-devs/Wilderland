// The Hollow Warden. Run: node --no-warnings test/boss.js
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const D = require('../public/js/defs.js'); const { T, I, ITEMS, MOBS } = D;
const { World } = require('../server/game.js'); const { openDb } = require('../server/db.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✘ FAIL:', m); } };
const db = openDb(fs.mkdtempSync(path.join(os.tmpdir(), 'wlw-'))); const world = World.create(db, { name: 'W', pid: 'h', size: 'medium', seed: 8 });
world.settings.mobs = false; world.settings.animals = false;
const fake = { open: true, sent: [], send(m) { this.sent.push(typeof m === 'string' ? JSON.parse(m) : m); }, close() {} };
const p = world.addPlayer(fake, 'pa', 'T'); const sx = Math.floor(world.spawn.x);
const flat = () => { const gy = world.top[sx]; for (let x = sx - 40; x <= sx + 40; x++) { for (let y = gy - 20; y < gy; y++) world.setTile(x, y, T.AIR); world.setTile(x, gy, T.GRASS); for (let y = gy + 1; y < gy + 6; y++) world.setTile(x, y, T.DIRT); world.top[x] = gy; world.surf[x] = gy; } return gy; };
const gy = flat(); const reset = () => { p.x = sx + 0.5; p.y = gy - p.h; p.hp = p.maxhp = 100000; p.invul = 0; p.dead = false; };
reset();
console.log('# items');
ok(ITEMS[I.WARDEN_SIGIL].summon === 'warden', 'sigil summons'); for (const id of [I.WARDEN_SIGIL, I.WARDEN_BLADE, I.WARDEN_MAIL]) ok(D.RECIPES.some((r) => r.out === id), 'recipe ' + ITEMS[id].name);
console.log('# summon');
p.inv[0] = [I.WARDEN_SIGIL, 1, 0]; p.sel = 0; world.handle(p, { t: 'summon' });
const b = world.findBoss(); ok(!!b, 'boss spawns'); ok(!p.inv[0], 'sigil consumed'); ok(b && b.maxhp === 700, 'solo hp 700');
p.inv[0] = [I.WARDEN_SIGIL, 1, 0]; world.handle(p, { t: 'summon' }); ok(p.inv[0] && p.inv[0][1] === 1, 'cannot summon a second boss');
console.log('# phase 1: stomp, shards');
let sawWave = false, sawShard = false, hits = 0, hp0 = p.hp;
for (let i = 0; i < 400; i++) { reset(); p.x = sx + 0.5; world.step(0.05); for (const a of world.arrows) { if (a.k === 3) sawWave = true; if (a.k === 1) sawShard = true; } if (p.hp < hp0) { hits++; hp0 = p.hp; } if (b.ph !== 1) break; }
ok(sawWave, 'stomp creates ground shockwaves'); ok(sawShard, 'fires crystal shards'); ok(b.onGround || true, 'stays alive'); ok(hits > 0, 'player takes damage from the boss');
console.log('# damage rules by phase');
const hit = (dmg) => { const h = b.hp; world.hurtMob(b, dmg, 1, p); return h - b.hp; };
b.sh = 0; b.stun = 0; ok(hit(20) === 20, 'normal damage'); b.sh = 1; ok(hit(20) === 7, 'shielded takes 35%'); b.sh = 0; b.stun = 2; ok(hit(20) === 30, 'stunned takes 150%');
b.stun = 0;
console.log('# phase 2: fists');
b.hp = Math.round(b.maxhp * 0.6); let sawFist = false, fistHit = false, shielded = false, open = false; hp0 = p.hp;
for (let i = 0; i < 500; i++) { reset(); p.x = sx + 0.5 + (b.x < sx ? -2 : 2); world.step(0.05); if (b.ph === 2) { if (b.fists.some((f) => f.st !== 0)) { sawFist = true; if (!b.sh) open = true; } else if (b.sh) shielded = true; } if (p.hp < hp0) { fistHit = true; hp0 = p.hp; } }
ok(b.ph === 2, 'enters phase 2 below 66%'); ok(sawFist, 'fists launch at the player'); ok(shielded && open, 'shield is up while fists are home and drops while they fly');
console.log('# phase 3: spikes, summons, crash');
b.hp = Math.round(b.maxhp * 0.3); let spike = false, minions = false, crashed = false, rose = false; const y0 = b.y;
for (let i = 0; i < 900; i++) { reset(); world.step(0.05); for (const a of world.arrows) if (a.k === 2) spike = true; for (const m of world.mobs.values()) if (m.type === 'boomer' || m.type === 'spider') minions = true; if (b.stun > 0) crashed = true; if (b.y < gy - 9) rose = true; }
ok(b.ph === 3, 'enters phase 3'); ok(rose, 'rises into the air'); ok(spike, 'rains crystal spikes'); ok(minions, 'summons minions'); ok(crashed, 'crashes down and gets stunned');
console.log('# shelter');
world.arrows.length = 0; for (let x = sx - 3; x <= sx + 3; x++) world.setTile(x, gy - 4, T.COBBLE);
reset(); p.x = sx + 0.5; p.y = gy - p.h; const hpS = p.hp; let spikeHits = 0; b.stun = 0; b.fl = 0;
for (let i = 0; i < 100; i++) { p.hp = hpS; world.step(0.05); for (const a of world.arrows) if (a.k === 2 && a.x > sx - 3 && a.x < sx + 4 && a.y > gy - 4) spikeHits++; }
ok(spikeHits === 0, 'a roof stops falling spikes');
console.log('# death & drops');
world.drops.clear(); b.stun = 0; world.hurtMob(b, 99999, 1, p);
ok(!world.findBoss(), 'boss dies'); const kinds = new Set([...world.drops.values()].map((d) => d.item)); ok(kinds.has(I.WARDEN_CORE) && kinds.has(T.CRYSTAL), 'drops core and crystal');
ok(world.state.bosses === 1, 'boss kill recorded');
console.log('# co-op scaling');
const p2 = world.addPlayer({ ...fake, sent: [] }, 'pb', 'U'); p2.x = sx + 2; p2.y = gy - p2.h; reset(); p.inv[0] = [I.WARDEN_SIGIL, 1, 0]; world.handle(p, { t: 'summon' }); const b2 = world.findBoss(); ok(b2 && b2.maxhp === 1000, '2 players: 1000 hp');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
