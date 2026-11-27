'use strict';
const zlib = require('node:zlib');
const D = require('../public/js/defs.js');
const { generate } = require('./worldgen.js');
const { T, I, BLOCKS, ITEMS, RECIPES, MOBS, C } = D;

const DIFF = { easy: { dmg: 0.6, hp: 0.85, spawn: 0.7 }, normal: { dmg: 1, hp: 1, spawn: 1 }, hard: { dmg: 1.5, hp: 1.3, spawn: 1.4 } };
const LOOK_MAX = { skin: 6, hairStyle: 6, hair: 10, shirt: 12, pants: 8, accent: 8 };
function cleanLook(l) {
  const o = {}; l = l || {};
  for (const k of Object.keys(LOOK_MAX)) { const v = Number.isInteger(l[k]) ? l[k] : Math.floor(Math.random() * LOOK_MAX[k]); o[k] = Math.max(0, Math.min(LOOK_MAX[k] - 1, v)); }
  return o;
}
const r2 = (n) => Math.round(n * 100) / 100;
const isNight = (t) => t >= 0.56 && t < 0.94;

// ---- inventory helpers (slot = [id, count, durability] | null)
function addToInv(inv, id, n, dur) {
  const it = ITEMS[id]; if (!it) return n;
  const max = it.stack || C.STACK;
  if (max > 1) for (let i = 0; i < inv.length && n > 0; i++) {
    const s = inv[i]; if (s && s[0] === id && s[1] < max) { const a = Math.min(max - s[1], n); s[1] += a; n -= a; }
  }
  for (let i = 0; i < inv.length && n > 0; i++) {
    if (!inv[i]) { const a = Math.min(max, n); inv[i] = [id, a, it.dur ? (dur || it.dur) : 0]; n -= a; }
  }
  return n;
}
function countInv(inv, id) { let c = 0; for (const s of inv) if (s && s[0] === id) c += s[1]; return c; }
function removeFromInv(inv, id, n) {
  for (let i = inv.length - 1; i >= 0 && n > 0; i--) {
    const s = inv[i]; if (s && s[0] === id) { const a = Math.min(s[1], n); s[1] -= a; n -= a; if (s[1] <= 0) inv[i] = null; }
  }
}
function canFit(inv, id, n) {
  const it = ITEMS[id], max = it.stack || C.STACK; let room = 0;
  for (const s of inv) { if (!s) room += max; else if (s[0] === id) room += max - s[1]; }
  return room >= n;
}

class World {
  constructor(db, rec, gen, saved) {
    this.db = db;
    this.code = rec.code; this.name = rec.name; this.seed = rec.seed; this.W = rec.w; this.H = rec.h; this.host = rec.host;
    this.settings = Object.assign({ difficulty: 'normal', mobs: true }, rec.settings);
    this.state = Object.assign({ time: 0.12, nights: 0, mined: 0, kills: 0, tiers: [] }, rec.state);
    this.created = rec.created;
    this.tiles = rec.tiles || gen.tiles; this.biome = gen.biome; this.surf = gen.surf; this.spawn = gen.spawn;
    if (rec.extra && rec.extra.length === rec.w * 3) { // keep the original terrain metadata even if the generator changes later
      this.biome = new Uint8Array(rec.extra.subarray(0, rec.w)); this.surf = new Int16Array(rec.w);
      for (let x = 0; x < rec.w; x++) this.surf[x] = rec.extra.readUInt16LE(rec.w + x * 2);
    }
    this.chests = rec.chests && Object.keys(rec.chests).length ? rec.chests : (gen.chests || {});
    this.saved = saved || {}; // pid -> persisted player data
    this.players = new Map(); this.mobs = new Map(); this.drops = new Map();
    this.weather = { rain: 0, t: 60 + Math.random() * 120, target: 0 }; this.nextId = 1; this.arrows = []; this.fx = []; this.pending = []; this.dirty = !rec.tiles; this.tick = 0; this.spawnT = 0;
    this.emptySince = Date.now(); this.lastSave = Date.now();
    // top solid per column (for sky exposure)
    this.top = new Int16Array(this.W);
    for (let x = 0; x < this.W; x++) this.rescanTop(x);
    this.worldBuf = null;
  }
  static create(db, o) {
    const [W, H] = C.SIZES[o.size] || C.SIZES.medium;
    const seed = (o.seed | 0) || Math.floor(Math.random() * 2 ** 31);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code;
    do { code = ''; for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]; } while (db.exists(code));
    const gen = generate(seed, W, H);
    const rec = { code, name: String(o.name || 'New World').slice(0, 24), seed, w: W, h: H, host: o.pid, created: Date.now(),
      settings: { difficulty: DIFF[o.difficulty] ? o.difficulty : 'normal', mobs: o.mobs !== false }, state: {}, tiles: null, chests: null };
    return new World(db, rec, gen, {});
  }
  static load(db, code) {
    const rec = db.getWorld(code); if (!rec) return null;
    const gen = rec.extra ? { tiles: null, biome: null, surf: null, chests: null, spawn: { x: rec.w / 2 + 0.5, y: 0 } } : generate(rec.seed, rec.w, rec.h);
    if (rec.extra) { const ex = rec.extra, w = rec.w; let sy = 0; const tl = rec.tiles; while (sy < rec.h && !D.SOLID[tl[sy * w + (w >> 1)]]) sy++; gen.spawn.y = sy - 1.8; gen.biome = new Uint8Array(w); gen.surf = new Int16Array(w); }
    return new World(db, rec, gen, db.getPlayers(code));
  }

  // ---------- tile access
  get(x, y) {
    if (x < 0 || x >= this.W || y >= this.H) return T.BEDROCK;
    if (y < 0) return T.AIR;
    return this.tiles[y * this.W + x];
  }
  solid(x, y) { return D.SOLID[this.get(x, y)] === 1; }
  coll(x, y) { return D.COLL[this.get(x, y)]; }
  rescanTop(x) { let y = 0; while (y < this.H && !D.OPAQUE[this.tiles[y * this.W + x]]) y++; this.top[x] = y; }
  setTile(x, y, v) {
    this.tiles[y * this.W + x] = v;
    if (D.OPAQUE[v]) { if (y < this.top[x]) this.top[x] = y; } else if (y === this.top[x]) this.rescanTop(x);
    this.pending.push([x, y, v]); this.dirty = true;
  }

  // ---------- players
  onlineCount() { return this.players.size; }
  addPlayer(ws, pid, name, look) {
    for (const p of this.players.values()) if (p.pid === pid) { p.ws.replaced = true; p.ws.close(4001); this.dropPlayer(p, true); break; }
    const sv = this.saved[pid];
    const p = {
      id: this.nextId++, pid, name: String(name || 'Player').replace(/[^\w \-.]/g, '').slice(0, 14) || 'Player', ws,
      x: this.spawn.x + (Math.random() - 0.5) * 4, y: this.spawn.y, vx: 0, vy: 0, f: 1, a: 0, w: C.PW, h: C.PH,
      inv: new Array(C.INV).fill(null), eq: { head: null, body: null, charm: null }, hp: C.PLAYER_HP, maxhp: C.PLAYER_HP,
      sel: 0, invul: 0, regen: 0, mine: null, atkCd: 0, useCd: 0, dead: false, deadT: 0, chest: null, lastMv: Date.now(),
      invDirty: true, statDirty: true, msgs: 0, msgT: Date.now(), chatTimes: [], returning: !!sv, look: cleanLook(look || (sv && sv.look)),
    };
    if (sv) {
      p.pet = !!sv.pet; p.bed = sv.bed || null; p.inv = sv.inv || p.inv; while (p.inv.length < C.INV) p.inv.push(null); p.eq = sv.eq || p.eq; p.hp = Math.max(1, sv.hp || p.hp);
      if (typeof sv.x === 'number' && sv.y > 0) { p.x = sv.x; p.y = sv.y; }
    } else {
      addToInv(p.inv, I.APPLE, 3); addToInv(p.inv, T.TORCH, 6);
    }
    p.maxhp = D.maxHpFor(p.eq); p.hp = Math.min(p.hp, p.maxhp);
    // make sure spawn is not inside blocks (world edits while away)
    if (this.collides(p, p.x, p.y)) { p.x = this.spawn.x; p.y = this.spawn.y; }
    this.players.set(p.id, p);
    this.emptySince = 0;
    return p;
  }
  collides(b, x, y) {
    const hw = b.w / 2;
    for (let ty = Math.floor(y); ty <= Math.floor(y + b.h - 1e-6); ty++) for (let tx = Math.floor(x - hw); tx <= Math.floor(x + hw - 1e-6); tx++) if (this.coll(tx, ty)) return true;
    return false;
  }
  playerData(p) { return { pid: p.pid, name: p.name, data: { look: p.look, bed: p.bed || null, inv: p.inv, eq: p.eq, hp: p.dead ? p.maxhp : p.hp, x: r2(p.x), y: r2(p.y), pet: p.pet ? 1 : 0 } }; }
  dropPlayer(p, silent) {
    if (!this.players.has(p.id)) return;
    this.players.delete(p.id);
    this.saved[p.pid] = this.playerData(p).data; this.saved[p.pid].name = p.name;
    this.dirty = true;
    if (!silent) { this.sys(`${p.name} disconnected`); }
    this.sendPlayerList();
    if (!this.players.size) this.emptySince = Date.now();
  }
  plist() { return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, host: p.pid === this.host, look: p.look })); }
  sendPlayerList() { this.broadcast({ t: 'plist', p: this.plist() }); }
  send(p, o) { if (p.ws.open) p.ws.send(typeof o === 'string' ? o : JSON.stringify(o)); }
  broadcast(o, except) { const s = JSON.stringify(o); for (const p of this.players.values()) if (p !== except) this.send(p, s); }
  sys(m) { this.broadcast({ t: 'sys', m }); }

  welcome(p) {
    if (!this.worldBuf) this.worldBuf = null; // built fresh each join so edits are included
    const W = this.W, H = this.H;
    const raw = Buffer.alloc(W * H + W + W * 2);
    raw.set(this.tiles, 0); raw.set(this.biome, W * H);
    for (let x = 0; x < W; x++) raw.writeUInt16LE(this.surf[x], W * H + W + x * 2);
    this.send(p, {
      t: 'welcome', id: p.id, code: this.code, wname: this.name, W, H, host: p.pid === this.host, settings: this.settings,
      spawn: this.spawn, time: this.state.time, x: p.x, y: p.y, hp: p.hp, maxhp: p.maxhp, def: D.defenseFor(p.eq),
      inv: p.inv, eq: p.eq, players: this.plist(), prog: this.prog(), returning: p.returning,
    });
    p.ws.send(zlib.deflateSync(raw, { level: 4 }));
    this.sys(`${p.name} ${p.returning ? 'rejoined' : 'joined'} the world`);
    this.sendPlayerList();
  }
  prog() { return { nights: this.state.nights, mined: this.state.mined, kills: this.state.kills }; }

  // ---------- message handling
  handle(p, m) {
    const now = Date.now();
    if (now - p.msgT > 1000) { p.msgT = now; p.msgs = 0; }
    if (++p.msgs > 150) return;
    switch (m.t) {
      case 'mv': return this.onMove(p, m);
      case 'mine': return this.onMine(p, m);
      case 'mineStop': p.mine = null; return;
      case 'place': return this.onPlace(p, m);
      case 'atk': return this.onAttack(p, m);
      case 'sel': p.sel = Math.max(0, Math.min(C.HOTBAR - 1, m.i | 0)); return;
      case 'sort': return this.onSort(p);
      case 'sleep': return this.onSleep(p, m);
      case 'door': return this.onDoor(p, m);
      case 'summon': return this.summonWarden(p);
      case 'till': return this.onTill(p, m);
      case 'plant': return this.onPlant(p, m);
      case 'interact': return this.onInteract(p, m);
      case 'ping': return this.send(p, { t: 'pong', c: m.c });
      case 'fish': return this.onFish(p, m);
      case 'wake': return this.wake(p);
      case 'swap': return this.onSwap(p, m);
      case 'craft': return this.onCraft(p, m);
      case 'equip': return this.onEquip(p, m);
      case 'unequip': return this.onUnequip(p, m);
      case 'drop': return this.onDrop(p, m);
      case 'use': return this.onUse(p);
      case 'chestOpen': return this.onChestOpen(p, m);
      case 'chestMove': return this.onChestMove(p, m);
      case 'chestClose': p.chest = null; return;
      case 'chat': return this.onChat(p, m);
      case 'host': return this.onHost(p, m);
      case 'look': return this.onLook(p, m);
      default:
    }
  }
  onMove(p, m) {
    if (p.dead || p.sleep) return;
    const { x, y } = m; if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const now = Date.now(), dt = Math.max(0.02, Math.min(1, (now - p.lastMv) / 1000)); p.lastMv = now;
    const lim = 48 * dt + 2.5;
    if (Math.hypot(x - p.x, y - p.y) > lim || x < 0 || x > this.W || y < -5 || y > this.H) { this.send(p, { t: 'tp', x: p.x, y: p.y }); return; }
    p.x = x; p.y = y; p.vx = +m.vx || 0; p.vy = +m.vy || 0; p.f = m.f < 0 ? -1 : 1; p.a = m.a | 0;
  }
  reach(p, tx, ty) { return Math.hypot(p.x - (tx + 0.5), p.y + p.h / 2 - (ty + 0.5)) <= C.REACH + 0.6; }
  bestTool(p, id) {
    // auto-select the best hotbar tool for the block being mined
    let best = null, bi = -1, bt = Infinity;
    const b = BLOCKS[id];
    for (let i = 0; i < C.INV; i++) {
      const s = p.inv[i]; if (!s) continue; const it = ITEMS[s[0]]; if (!it || !it.kind || it.kind === 'sword') continue;
      const t = D.mineTime(id, it); if (t < bt) { bt = t; best = it; bi = i; }
    }
    const hand = D.mineTime(id, null);
    if (hand <= bt) return { it: null, i: -1, time: hand };
    return { it: best, i: bi, time: bt };
  }
  onMine(p, m) {
    if (p.dead) return;
    const x = m.x | 0, y = m.y | 0; if (x < 1 || x >= this.W - 1 || y < 0 || y >= this.H) return;
    const id = this.get(x, y); const b = BLOCKS[id];
    if (!b || id === T.AIR || id === T.WATER || !isFinite(b.hard) || !this.reach(p, x, y)) { p.mine = null; return; }
    const now = Date.now();
    if (!p.mine || p.mine.x !== x || p.mine.y !== y) p.mine = { x, y, prog: 0, last: now - 50, fx: 0 };
    const dt = Math.min(0.2, (now - p.mine.last) / 1000); p.mine.last = now;
    const tool = this.bestTool(p, id);
    if (!isFinite(tool.time)) { p.mine = null; this.send(p, { t: 'mp', x, y, p: 0, no: 1 }); return; }
    p.mine.prog += dt / tool.time;
    if (now - p.mine.fx > 180) { p.mine.fx = now; this.fx.push(['hit', x + 0.5, y + 0.5, id]); }
    if (p.mine.prog >= 1) {
      p.mine = null;
      this.breakTile(p, x, y, tool);
      this.send(p, { t: 'mp', x, y, p: 0 });
    } else this.send(p, { t: 'mp', x, y, p: r2(p.mine.prog) });
  }
  breakTile(p, x, y, tool) {
    const id = this.get(x, y), b = BLOCKS[id];
    this.setTile(x, y, T.AIR);
    this.fx.push(['break', x + 0.5, y + 0.5, id]);
    if (id === T.CHEST) {
      const key = x + ',' + y, items = this.chests[key];
      if (items) for (const s of items) if (s) this.spawnDrop(s[0], s[1], x + 0.5, y + 0.5, s[2]);
      delete this.chests[key];
      for (const q of this.players.values()) if (q.chest === key) { q.chest = null; this.send(q, { t: 'chestClosed' }); }
    }
    if (D.DOORTILE[id]) { // two halves: remove the other one too and drop a single door
      const top = id === T.DOOR_T || id === T.DOOR_TO, oy = top ? y + 1 : y - 1, ov = this.get(x, oy);
      if (D.DOORTILE[ov] && (ov === T.DOOR_T || ov === T.DOOR_TO) !== top) this.setTile(x, oy, T.AIR);
      this.spawnDrop(T.DOOR, 1, x + 0.5, y + 0.5);
    }
    if (id === T.BED || id === T.BED_R) { // beds are two tiles: remove the other half too, drop one bed
      const ox = id === T.BED ? x + 1 : x - 1; if (this.get(ox, y) === (id === T.BED ? T.BED_R : T.BED)) this.setTile(ox, y, T.AIR);
      if (id === T.BED_R) this.spawnDrop(T.BED, 1, x + 0.5, y + 0.5);
      for (const q of this.players.values()) if (q.sleep && (q.sleep.x === x || q.sleep.x === ox) && q.sleep.y === y) this.wake(q);
    }
    this.cropDrops(id, x, y);
    if (id === T.PLANT && Math.random() < D.CROPS.seedChance) this.spawnDrop(I.WHEAT_SEEDS, 1, x + 0.5, y + 0.5);
    if (b.drop >= 0 && Math.random() < b.dropP) this.spawnDrop(b.drop, 1, x + 0.5, y + 0.5);
    if (D.LEAF[id] && id !== T.PINE && Math.random() < 0.07) this.spawnDrop(I.APPLE, 1, x + 0.5, y + 0.5);
    if (D.LOGS[id]) this.fellTree(p, x, y, id);
    // plants above lose their support
    const up = this.get(x, y - 1);
    if (D.DECOR[up] && up !== T.ROCK && up !== T.MUSHROOM) { this.setTile(x, y - 1, T.AIR); this.cropDrops(up, x, y - 1); if (BLOCKS[up].drop >= 0 && Math.random() < BLOCKS[up].dropP) this.spawnDrop(BLOCKS[up].drop, 1, x + 0.5, y - 0.5); }
    if (tool && tool.i >= 0) {
      const s = p.inv[tool.i]; s[2] -= D.toolWear(id); if (s[2] <= 0) { p.inv[tool.i] = null; this.send(p, { t: 'toolBreak', item: s[0] }); }
      p.invDirty = true;
    }
    this.state.mined++;
  }
  /** Chopping a trunk topples everything above it (only for real trees: the top must carry leaves). */
  fellTree(p, x, y, lg) {
    let top = y - 1; while (this.get(x, top) === lg) top--; // first non-log above
    const logs = []; for (let yy = y - 1; yy > top; yy--) logs.push(yy);
    if (!logs.length) return;
    let hasLeaves = false; for (let dy = -2; dy <= 2 && !hasLeaves; dy++) for (let dx = -2; dx <= 2; dx++) if (D.LEAF[this.get(x + dx, top + 1 + dy)]) { hasLeaves = true; break; }
    if (!hasLeaves) return;
    const dir = (x + 0.5 - p.x) >= 0 ? 1 : -1, leaves = [], seen = new Set();
    const q = []; for (const ly of logs) { q.push([x, ly, 0]); }
    for (let qi = 0; qi < q.length && leaves.length < 90; qi++) {
      const [cx, cy, d] = q[qi]; if (d >= 5) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy, k = ny * this.W + nx; if (seen.has(k) || !D.LEAF[this.get(nx, ny)]) continue; seen.add(k); leaves.push([nx, ny, this.get(nx, ny)]); q.push([nx, ny, d + 1]); }
    }
    for (const ly of logs) { this.setTile(x, ly, T.AIR); this.spawnDrop(lg, 1, x + 0.5 + dir * (logs[0] - ly) * 0.25, ly + 0.5, 0, dir * 2, -3); }
    for (const [lx, ly, lt] of leaves) { this.setTile(lx, ly, T.AIR); if (lt !== T.PINE && Math.random() < 0.05) this.spawnDrop(I.APPLE, 1, lx + 0.5, ly + 0.5); }
    this.fx.push(['tree', x + 0.5, y, { h: logs.length, dir, base: y, lg, leaves: leaves.map(([lx, ly, lt]) => [lx - x, ly - y, lt]).slice(0, 80), n: logs.length }]);
  }
  onPlace(p, m) {
    if (p.dead) return;
    const x = m.x | 0, y = m.y | 0; if (x < 1 || x >= this.W - 1 || y < 1 || y >= this.H - 3) return;
    const s = p.inv[p.sel]; if (!s) return; const it = ITEMS[s[0]];
    const cur = this.get(x, y);
    // axe on a natural log strips it into a solid building log
    if (it && it.kind === 'axe' && D.STRIPPED[cur]) {
      if (!this.reach(p, x, y)) return;
      this.setTile(x, y, D.STRIPPED[cur]); this.fx.push(['place', x + 0.5, y + 0.5, D.STRIPPED[cur]]);
      s[2]--; if (s[2] <= 0) { p.inv[p.sel] = null; this.send(p, { t: 'toolBreak', item: s[0] }); } p.invDirty = true; return;
    }
    if (!it || !it.block) return;
    if (D.BACKWALL[it.block] ? !(cur === T.AIR || (D.BACKWALL[cur] && cur !== it.block)) : !(cur === T.AIR || cur === T.WATER || D.BACKWALL[cur] || D.DECOR[cur] && cur !== T.ROCK || D.LEAF[cur])) return;
    if (!this.reach(p, x, y)) return;
    const sup = (a, b2) => { const v = this.get(a, b2); return v !== T.AIR && v !== T.WATER && !D.DECOR[v]; };
    if (!(sup(x - 1, y) || sup(x + 1, y) || sup(x, y - 1) || sup(x, y + 1) || y > this.surf[x] + 1)) return;
    let blk = it.block;
    if (blk === T.BED) { // two tiles wide, needs solid ground under both halves
      const free = (a) => this.get(a, y) === T.AIR && D.SOLID[this.get(a, y + 1)] === 1 && a > 0 && a < this.W - 1;
      let lx = -1; if (free(x) && free(x + 1)) lx = x; else if (free(x) && free(x - 1)) lx = x - 1; if (lx < 0) return;
      this.setTile(lx, y, T.BED); this.setTile(lx + 1, y, T.BED_R); this.fx.push(['place', lx + 1, y + 0.5, T.BED]);
      if (--s[1] <= 0) p.inv[p.sel] = null; p.invDirty = true; return;
    }
    if (blk === T.DOOR) { // two tiles tall: bottom half rests on solid ground
      const freeT = (yy) => { const v = this.get(x, yy); return v === T.AIR || D.BACKWALL[v]; };
      let by = -1; if (freeT(y) && freeT(y - 1) && D.SOLID[this.get(x, y + 1)] === 1) by = y; else if (freeT(y) && freeT(y + 1) && D.SOLID[this.get(x, y + 2)] === 1) by = y + 1;
      if (by < 0) return;
      for (const q of this.players.values()) if (!q.dead && x + 1 > q.x - q.w / 2 && x < q.x + q.w / 2 && by + 1 > q.y && by - 1 < q.y + q.h) return;
      this.setTile(x, by - 1, T.DOOR_T); this.setTile(x, by, T.DOOR); this.fx.push(['place', x + 0.5, by, T.DOOR]);
      if (--s[1] <= 0) p.inv[p.sel] = null; p.invDirty = true; return;
    }
    const sh = D.SHAPE[blk];
    if (sh && sh.kind === 'stairR') blk = p.x < x + 0.5 ? D.SHAPE_OF[sh.base + ':stairR'] : D.SHAPE_OF[sh.base + ':stairL']; // tall side faces away from you
    if (D.COLL[blk]) for (const q of this.players.values()) {
      if (q.dead) continue;
      if (x + 1 > q.x - q.w / 2 && x < q.x + q.w / 2 && y + 1 > q.y && y < q.y + q.h) return;
    }
    this.setTile(x, y, blk);
    if (blk === T.CHEST) this.chests[x + ',' + y] = new Array(C.CHEST_SLOTS).fill(null);
    this.fx.push(['place', x + 0.5, y + 0.5, blk]);
    if (--s[1] <= 0) p.inv[p.sel] = null;
    p.invDirty = true;
  }
  onAttack(p, m) {
    if (p.dead) return;
    const now = Date.now(); if (now < p.atkCd) return;
    const s = p.inv[p.sel], it = s && ITEMS[s[0]];
    const dmg = it && it.dmg ? it.dmg : 3, cd = it && it.kind === 'sword' ? 330 : 450;
    p.atkCd = now + cd;
    const dir = m.d < 0 ? -1 : 1, cx = p.x, cy = p.y + p.h * 0.5; let hit = 0;
    for (const mob of this.mobs.values()) {
      const dx = (mob.x - cx) * dir, dy = mob.y + mob.h / 2 - cy;
      if (dx < -0.6 || dx > 3.0 + mob.w / 2 || Math.abs(dy) > 1.8) continue;
      this.hurtMob(mob, dmg * (0.9 + Math.random() * 0.2), dir, p); hit++;
    }
    if (hit && it && it.dur) { s[2]--; if (s[2] <= 0) { p.inv[p.sel] = null; this.send(p, { t: 'toolBreak', item: s[0] }); } p.invDirty = true; }
  }
  hurtMob(mob, dmg, dir, p) {
    if (mob.owner) return; // tamed pets cannot be hurt
    if (mob.type === 'warden') dmg *= mob.sh ? 0.35 : mob.stun > 0 ? 1.5 : 1;
    dmg = Math.max(1, Math.round(dmg));
    if (mob.type === 'warden') { mob.hp -= dmg; mob.hurt = 0.12; this.fx.push(['mobhit', mob.x + (Math.random() - 0.5) * 2.4, mob.y + 1 + Math.random() * 3, dmg]);
      if (mob.hp <= 0) { this.mobs.delete(mob.id); this.state.kills++; this.state.bosses = (this.state.bosses || 0) + 1; this.dirty = true; this.fx.push(['bossdie', mob.x, mob.y + mob.h / 2, 0]);
        for (const d of MOBS.warden.drops) if (Math.random() < d[1]) this.spawnDrop(d[0], d[2] + Math.floor(Math.random() * (d[3] - d[2] + 1)), mob.x + (Math.random() - 0.5) * 2, mob.y + 2);
        this.sys('🏆 The Hollow Warden has fallen!'); }
      return; }
    if (MOBS[mob.type].neutral) mob.angry = 20; else if (MOBS[mob.type].animal) mob.scared = 6;
    mob.hp -= dmg; mob.hurt = 0.3; mob.vx = dir * 7; mob.vy = -6; mob.ground = false;
    this.fx.push(['mobhit', mob.x, mob.y + mob.h / 2, dmg]);
    if (mob.hp <= 0) {
      this.mobs.delete(mob.id); this.state.kills++;
      this.fx.push(['mobdie', mob.x, mob.y + mob.h / 2, mob.type]);
      for (const d of MOBS[mob.type].drops) if (Math.random() < d[1]) this.spawnDrop(d[0], d[2] + Math.floor(Math.random() * (d[3] - d[2] + 1)), mob.x, mob.y);
    }
  }
  bedLeft(x, y) { const v = this.get(x, y); return v === T.BED ? x : v === T.BED_R && this.get(x - 1, y) === T.BED ? x - 1 : -1; }
  /** right-click a bed: set your spawn; at night also sleep. When half the players (rounded up) sleep, the night is skipped. */
  onSleep(p, m) {
    if (p.dead || p.sleep) return;
    const x = m.x | 0, y = m.y | 0, lx = this.bedLeft(x, y); if (lx < 0 || !this.reach(p, lx, y)) return;
    p.bed = [lx, y]; p.statDirty = true;
    if (!isNight(this.state.time)) return this.send(p, { t: 'toast', m: 'Spawn point set. You can only sleep at night.' });
    if (this.sleepers().some((q) => q.sleep.x === lx && q.sleep.y === y)) return this.send(p, { t: 'toast', m: 'This bed is taken' });
    p.sleep = { x: lx, y, hp: p.hp }; p.x = lx + 1.7; p.y = y + 0.75 - p.h; p.vx = p.vy = 0; p.a = 10; p.mine = null; p.lastMv = Date.now();
    this.send(p, { t: 'sleepOn', x: p.x, y: p.y });
    const n = this.players.size, z = this.sleepers().length, need = Math.ceil(n / 2);
    if (z >= need) this.skipNight(); else this.sys(`💤 ${p.name} is sleeping (${z}/${need} needed to skip the night)`);
  }
  sleepers() { return [...this.players.values()].filter((q) => q.sleep); }
  wake(p) { if (!p.sleep) return; p.sleep = null; p.a = 0; p.lastMv = Date.now(); this.send(p, { t: 'wake' }); }
  skipNight() {
    const st = this.state; st.time = 0.02; st.nights++; this.dirty = true; this.wasNight = false;
    this.weather.target = 0; this.weather.rain = 0; this.weather.t = 90 + Math.random() * 120;
    for (const [id, mob] of [...this.mobs]) if (!MOBS[mob.type].passive) this.mobs.delete(id);
    for (const q of this.players.values()) { if (q.sleep) { q.hp = q.maxhp; q.statDirty = true; } this.wake(q); }
    this.sys(`🌅 Everyone slept through the night — good morning! (night ${st.nights} survived)`);
  }
  /** merge stacks and order by category then id; hotbar (first 10 slots) is left alone */
  onSort(p) {
    const items = []; for (let i = C.HOTBAR; i < C.INV; i++) if (p.inv[i]) items.push(p.inv[i]);
    const merged = [];
    for (const s of items) {
      const max = ITEMS[s[0]].stack || 1;
      if (max > 1) { const t = merged.find((q) => q[0] === s[0] && q[1] < max); if (t) { const mv = Math.min(max - t[1], s[1]); t[1] += mv; s[1] -= mv; if (s[1] <= 0) continue; } }
      merged.push(s);
    }
    const rank = (id) => { const it = ITEMS[id]; return it.kind ? 0 : it.armor ? 1 : it.heal ? 2 : it.block !== undefined ? 3 : 4; };
    merged.sort((a, b) => rank(a[0]) - rank(b[0]) || a[0] - b[0]);
    for (let i = C.HOTBAR; i < C.INV; i++) p.inv[i] = merged[i - C.HOTBAR] || null;
    p.invDirty = true;
  }
  onSwap(p, m) {
    const a = m.a | 0, b = m.b | 0; if (a < 0 || b < 0 || a >= C.INV || b >= C.INV || a === b) return;
    const A = p.inv[a], B = p.inv[b];
    if (A && B && A[0] === B[0] && (ITEMS[A[0]].stack || 1) > 1) {
      const max = ITEMS[A[0]].stack, mv = Math.min(max - B[1], A[1]); B[1] += mv; A[1] -= mv; if (A[1] <= 0) p.inv[a] = null;
    } else { p.inv[a] = B; p.inv[b] = A; }
    p.invDirty = true;
  }
  onEquip(p, m) {
    const i = m.from | 0; const s = p.inv[i]; if (!s) return; const it = ITEMS[s[0]]; if (!it || !it.armor) return;
    const old = p.eq[it.armor]; p.eq[it.armor] = s; p.inv[i] = old || null;
    p.maxhp = D.maxHpFor(p.eq); p.hp = Math.min(p.hp, p.maxhp); p.invDirty = p.statDirty = true;
  }
  onUnequip(p, m) {
    const k = m.slot; if (!p.eq[k]) return;
    const i = p.inv.findIndex((s) => !s); if (i < 0) return;
    p.inv[i] = p.eq[k]; p.eq[k] = null; p.maxhp = D.maxHpFor(p.eq); p.hp = Math.min(p.hp, p.maxhp); p.invDirty = p.statDirty = true;
  }
  onDrop(p, m) {
    const i = m.i | 0; const s = p.inv[i]; if (!s) return;
    const n = m.all ? s[1] : 1; const d = this.spawnDrop(s[0], n, p.x, p.y + 0.5, s[2], p.f * 4, -3); if (d) d.delay = 1.2;
    s[1] -= n; if (s[1] <= 0) p.inv[i] = null; p.invDirty = true;
  }
  onDoor(p, m) {
    if (p.dead || p.sleep) return;
    const x = m.x | 0, y = m.y | 0, id = this.get(x, y); if (!D.DOORTILE[id] || !this.reach(p, x, y)) return;
    const top = id === T.DOOR_T || id === T.DOOR_TO, by = top ? y + 1 : y, ty = by - 1, bid = this.get(x, by), tid = this.get(x, ty);
    if (!((bid === T.DOOR && tid === T.DOOR_T) || (bid === T.DOOR_BO && tid === T.DOOR_TO))) return;
    if (bid === T.DOOR) { this.setTile(x, by, T.DOOR_BO); this.setTile(x, ty, T.DOOR_TO); this.fx.push(['door', x + 0.5, by, 1]); return; }
    for (const q of this.players.values()) if (!q.dead && x + 1 > q.x - q.w / 2 && x < q.x + q.w / 2 && by + 1 > q.y && ty < q.y + q.h) { this.send(p, { t: 'toast', m: 'Something is in the doorway' }); return; }
    this.setTile(x, by, T.DOOR); this.setTile(x, ty, T.DOOR_T); this.fx.push(['door', x + 0.5, by, 0]);
  }
  onUse(p) {
    if (p.dead || Date.now() < p.useCd) return;
    const s = p.inv[p.sel]; if (!s) return; const it = ITEMS[s[0]]; if (!it || !it.heal || p.hp >= p.maxhp) return;
    p.useCd = Date.now() + 700; p.hp = Math.min(p.maxhp, p.hp + it.heal); p.statDirty = true;
    if (--s[1] <= 0) p.inv[p.sel] = null; p.invDirty = true; this.fx.push(['heal', p.x, p.y, p.id]);
  }
  nearStation(p, tile) {
    const cx = Math.floor(p.x), cy = Math.floor(p.y + 1);
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 6; x <= cx + 6; x++) if (this.get(x, y) === tile) return true;
    return false;
  }
  onCraft(p, m) {
    if (p.dead) return;
    const r = RECIPES[m.r | 0]; if (!r) return;
    if (r.st === 'bench' && !this.nearStation(p, T.BENCH)) return this.send(p, { t: 'toast', m: 'You need a Workbench nearby' });
    if (r.st === 'furnace' && !this.nearStation(p, T.FURNACE)) return this.send(p, { t: 'toast', m: 'You need a Furnace nearby' });
    if (r.st === 'mason' && !this.nearStation(p, T.MASON)) return this.send(p, { t: 'toast', m: "You need a Mason's Table nearby" });
    for (const [id, n] of r.ing) if (countInv(p.inv, id) < n) return;
    const before = p.inv.map((s) => (s ? s.slice() : null));
    for (const [id, n] of r.ing) removeFromInv(p.inv, id, n);
    if (!canFit(p.inv, r.out, r.n)) { p.inv = before; return this.send(p, { t: 'toast', m: 'Inventory full' }); }
    addToInv(p.inv, r.out, r.n);
    p.invDirty = true; this.send(p, { t: 'crafted', item: r.out });
    const it = ITEMS[r.out];
    if (it && it.kind === 'pick') {
      const names = ['', 'Wooden', 'Stone', 'Copper', 'Iron', 'Crystal']; const key = names[it.tier];
      if (!this.state.tiers.includes(key)) { this.state.tiers.push(key); this.sys(`★ ${p.name} has entered the ${key} Age!`); this.dirty = true; }
    }
  }
  onChestOpen(p, m) {
    const x = m.x | 0, y = m.y | 0, key = x + ',' + y;
    if (this.get(x, y) !== T.CHEST || !this.reach(p, x, y)) return;
    if (!this.chests[key]) this.chests[key] = new Array(C.CHEST_SLOTS).fill(null);
    p.chest = key; this.send(p, { t: 'chest', x, y, slots: this.chests[key] });
  }
  onChestMove(p, m) {
    const key = p.chest; if (!key || key !== (m.x | 0) + ',' + (m.y | 0)) return;
    const [cx, cy] = key.split(',').map(Number); if (!this.reach(p, cx, cy)) { p.chest = null; return; }
    const ch = this.chests[key]; if (!ch) return;
    const i = m.i | 0;
    if (m.from === 'inv') {
      const s = p.inv[i]; if (!s) return;
      const left = addToInv(ch, s[0], s[1], s[2]);
      if (left < s[1]) { if (left <= 0) p.inv[i] = null; else s[1] = left; }
    } else {
      const s = ch[i]; if (!s) return;
      const left = addToInv(p.inv, s[0], s[1], s[2]);
      if (left < s[1]) { if (left <= 0) ch[i] = null; else s[1] = left; }
    }
    p.invDirty = true; this.dirty = true;
    for (const q of this.players.values()) if (q.chest === key) this.send(q, { t: 'chest', x: cx, y: cy, slots: ch });
  }
  onChat(p, m) {
    const text = String(m.m || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 160); if (!text) return;
    const now = Date.now(); p.chatTimes = p.chatTimes.filter((t) => now - t < 5000); if (p.chatTimes.length >= 5) return; p.chatTimes.push(now);
    this.broadcast({ t: 'chat', id: p.id, n: p.name, m: text });
  }
  onLook(p, m) { p.look = cleanLook(m.look); this.sendPlayerList(); }
  onHost(p, m) {
    if (p.pid !== this.host) return this.send(p, { t: 'toast', m: 'Only the host can do that' });
    switch (m.op) {
      case 'kick': { const q = this.players.get(m.id | 0); if (!q || q === p) return; this.send(q, { t: 'kicked' }); this.sys(`${q.name} was removed by the host`); q.ws.close(4002); break; }
      case 'time': this.state.time = m.v === 'night' ? 0.62 : 0.05; this.sys(`Host set time to ${m.v === 'night' ? 'night' : 'day'}`); break;
      case 'difficulty': if (DIFF[m.v]) { this.settings.difficulty = m.v; this.sys(`Difficulty: ${m.v}`); } break;
      case 'mobs': this.settings.mobs = !!m.v; if (!m.v) this.mobs.clear(); this.sys(`Monster spawning ${m.v ? 'on' : 'off'}`); break;
      case 'weather': this.weather.target = m.v === 'rain' ? 1 : 0; this.weather.t = 120 + Math.random() * 120; this.sys(m.v === 'rain' ? '☁ Host summoned rain' : '☀ Host cleared the skies'); break;
      case 'clearmobs': this.mobs.clear(); this.sys('Host cleared all creatures'); break;
      case 'save': this.save(); this.send(p, { t: 'toast', m: 'World saved' }); break;
      default: return;
    }
    this.dirty = true; this.broadcast({ t: 'settings', settings: this.settings });
  }

  // ---------- drops
  spawnDrop(item, n, x, y, dur, vx, vy) {
    if (!ITEMS[item] || n <= 0) return null;
    if (this.drops.size > 220) this.drops.delete(this.drops.keys().next().value);
    const d = { id: this.nextId++, item, n, dur: dur || 0, x, y, w: 0.4, h: 0.4, vx: vx === undefined ? (Math.random() - 0.5) * 4 : vx, vy: vy === undefined ? -4 - Math.random() * 2 : vy, age: 0, delay: 0.3, kind: 'drop' };
    this.drops.set(d.id, d); return d;
  }

  // ---------- simulation
  step(dt) {
    this.tick++;
    const st = this.state;
    st.time += dt / C.DAY_LEN; if (st.time >= 1) st.time -= 1;
    if (this.wasNight && !isNight(st.time) && this.players.size) {
      st.nights++; this.sys(`☀ Dawn breaks — you survived night ${st.nights}`); this.dirty = true;
    }
    this.wasNight = isNight(st.time);
    const wz = this.weather; wz.t -= dt;
    if (wz.t <= 0) { wz.target = wz.target ? 0 : (Math.random() < 0.55 ? 1 : 0); wz.t = wz.target ? 50 + Math.random() * 70 : 90 + Math.random() * 200; if (this.players.size) this.sys(wz.target ? '☁ Clouds roll in… it begins to rain' : '☀ The rain clears'); }
    wz.rain += (wz.target - wz.rain) * Math.min(1, dt * 0.25);
    const night = isNight(st.time);
    const solid = (x, y) => this.coll(x, y);
    // players
    for (const p of this.players.values()) {
      if (p.invul > 0) p.invul -= dt;
      if (p.dead) { p.deadT -= dt; if (p.deadT <= 0) this.respawn(p); continue; }
      if (p.sleep) { if (p.hp < p.sleep.hp - 0.5) this.wake(p); else p.sleep.hp = Math.max(p.sleep.hp, p.hp); } // being hurt wakes you
      p.regen += dt; if (p.regen > 4 && p.hp < p.maxhp) { p.hp = Math.min(p.maxhp, p.hp + 3 * dt); p.statDirty = true; }
      // drop mining progress only if the client stopped sending 'mine' (NOT when the player simply stands still: idle clients send few 'mv' packets)
      if (p.mine && Date.now() - p.mine.last > 800) p.mine = null;
    }
    // spawning
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.settings.mobs && this.players.size) { this.spawnT = 1.0; this.trySpawn(night); }
    this.animalT = (this.animalT || 0) - dt; if (this.animalT <= 0 && this.players.size) { this.animalT = 2.2; this.trySpawnAnimals(night); }
    this.stepFishing(dt); this.stepCrops(dt);
    this.breedT = (this.breedT || 0) - dt; if (this.breedT <= 0) { this.breedT = 0.5; this.stepBreeding(); }
    this.petT = (this.petT || 0) - dt; if (this.petT <= 0) { this.petT = 3; this.ensurePets(); }
    // mobs
    for (const mob of this.mobs.values()) this.stepMob(mob, dt, night, solid);
    // drops
    for (const d of this.drops.values()) {
      d.age += dt; if (d.delay > 0) d.delay -= dt;
      if (d.age > 300) { this.drops.delete(d.id); continue; }
      d.vy = Math.min(C.MAXFALL, d.vy + C.GRAVITY * dt); d.vx *= d.vy === 0 ? 0.8 : 0.995;
      const inWater = this.get(Math.floor(d.x), Math.floor(d.y)) === T.WATER; if (inWater) { d.vy = Math.min(d.vy, 2.5); d.vx *= 0.9; }
      D.moveBody(d, dt, solid);
      if (d.delay <= 0) for (const p of this.players.values()) {
        if (p.dead) continue;
        const dx = p.x - d.x, dy = p.y + p.h / 2 - d.y, dist = Math.hypot(dx, dy);
        if (dist < 3.2 && canFit(p.inv, d.item, 1)) { const k = 16 / Math.max(dist, 0.3); d.vx += dx / dist * k * dt * 4; d.vy += dy / dist * k * dt * 4 - C.GRAVITY * dt * 0.8; }
        if (dist < 0.9) {
          const left = addToInv(p.inv, d.item, d.n, d.dur);
          if (left < d.n) { p.invDirty = true; this.fx.push(['pickup', d.x, d.y, p.id]); }
          if (left <= 0) { this.drops.delete(d.id); break; } d.n = left;
        }
      }
    }
    this.stepArrows(dt);
    // contact damage
    for (const mob of this.mobs.values()) {
      if (!mob.dmg || mob.owner || (MOBS[mob.type].neutral && !(mob.angry > 0))) continue;
      for (const p of this.players.values()) {
        if (p.dead || p.invul > 0) continue;
        if (Math.abs(mob.x - p.x) < (mob.w + p.w) / 2 && mob.y < p.y + p.h && mob.y + mob.h > p.y) this.hurtPlayer(p, mob.dmg, mob.x < p.x ? 1 : -1, mob.name);
      }
    }
  }
  clearLine(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let i = 1; i < n; i++) { const t = i / n; if (this.solid(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))) return false; }
    return true;
  }
  /** a blast: hurts players and mobs in range and clears soft blocks (never ore, stone or metal) */
  explode(x, y, r, dmg, src) {
    this.fx.push(['boom', x, y, r]);
    for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
      if (Math.hypot(xx + 0.5 - x, yy + 0.5 - y) > r - 0.3 || xx < 2 || xx >= this.W - 2 || yy < 2 || yy >= this.H - 3) continue;
      const id = this.get(xx, yy), b = D.BLOCKS[id]; if (!b || id === T.AIR || id === T.WATER || id === T.BED || id === T.BED_R || id === T.CHEST) continue;
      if (b.mat === 'soft' || b.mat === 'wood' || b.mat === 'glass') this.setTile(xx, yy, T.AIR);
    }
    for (const p of this.players.values()) {
      if (p.dead) continue; const d = Math.hypot(p.x - x, p.y + 0.8 - y); if (d > r + 1 || p.invul > 0) continue;
      this.hurtPlayer(p, Math.round(dmg * (1 - d / (r + 1.5))) + 4, p.x < x ? -1 : 1, src ? src.name : 'Explosion');
    }
    for (const m of this.mobs.values()) { if (m === src || MOBS[m.type].animal) continue; const d = Math.hypot(m.x - x, m.y - y); if (d < r) { m.hp -= Math.round(dmg * 0.5 * (1 - d / r)); if (m.hp <= 0) this.mobs.delete(m.id); } }
  }
  /** projectiles: k 0 arrow, 1 crystal shard (straight), 2 falling spike, 3 ground shockwave */
  stepArrows(dt) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i], k = a.k || 0; a.life -= dt;
      a.vy += (k === 2 ? 20 : k === 1 || k === 3 ? 0 : 14) * dt; a.x += a.vx * dt; a.y += a.vy * dt;
      let dead = a.life <= 0 || this.solid(Math.floor(a.x), Math.floor(k === 3 ? a.y - 0.5 : a.y));
      if (!dead) for (const p of this.players.values()) {
        if (p.dead || p.invul > 0) continue;
        let hit;
        if (k === 3) hit = Math.abs(a.x - p.x) < p.w / 2 + 0.6 && p.y + p.h > a.y - 0.55;
        else { const r = k === 0 ? 0.15 : 0.4; hit = Math.abs(a.x - p.x) < p.w / 2 + r && a.y > p.y - r && a.y < p.y + p.h + r; }
        if (hit) { this.hurtPlayer(p, a.dmg, a.vx > 0 ? 1 : -1, a.by || 'Skeleton'); dead = true; break; }
      }
      if (dead) this.arrows.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- farming, breeding, taming
  cropDrops(id, x, y) {
    const ripe = D.CROPS.ripe[id];
    if (ripe) for (const [it, lo, hi] of ripe) this.spawnDrop(it, lo + Math.floor(Math.random() * (hi - lo + 1)), x + 0.5, y + 0.5);
    else if (D.CROPS.seed[id]) this.spawnDrop(D.CROPS.seed[id], 1, x + 0.5, y + 0.5);
  }
  onTill(p, m) {
    if (p.dead || p.sleep) return; const s = p.inv[p.sel]; if (!s || ITEMS[s[0]].kind !== 'hoe') return;
    const x = m.x | 0, y = m.y | 0, id = this.get(x, y); if (!this.reach(p, x, y)) return;
    if (!(id === T.DIRT || id === T.GRASS || id === T.MUD) || !(this.get(x, y - 1) === T.AIR || D.DECOR[this.get(x, y - 1)])) return;
    if (D.DECOR[this.get(x, y - 1)]) this.setTile(x, y - 1, T.AIR);
    this.setTile(x, y, T.FARMLAND); this.fx.push(['place', x + 0.5, y + 0.5, T.DIRT]);
    s[2] -= 1; if (s[2] <= 0) { p.inv[p.sel] = null; this.send(p, { t: 'toolBreak', item: s[0] }); } p.invDirty = true;
  }
  onPlant(p, m) {
    if (p.dead || p.sleep) return; const s = p.inv[p.sel]; if (!s || !ITEMS[s[0]].plant) return;
    const x = m.x | 0; let y = m.y | 0;
    const cy = this.get(x, y) === T.FARMLAND ? y - 1 : (this.get(x, y + 1) === T.FARMLAND ? y : -1);
    if (cy < 0 || !this.reach(p, x, cy) || this.get(x, cy) !== T.AIR) return;
    this.setTile(x, cy, ITEMS[s[0]].plant); this.fx.push(['place', x + 0.5, cy + 0.5, T.PLANT]);
    if (--s[1] <= 0) p.inv[p.sel] = null; p.invDirty = true;
  }
  /** grow crops near players: faster with water close to the farmland and in rain */
  stepCrops(dt) {
    this.cropT = (this.cropT || 0) - dt; if (this.cropT > 0) return; this.cropT = 2.5;
    const seen = new Set();
    for (const p of this.players.values()) {
      const x0 = Math.max(1, Math.floor(p.x) - 45), x1 = Math.min(this.W - 2, Math.floor(p.x) + 45), y0 = Math.max(1, Math.floor(p.y) - 30), y1 = Math.min(this.H - 3, Math.floor(p.y) + 30);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const id = this.get(x, y), nx = D.CROPS.next[id]; if (!nx) continue; const key = y * this.W + x; if (seen.has(key)) continue; seen.add(key);
        if (this.get(x, y + 1) !== T.FARMLAND) { this.setTile(x, y, T.AIR); continue; }
        let wet = false; for (let dx = -4; dx <= 4 && !wet; dx++) if (this.get(x + dx, y + 1) === T.WATER || this.get(x + dx, y) === T.WATER) wet = true;
        const chance = 0.03 * (wet ? 3 : 1) * (this.weather.rain > 0.3 ? 1.8 : 1);
        if (Math.random() < chance) this.setTile(x, y, nx);
      }
    }
  }
  onInteract(p, m) {
    if (p.dead || p.sleep) return; const mob = this.mobs.get(m.id | 0); if (!mob) return;
    if (Math.hypot(mob.x - p.x, mob.y + mob.h / 2 - (p.y + 0.8)) > 5.5) return;
    const def = MOBS[mob.type], s = p.inv[p.sel], hid = s ? s[0] : 0;
    const eat = () => { if (--s[1] <= 0) p.inv[p.sel] = null; p.invDirty = true; };
    if (def.tameable) {
      if (mob.owner) { if (mob.owner === p.id) { mob.sit = !mob.sit; this.fx.push(['love', mob.x, mob.y, mob.sit ? 0 : 1]); } return; }
      if (hid === I.RAW_MEAT || hid === I.COOKED_MEAT) {
        if (p.pet) return this.send(p, { t: 'toast', m: 'You already have a husky companion' });
        eat();
        if (Math.random() < (hid === I.COOKED_MEAT ? 0.6 : 0.35)) { mob.owner = p.id; mob.sit = false; mob.angry = 0; p.pet = true; this.dirty = true; this.fx.push(['tame', mob.x, mob.y, 1]); this.send(p, { t: 'toast', m: '🐕 The husky is now your companion! Tap it to sit/stand.' }); }
        else this.fx.push(['tame', mob.x, mob.y, 0]);
      }
      return;
    }
    if (D.FEED[mob.type] && hid === D.FEED[mob.type] && !mob.baby && !(mob.love > 0) && !(mob.cool > 0)) {
      eat(); mob.love = 14; this.fx.push(['love', mob.x, mob.y, 1]);
    }
  }
  growUp(mob) { const def = MOBS[mob.type]; mob.baby = false; mob.w = def.w; mob.h = def.h; mob.y -= def.h * 0.45; }
  /** two animals in love close to each other make a baby */
  stepBreeding() {
    const lovers = []; for (const m of this.mobs.values()) if (m.love > 0 && !m.baby && D.FEED[m.type]) lovers.push(m);
    for (const m of lovers) { // walk toward the nearest partner in love
      let best = null, bd = 16; for (const o of lovers) if (o !== m && o.type === m.type) { const d = Math.abs(o.x - m.x); if (d < bd) { bd = d; best = o; } }
      if (best && bd > 1.6 && !MOBS[m.type].fly) { m.dir = best.x < m.x ? -1 : 1; m.nextT = m.t + 1.4; }
    }
    for (let i = 0; i < lovers.length; i++) for (let j = i + 1; j < lovers.length; j++) {
      const a = lovers[i], b = lovers[j]; if (a.type !== b.type || a.love <= 0 || b.love <= 0) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > 3.2) continue;
      a.love = b.love = 0; a.cool = b.cool = 120; const def = MOBS[a.type];
      const baby = this.addMob(a.type, (a.x + b.x) / 2, Math.min(a.y, b.y) + def.h * 0.45, 0, DIFF.normal); baby.baby = true; baby.age = 0; baby.w = def.w * 0.55; baby.h = def.h * 0.55; baby.hp = baby.maxhp = Math.max(3, Math.round(def.hp * 0.5));
      this.fx.push(['love', a.x, a.y, 1], ['love', b.x, b.y, 1], ['love', baby.x, baby.y, 1]);
    }
  }
  /** keep each player's husky alive: respawn it next to them if they own one */
  ensurePets() {
    for (const p of this.players.values()) {
      if (!p.pet || p.dead) continue;
      let has = false; for (const m of this.mobs.values()) if (m.owner === p.id) { has = true; break; }
      if (!has) { const def = MOBS.husky, w = this.addMob('husky', p.x - p.f * 1.5, p.y + p.h - def.h, 0, DIFF.normal); w.owner = p.id; w.sit = false; this.fx.push(['tame', w.x, w.y, 1]); }
    }
  }
  stepPet(mob, dt, solid) {
    const owner = this.players.get(mob.owner) || [...this.players.values()].find((q) => q.id === mob.owner);
    if (!owner) { this.mobs.delete(mob.id); return; }
    mob.t += dt; if (mob.hurt > 0) mob.hurt -= dt; mob.atk = (mob.atk || 0) - dt;
    const def = MOBS.husky, dx = owner.x - mob.x, dist = Math.hypot(dx, owner.y - mob.y);
    if (!owner.dead && (dist > 26 || Math.abs(owner.y - mob.y) > 14)) { mob.x = owner.x - owner.f * 1.2; mob.y = owner.y + owner.h - mob.h - 0.05; mob.vx = mob.vy = 0; }
    let foe = null, fd = 9;
    for (const m of this.mobs.values()) { const md = MOBS[m.type]; if (md.animal || md.passive || m.owner) continue; if (Math.hypot(m.x - owner.x, m.y - owner.y) > 13) continue; const d = Math.hypot(m.x - mob.x, m.y - mob.y); if (d < fd) { fd = d; foe = m; } }
    let dir = 0, spd = 4.2;
    if (foe) {
      const fdx = foe.x - mob.x; dir = Math.abs(fdx) < 0.7 ? 0 : fdx < 0 ? -1 : 1; spd = 6.5;
      if (Math.abs(fdx) < 1.5 && Math.abs((foe.y + foe.h / 2) - (mob.y + mob.h / 2)) < 1.8 && mob.atk <= 0) { mob.atk = 0.75; this.hurtMob(foe, def.dmg + 2, dir || 1, owner); }
    } else if (!mob.sit && dist > 3.2) { dir = dx < 0 ? -1 : 1; spd = dist > 12 ? 8 : 4.6; }
    mob.vx += (dir * spd - mob.vx) * Math.min(1, dt * 8); if (dir) mob.f = dir;
    mob.vy = Math.min(C.MAXFALL, mob.vy + C.GRAVITY * dt); D.moveBody(mob, dt, solid);
    if (mob.hitX && mob.onGround && dir) mob.vy = -10.5;
    if (!dir) mob.vx *= 0.7;
  }

  // ---------------------------------------------------------------- boss: the Hollow Warden
  findBoss() { for (const m of this.mobs.values()) if (m.type === 'warden') return m; return null; }
  summonWarden(p) {
    if (p.dead || p.sleep) return;
    const s = p.inv[p.sel]; if (!s || s[0] !== D.I.WARDEN_SIGIL) return;
    if (this.findBoss()) return this.send(p, { t: 'toast', m: 'The Warden is already awake' });
    const px = Math.max(8, Math.min(this.W - 9, Math.floor(p.x)));
    if (p.y - this.surf[px] > 22) return this.send(p, { t: 'toast', m: 'The sigil only burns near the surface' });
    const def = MOBS.warden, side = Math.random() < 0.5 ? -1 : 1;
    let x = px + side * 15; if (x < 6 || x > this.W - 7) x = px - side * 15;
    x = Math.max(6, Math.min(this.W - 7, x)); const gy = this.surf[x], top = gy - Math.ceil(def.h);
    for (let yy = top; yy < gy; yy++) for (let xx = Math.floor(x - def.w / 2) - 1; xx <= Math.ceil(x + def.w / 2); xx++) { const id = this.get(xx, yy); if (id !== T.AIR && id !== T.BED && id !== T.BED_R && id !== T.CHEST) this.setTile(xx, yy, T.AIR); }
    if (--s[1] <= 0) p.inv[p.sel] = null; p.invDirty = true;
    const n = [...this.players.values()].filter((q) => !q.dead).length, mob = this.addMob('warden', x, gy - def.h - 0.01, 0, DIFF.normal);
    mob.maxhp = mob.hp = 700 + 300 * (n - 1); mob.ph = 1; mob.a1 = 3; mob.a2 = 4.5; mob.a3 = 8; mob.fl = 0; mob.stun = 0; mob.sh = 0; mob.step = true;
    mob.fists = [{ x, y: gy - 4, st: 0, t: 0, side: -1 }, { x, y: gy - 4, st: 0, t: 0, side: 1 }];
    this.fx.push(['roar', x, gy - 3, 0]); this.sys(`⚠ ${p.name} woke the Hollow Warden!`);
  }
  shoot(mob, target, n, spread, speed, dmg) {
    const ox = mob.x, oy = mob.y + 1.6, base = Math.atan2(target.y + 0.8 - oy, target.x - ox);
    for (let i = 0; i < n; i++) { const an = base + (i - (n - 1) / 2) * spread; this.arrows.push({ k: 1, x: ox, y: oy, vx: Math.cos(an) * speed, vy: Math.sin(an) * speed, life: 3.2, dmg, by: 'Hollow Warden' }); }
    this.fx.push(['shoot', ox, oy, 0]);
  }
  boxFree(m) { for (let ty = Math.floor(m.y); ty <= Math.floor(m.y + m.h - 1e-6); ty++) for (let tx = Math.floor(m.x - m.w / 2); tx <= Math.floor(m.x + m.w / 2 - 1e-6); tx++) if (this.solid(tx, ty)) return false; return true; }
  stepWarden(mob, dt, solid) {
    const def = MOBS.warden; mob.t += dt; if (mob.hurt > 0) mob.hurt -= dt;
    let target = null, nd = Infinity;
    for (const p of this.players.values()) { if (p.dead) continue; const d = Math.hypot(p.x - mob.x, p.y + 0.8 - (mob.y + mob.h / 2)); if (d < nd) { nd = d; target = p; } }
    if (!target || nd > 85) { mob.away = (mob.away || 0) + dt; if (mob.away > 15) { this.mobs.delete(mob.id); this.sys('The Hollow Warden sinks back into the stone.'); return; } } else mob.away = 0;
    const ratio = mob.hp / mob.maxhp, ph = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (ph !== mob.ph) { mob.ph = ph; mob.a1 = 2; mob.a2 = 3.5; mob.a3 = 6; mob.fl = 0; mob.stun = 0; mob.slam = false; this.fx.push(['roar', mob.x, mob.y + 2, ph]); this.sys(ph === 2 ? '💥 The Warden\'s fists tear loose — strike while they fly!' : '🌩 The Warden rises — shelter from the spikes, strike when it falls!'); }
    const cx = mob.x, cy = mob.y + mob.h / 2, tx = target ? target.x : cx;
    mob.f = tx < cx ? -1 : 1; if (mob.stun > 0) mob.stun -= dt;
    // fists (phase 2): shielded while both are home
    if (ph === 2) {
      mob.a1 -= dt; mob.a2 -= dt;
      for (const f of mob.fists) {
        const hx = cx + f.side * 2.7, hy = cy - 0.2 + Math.sin(mob.t * 2 + f.side) * 0.35;
        if (f.st === 0) { f.x += (hx - f.x) * Math.min(1, dt * 10); f.y += (hy - f.y) * Math.min(1, dt * 10); }
        else if (f.st === 1) { f.t += dt; const dx = f.tx - f.x, dy = f.ty - f.y, dd = Math.hypot(dx, dy) || 1, st = Math.min(dd, 16 * dt); f.x += dx / dd * st; f.y += dy / dd * st; if (dd < 0.7 || f.t > 1.1) f.st = 2; }
        else { const dx = hx - f.x, dy = hy - f.y, dd = Math.hypot(dx, dy) || 1, st = Math.min(dd, 19 * dt); f.x += dx / dd * st; f.y += dy / dd * st; if (dd < 0.8) { f.st = 0; f.hit = false; } }
        if (f.st !== 0 && !f.hit) for (const p of this.players.values()) if (!p.dead && p.invul <= 0 && Math.hypot(p.x - f.x, p.y + 0.8 - f.y) < 1.2) { f.hit = true; this.hurtPlayer(p, 24, p.x < f.x ? -1 : 1, 'Hollow Warden'); }
      }
      if (mob.a1 <= 0 && target && mob.fists.every((f) => f.st === 0)) { const f = mob.fists[(mob.fi = ((mob.fi || 0) + 1) % 2)]; f.st = 1; f.t = 0; f.tx = target.x; f.ty = target.y + 0.8; f.hit = false; mob.a1 = 2.4; this.fx.push(['shoot', f.x, f.y, 0]); }
      if (mob.a2 <= 0 && target) { mob.a2 = 7; this.shoot(mob, target, 3, 0.3, 9, 14); }
    }
    mob.sh = ph === 2 && mob.fists.every((f) => f.st === 0) ? 1 : 0;
    const floating = ph === 3 && mob.stun <= 0;
    if (!floating) {
      const dir = mob.stun > 0 || !target ? 0 : Math.abs(tx - cx) < 2 ? 0 : tx < cx ? -1 : 1, sp = def.speed * (ph === 2 ? 1.25 : 1);
      mob.vx += (dir * sp - mob.vx) * Math.min(1, dt * 3);
      mob.vy = Math.min(C.MAXFALL, mob.vy + C.GRAVITY * dt);
      D.moveBody(mob, dt, solid);
      if (mob.hitX && dir) { // trample soft blocks in front; hard walls make it jump
        const fx = Math.floor(cx + dir * (mob.w / 2 + 0.25)); let blocked = false;
        for (let yy = Math.floor(mob.y); yy < Math.floor(mob.y + mob.h); yy++) { const id = this.get(fx, yy), b = D.BLOCKS[id];
          if (b && D.SOLID[id]) { if ((b.mat === 'soft' || b.mat === 'wood' || b.mat === 'glass') && id !== T.BED && id !== T.BED_R && id !== T.CHEST) { this.setTile(fx, yy, T.AIR); this.fx.push(['smoke', fx + 0.5, yy + 0.5, 0]); } else blocked = true; } }
        if (blocked && mob.onGround) mob.vy = -12;
      }
      if (ph === 1 && mob.stun <= 0) {
        mob.a1 -= dt; mob.a2 -= dt;
        if (mob.a1 <= 0 && mob.onGround && !mob.slam) { mob.vy = -15; mob.slam = true; mob.slamT = mob.t; mob.a1 = 4.2; }
        if (mob.slam && mob.onGround && mob.t - mob.slamT > 0.3) { mob.slam = false; this.stomp(mob); }
        if (mob.a2 <= 0 && target) { mob.a2 = 6.5; this.shoot(mob, target, 3, 0.28, 10, 14); }
      }
      if (ph === 3 && mob.stun > 0 && mob.onGround && mob.landed !== mob.stunId) { mob.landed = mob.stunId; this.stomp(mob); }
    } else {
      mob.fl += dt;
      const dx = (tx + Math.sin(mob.t * 0.6) * 8) - cx, dy = ((target ? target.y : cy) - 7) - cy;
      mob.vx += (Math.max(-7, Math.min(7, dx * 1.4)) - mob.vx) * Math.min(1, dt * 2.5); mob.vy += (Math.max(-6, Math.min(6, dy * 1.4)) - mob.vy) * Math.min(1, dt * 2.5);
      mob.x += mob.vx * dt; mob.y += mob.vy * dt; mob.x = Math.max(3, Math.min(this.W - 3, mob.x)); mob.y = Math.max(2, mob.y); mob.onGround = false;
      mob.a1 -= dt; mob.a2 -= dt; mob.a3 -= dt;
      if (mob.a1 <= 0 && target) { mob.a1 = 2.2; for (let k = 0; k < 4; k++) this.arrows.push({ k: 2, x: target.x + (Math.random() - 0.5) * 15, y: target.y - 9 - Math.random() * 3, vx: 0, vy: 3, life: 3.5, dmg: 17, by: 'Hollow Warden' }); }
      if (mob.a2 <= 0 && target) { mob.a2 = 5; this.shoot(mob, target, 5, 0.3, 9, 14); }
      if (mob.a3 <= 0) { mob.a3 = 13; let n = 0; for (const m of this.mobs.values()) if ((m.type === 'boomer' || m.type === 'spider') && Math.hypot(m.x - cx, m.y - cy) < 40) n++;
        for (let k = 0; k < 2 && n < 4; k++, n++) { const t = Math.random() < 0.5 ? 'boomer' : 'spider', mm = MOBS[t]; this.addMob(t, cx + (k ? 2.4 : -2.4), Math.min(mob.y + mob.h, this.surf[Math.floor(cx)] - mm.h - 0.2), 0, DIFF.normal); }
        this.fx.push(['roar', cx, cy, 3]); }
      if (mob.fl > 11) { mob.stun = 3.2; mob.stunId = (mob.stunId || 0) + 1; mob.fl = 0; mob.vx = 0; mob.vy = 2; for (let g = 0; g < 40 && !this.boxFree(mob); g++) mob.y -= 1; this.sys('⚡ The Warden crashes down — now is your chance!'); }
    }
    mob.ground = mob.onGround;
  }
  stomp(mob) {
    const gy = mob.y + mob.h;
    for (const d of [-1, 1]) this.arrows.push({ k: 3, x: mob.x + d * (mob.w / 2 + 0.3), y: gy, vx: d * 9, vy: 0, life: 1.9, dmg: 18, by: 'Hollow Warden' });
    this.fx.push(['stomp', mob.x, gy, 0]);
  }
  hurtPlayer(p, dmg, dir, by) {
    const reduce = Math.min(0.65, D.defenseFor(p.eq) * 0.04);
    dmg = Math.max(1, Math.round(dmg * (1 - reduce)));
    p.hp -= dmg; p.invul = 0.9; p.regen = 0; p.statDirty = true;
    this.send(p, { t: 'kb', vx: dir * 7, vy: -7 });
    this.fx.push(['hurt', p.x, p.y + 0.8, p.id]);
    if (p.hp <= 0) {
      p.hp = 0; p.dead = true; p.deadT = 3.5; p.mine = null; p.sleep = null; p.line = null; p.chest = null;
      this.fx.push(['die', p.x, p.y + 0.8, p.id]);
      this.sys(`${p.name} was slain by a ${by || 'monster'}`);
      this.send(p, { t: 'dead', by: by || 'monster' });
    }
  }
  respawn(p) {
    p.dead = false; p.hp = Math.ceil(p.maxhp * 0.6); p.sleep = null; p.a = 0; const bd = p.bed && this.bedLeft(p.bed[0], p.bed[1]) === p.bed[0] ? p.bed : null; p.x = bd ? bd[0] + 1 : this.spawn.x; p.y = bd ? bd[1] + 1 - p.h - 0.05 : this.spawn.y; p.vx = p.vy = 0; p.invul = 2; p.statDirty = true; p.lastMv = Date.now();
    this.send(p, { t: 'respawn', x: p.x, y: p.y });
  }
  trySpawn(night) {
    const diff = DIFF[this.settings.difficulty] || DIFF.normal;
    if (this.mobs.size >= 70) return;
    for (const p of this.players.values()) {
      if (p.dead) continue;
      let near = 0; for (const m of this.mobs.values()) if (!MOBS[m.type].animal && Math.abs(m.x - p.x) < 60 && Math.abs(m.y - p.y) < 40) near++;
      const cap = Math.round((night ? 10 : 5) * diff.spawn); if (near >= cap) continue;
      if (Math.random() > 0.55 * diff.spawn + 0.15) continue;
      const depth = p.y - this.surf[Math.max(0, Math.min(this.W - 1, Math.floor(p.x)))];
      for (let attempt = 0; attempt < 8; attempt++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        let x = Math.floor(p.x + side * (16 + Math.random() * 16)), y;
        if (x < 3 || x >= this.W - 3) continue;
        const underground = depth > 22 && Math.random() < 0.85;
        if (!underground) { y = this.top[x] - 1; if (this.get(x, y) !== T.AIR && this.get(x, y) !== T.PLANT) continue; }
        else { y = Math.floor(p.y + (Math.random() - 0.5) * 28); if (y < 4 || y >= this.H - 5) continue; if (y < this.top[x] + 8) continue; if (this.get(x, y) !== T.AIR) continue; }
        if (Math.hypot(x - p.x, y - p.y) < 13) continue;
        const type = this.pickMobType(x, y, underground, night); if (!type) continue;
        const def = MOBS[type];
        // need standing room
        if (!def.fly) { let yy = y; let n = 0; while (!this.solid(x, yy + 1) && n++ < 12) yy++; if (!this.solid(x, yy + 1)) continue; y = yy; }
        if (this.solid(x, y) || this.solid(x, y - 1) && def.h > 1) continue;
        this.addMob(type, x + 0.5, y + 1 - def.h, Math.max(0, (y - this.surf[x]) / (this.H - this.surf[x])), diff);
        break;
      }
    }
  }
  pickMobType(x, y, underground, night) {
    const b = this.biome[x], r = Math.random();
    const d = y - this.surf[x];
    if (!this.settings.mobs) return null;
    if (this.settings.difficulty === 'peaceful') return null;
    if (!underground) {
      switch (b) {
        case 0: return night ? (r < 0.4 ? 'zombie' : r < 0.6 ? 'skeleton' : r < 0.8 ? 'boomer' : 'slime') : (r < 0.7 ? 'rabbit' : 'slime');
        case 3: return night ? (r < 0.45 ? 'zombie' : r < 0.65 ? 'skeleton' : r < 0.8 ? 'boomer' : 'slime') : (r < 0.85 ? 'rabbit' : 'slime');
        case 5: return night ? (r < 0.4 ? 'zombie' : 'frog') : (r < 0.7 ? 'frog' : 'slime');
        case 4: return night ? (r < 0.6 ? 'wolf' : 'zombie') : (r < 0.25 ? 'wolf' : 'rabbit');
        case 1: return night ? 'scorpion' : (r < 0.35 ? 'scorpion' : 'rabbit');
        default: return night ? (r < 0.7 ? 'frostling' : 'wolf') : (r < 0.35 ? 'frostling' : 'rabbit');
      }
    }
    if (r < 0.14) return 'spider'; if (r > 0.9) return d > 40 ? 'skeleton' : 'boomer';
    if (d < 100) return (b === 2 || b === 4) && r < 0.4 ? 'frostling' : r < 0.45 ? 'bat' : r < 0.75 ? (b === 5 ? 'frog' : 'slime') : b === 1 ? 'scorpion' : 'zombie';
    return r < 0.4 ? 'crawler' : r < 0.7 ? 'bat' : b === 2 ? 'frostling' : 'zombie';
  }
  addMob(type, x, y, depthF, diff) {
    const def = MOBS[type];
    const hpMul = (def.passive || def.neutral ? 1 : (1 + depthF * 1.1) * diff.hp), dmgMul = (1 + depthF * 0.7) * diff.dmg;
    const mob = { id: this.nextId++, type, name: def.name, x, y, w: def.w, h: def.h, vx: 0, vy: 0, hp: Math.round(def.hp * hpMul), maxhp: Math.round(def.hp * hpMul),
      dmg: def.neutral ? def.dmg : Math.round(def.dmg * dmgMul), f: 1, hurt: 0, t: Math.random() * 3, dir: 0, step: type !== 'slime' && !def.fly, onGround: false, kind: 'mob', grav: def.fly ? 0 : 1 };
    this.mobs.set(mob.id, mob); return mob;
  }
  stepMob(mob, dt, night, solid) {
    if (mob.type === 'warden') return this.stepWarden(mob, dt, solid);
    if (mob.owner) return this.stepPet(mob, dt, solid);
    if (mob.love > 0) mob.love -= dt; if (mob.cool > 0) mob.cool -= dt;
    if (mob.baby) { mob.age += dt; if (mob.age > 90) this.growUp(mob); }
    const def = MOBS[mob.type];
    // despawn
    let nearest = null, nd = Infinity;
    for (const p of this.players.values()) { if (p.dead) continue; const d = Math.hypot(p.x - mob.x, p.y + 0.8 - mob.y); if (d < nd) { nd = d; nearest = p; } }
    if (mob.type === 'warden') return this.stepWarden(mob, dt, solid);
    if (!nearest || nd > 70) { this.mobs.delete(mob.id); return; }
    if (mob.type === 'zombie' && !night && mob.y < this.top[Math.max(0, Math.min(this.W - 1, Math.floor(mob.x)))] + 1) {
      mob.hp -= 4 * dt; if (Math.random() < dt * 4) this.fx.push(['smoke', mob.x, mob.y, 0]);
      if (mob.hp <= 0) { this.mobs.delete(mob.id); return; }
    }
    mob.t += dt; if (mob.hurt > 0) mob.hurt -= dt;
    if (mob.angry > 0) mob.angry -= dt; if (mob.scared > 0) mob.scared -= dt;
    const aggro = def.passive ? 0 : def.neutral ? (mob.angry > 0 ? 30 : 0) : (def.fly ? 20 : 24);
    const target = !def.passive && nd < aggro ? nearest : null;
    if (def.swim) return this.stepFish(mob, dt, solid);
    const cx = mob.x, cy = mob.y + mob.h / 2;
    if (def.fly) {
      if (def.passive) { // songbirds: flutter around near the treetops, flee from players
        const sy = this.surf[Math.max(0, Math.min(this.W - 1, Math.floor(cx)))];
        if (mob.t > (mob.nextT || 0)) { mob.nextT = mob.t + 1 + Math.random() * 2.5; mob.dir = Math.random() * 6.28; }
        let ax = Math.cos(mob.dir) * 0.6, ay = Math.sin(mob.dir) * 0.5 + (cy > sy - 3 ? -0.5 : 0) + (cy < sy - 12 ? 0.6 : 0);
        if (nd < 5 || mob.scared > 0) { ax = cx < nearest.x ? -1.4 : 1.4; ay = -0.5; }
        const spd = def.speed * (mob.hurt > 0 ? 0.2 : 1);
        mob.vx += (ax * spd - mob.vx) * Math.min(1, dt * 3.5); mob.vy += (ay * spd - mob.vy) * Math.min(1, dt * 3.5);
        D.moveBody(mob, dt, solid); if (mob.hitX) mob.dir = Math.PI - mob.dir; if (mob.hitY) mob.dir = -mob.dir; if (mob.vx) mob.f = mob.vx > 0 ? 1 : -1;
        if (night && nd > 25 && Math.random() < dt * 0.05) this.mobs.delete(mob.id); return;
      }
      let tx = cx, ty = cy;
      if (target) { tx = target.x; ty = target.y + 0.8; }
      else if (mob.t % 3 < dt) { mob.dir = Math.random() * 6.28; }
      let ax, ay;
      if (target) { const dx = tx - cx, dy = ty - cy, l = Math.hypot(dx, dy) || 1; ax = dx / l; ay = dy / l; if (mob.type === 'bat') { ax += Math.sin(mob.t * 7) * 0.7; ay += Math.cos(mob.t * 6) * 0.7; } else { ay += Math.sin(mob.t * 2.5) * 0.4; } }
      else { ax = Math.cos(mob.dir) * 0.4; ay = Math.sin(mob.dir) * 0.4; }
      const sp = def.speed * (mob.hurt > 0 ? 0.2 : 1);
      mob.vx += (ax * sp - mob.vx) * Math.min(1, dt * 3.5); mob.vy += (ay * sp - mob.vy) * Math.min(1, dt * 3.5);
      D.moveBody(mob, dt, solid);
      if (mob.hitX) mob.dir = Math.PI - mob.dir; if (mob.hitY) mob.dir = -mob.dir;
      if (mob.vx) mob.f = mob.vx > 0 ? 1 : -1;
      return;
    }
    // ground mobs
    const inWater = this.get(Math.floor(cx), Math.floor(cy)) === T.WATER;
    mob.vy = Math.min(inWater ? 2.5 : C.MAXFALL, mob.vy + C.GRAVITY * dt);
    if (inWater && target && target.y < mob.y) mob.vy = -3;
    if (mob.hurt <= 0) {
      let dir = 0;
      if (def.passive) {
        const fr = def.flee || 6; let flee = null; for (const p of this.players.values()) if (!p.dead && Math.abs(p.x - cx) < fr && Math.abs(p.y - mob.y) < 4) flee = p;
        if (!flee && mob.scared > 0) flee = nearest;
        if (flee) dir = cx < flee.x ? -1 : 1;
        else { if (mob.t > (mob.nextT || 0)) { mob.nextT = mob.t + 1.5 + Math.random() * 4; mob.dir = Math.random() < 0.45 ? 0 : (Math.random() < 0.5 ? -1 : 1); } dir = mob.dir; }
        if (def.hop) {
          if (mob.onGround && (dir !== 0) && (mob.t > (mob.hopT || 0))) { mob.vy = -7.5; mob.hopT = mob.t + 0.5 + Math.random() * 0.5; }
          mob.vx = dir * (flee ? def.speed * 1.5 : def.speed * 0.6) * (mob.onGround || mob.vy < 0 ? 1 : 0.7);
        } else { // walkers: steady stride, step up single blocks, hop only to clear a wall
          const want = dir * (flee ? def.speed * 1.7 : def.speed * 0.7);
          mob.vx += (want - mob.vx) * Math.min(1, dt * 7);
          if (mob.hitX && mob.onGround && dir && mob.t > (mob.hopT || 0)) { mob.vy = -9.5; mob.hopT = mob.t + 0.8; }
          if (def.animal && !flee && mob.onGround && dir) { // don't wander into water or off cliffs
            const ax = Math.floor(cx + dir * (def.w / 2 + 0.6)); let gy = Math.floor(mob.y + mob.h) , n = 0; while (!this.solid(ax, gy) && n++ < 3) gy++;
            if (!this.solid(ax, gy) || this.get(ax, gy - 1) === T.WATER) { mob.dir = -dir; mob.vx = 0; }
          }
        }
        if (!dir) mob.vx *= 0.6;
      } else if (mob.type === 'skeleton') { // keeps its distance and fires arrows
        if (target) { const dx = target.x - cx, ad = Math.abs(dx); dir = ad < 5 ? (dx < 0 ? 1 : -1) : ad > 11 ? (dx < 0 ? -1 : 1) : 0; mob.f = dx < 0 ? -1 : 1; }
        else { if (mob.t > (mob.nextT || 0)) { mob.nextT = mob.t + 2 + Math.random() * 3; mob.dir = Math.random() < 0.35 ? 0 : (Math.random() < 0.5 ? -1 : 1); } dir = mob.dir * 0.4; }
        mob.vx += (dir * def.speed - mob.vx) * Math.min(1, dt * 8);
        if (mob.hitX && mob.onGround && dir) mob.vy = -10.5;
        mob.shoot = (mob.shoot || 0) - dt;
        if (target && mob.shoot <= 0 && Math.abs(target.x - cx) < 15 && Math.abs(target.y + 0.8 - cy) < 7 && this.clearLine(cx, mob.y + 0.5, target.x, target.y + 0.8)) {
          mob.shoot = 2 + Math.random() * 0.8; const tx = target.x - cx, ty = target.y + 0.8 - (mob.y + 0.5), tt = Math.max(0.35, Math.hypot(tx, ty) / 16);
          this.arrows.push({ x: cx + mob.f * 0.4, y: mob.y + 0.5, vx: tx / tt, vy: ty / tt - 0.5 * 14 * tt, life: 3, dmg: mob.dmg + 8 }); this.fx.push(['shoot', cx, mob.y + 0.5, 0]);
        }
      } else if (mob.type === 'boomer') { // creeps up, swells, then goes off
        if (target) dir = Math.abs(target.x - cx) < 0.3 ? 0 : target.x < cx ? -1 : 1; else { if (mob.t > (mob.nextT || 0)) { mob.nextT = mob.t + 2 + Math.random() * 3; mob.dir = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? -1 : 1); } dir = mob.dir * 0.4; }
        const close = nd < 2.6;
        if (close) { mob.fuse = (mob.fuse || 0) + dt; dir *= 0.25; mob.arm = 1; } else { mob.fuse = Math.max(0, (mob.fuse || 0) - dt * 0.7); mob.arm = 0; }
        mob.vx += (dir * def.speed - mob.vx) * Math.min(1, dt * 8);
        if (mob.hitX && mob.onGround && dir) mob.vy = -10.5;
        if (mob.fuse > 1.5) { this.explode(mob.x, mob.y + mob.h / 2, 3.2, 38, mob); this.mobs.delete(mob.id); return; }
      } else if (mob.type === 'slime' || mob.type === 'frog') {
        if (target) dir = target.x < cx ? -1 : 1; else { if (mob.t > (mob.nextT || 0)) { mob.nextT = mob.t + 1.5 + Math.random() * 2; mob.dir = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1); } dir = mob.dir; }
        if (mob.onGround) {
          mob.vx *= 0.7;
          if (mob.t > (mob.hopT || 0) && dir) { mob.vy = -9.5 - (target && target.y < mob.y - 2 ? 3 : 0); mob.vx = dir * def.speed * 1.7; mob.hopT = mob.t + 0.9 + Math.random() * 0.7; }
        }
      } else {
        if (target) dir = Math.abs(target.x - cx) < 0.3 ? 0 : target.x < cx ? -1 : 1;
        else { if (mob.t > (mob.nextT || 0)) { mob.nextT = mob.t + 2 + Math.random() * 3; mob.dir = Math.random() < 0.35 ? 0 : (Math.random() < 0.5 ? -1 : 1); } dir = mob.dir * 0.4; }
        mob.vx += (dir * def.speed - mob.vx) * Math.min(1, dt * 8);
        if (mob.hitX && mob.onGround && dir) mob.vy = -10.5;
        if (target && mob.onGround && target.y + 1 < mob.y - 3 && Math.abs(target.x - cx) < 2 && mob.t > (mob.hopT || 0)) { mob.vy = -13; mob.hopT = mob.t + 1.2; }
      }
      if (dir) mob.f = dir > 0 ? 1 : -1;
    } else mob.vx *= 1 - Math.min(1, dt * 3);
    D.moveBody(mob, dt, solid);
    mob.ground = mob.onGround;
  }

  // ---------------------------------------------------------------- animals
  animalFor(b, night) {
    const r = Math.random();
    switch (b) {
      case 0: return night ? (r < 0.3 ? 'fox' : r < 0.5 ? 'deer' : r < 0.72 ? 'husky' : 'bear') : (r < 0.28 ? 'deer' : r < 0.45 ? 'pig' : r < 0.6 ? 'fox' : r < 0.7 ? 'bear' : 'bird');
      case 3: return night ? (r < 0.5 ? 'cow' : 'sheep') : (r < 0.28 ? 'cow' : r < 0.5 ? 'sheep' : r < 0.66 ? 'pig' : r < 0.82 ? 'chicken' : r < 0.92 ? 'deer' : 'bird');
      case 1: return night ? 'camel' : (r < 0.7 ? 'camel' : 'fox');
      case 2: return r < 0.45 ? 'penguin' : r < 0.65 ? 'husky' : r < 0.85 ? 'fox' : 'bear';
      case 4: return r < 0.3 ? 'sheep' : r < 0.55 ? 'deer' : r < 0.75 ? 'bear' : night ? 'sheep' : 'bird';
      default: return r < 0.55 ? 'turtle' : r < 0.8 ? 'chicken' : night ? 'turtle' : 'bird';
    }
  }
  trySpawnAnimals(night) {
    if (this.settings.animals === false) return;
    for (const p of this.players.values()) {
      if (p.dead) continue;
      let land = 0, fish = 0;
      for (const m of this.mobs.values()) { if (Math.abs(m.x - p.x) > 60 || Math.abs(m.y - p.y) > 40) continue; const dd = MOBS[m.type]; if (dd.swim) fish++; else if (dd.animal) land++; }
      // surface animals (only when the player is near the surface)
      const depth = p.y - this.surf[Math.max(0, Math.min(this.W - 1, Math.floor(p.x)))];
      if (land < (night ? 3 : 7) && depth < 18 && Math.random() < 0.6) {
        for (let attempt = 0; attempt < 6; attempt++) {
          const x = Math.floor(p.x + (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 30)); if (x < 3 || x >= this.W - 3) continue;
          const type = this.animalFor(this.biome[x], night), def = MOBS[type], y = this.top[x] - 1;
          const gv = this.get(x, y + 1); if (!(gv === T.GRASS || gv === T.SAND || gv === T.SNOW || gv === T.DIRT || gv === T.MUD)) continue;
          if (this.get(x, y) !== T.AIR && !D.DECOR[this.get(x, y)]) continue; if (def.h > 1 && this.solid(x, y - 1)) continue;
          if (Math.hypot(x - p.x, y - p.y) < 12) continue;
          this.addMob(type, x + 0.5, def.fly ? y - 4 : y + 1 - def.h, 0, DIFF.normal); break;
        }
      }
      // fish in nearby water
      if (fish < 6 && Math.random() < 0.5) {
        for (let attempt = 0; attempt < 6; attempt++) {
          const x = Math.floor(p.x + (Math.random() - 0.5) * 70); if (x < 4 || x >= this.W - 4) continue;
          const y0 = Math.max(4, Math.floor(this.surf[x] - 3)), ys = []; for (let y = y0; y < Math.min(this.H - 6, y0 + 45); y++) if (this.get(x, y) === T.WATER && this.get(x, y + 1) === T.WATER && this.get(x - 1, y) === T.WATER && this.get(x + 1, y) === T.WATER) ys.push(y);
          if (!ys.length) continue; const y = ys[Math.floor(Math.random() * ys.length)];
          if (Math.hypot(x - p.x, y - p.y) < 5) continue;
          this.addMob('fish', x + 0.5, y + 0.3, 0, DIFF.normal); break;
        }
      }
    }
  }
  stepFish(mob, dt, solid) {
    const cx = mob.x, cy = mob.y + mob.h / 2, here = this.get(Math.floor(cx), Math.floor(cy)) === T.WATER;
    mob.t += dt; if (mob.hurt > 0) mob.hurt -= dt;
    if (!here) { // out of water: flop around and slowly suffocate
      mob.vy = Math.min(C.MAXFALL, mob.vy + C.GRAVITY * dt); mob.vx *= 0.9; D.moveBody(mob, dt, solid);
      mob.hp -= 0.8 * dt; if (mob.hp <= 0) this.mobs.delete(mob.id); return;
    }
    if (mob.t > (mob.nextT || 0)) { mob.nextT = mob.t + 1 + Math.random() * 3; mob.dir = Math.random() * 6.28; mob.spd = Math.random() < 0.3 ? 0 : 1; }
    let ax = Math.cos(mob.dir) * (mob.spd ?? 1), ay = Math.sin(mob.dir) * 0.35 * (mob.spd ?? 1);
    // scatter from nearby players that are splashing around (fast) – a calm fish just wanders
    for (const p of this.players.values()) if (!p.dead && Math.abs(p.x - cx) < 3 && Math.abs(p.y + 0.8 - cy) < 3 && (Math.abs(p.vx) > 5)) { ax = cx < p.x ? -1.6 : 1.6; break; }
    const sp = MOBS[mob.type].speed * (mob.hurt > 0 ? 0.2 : 1);
    mob.vx += (ax * sp - mob.vx) * Math.min(1, dt * 3); mob.vy += (ay * sp - mob.vy) * Math.min(1, dt * 3);
    // stay in the water
    const nx = Math.floor(cx + mob.vx * 0.5 + Math.sign(mob.vx) * 0.5), ny = Math.floor(cy + mob.vy * 0.5);
    if (this.get(nx, Math.floor(cy)) !== T.WATER) { mob.vx = -mob.vx * 0.6; mob.dir = Math.PI - mob.dir; }
    if (this.get(Math.floor(cx), ny) !== T.WATER || this.get(Math.floor(cx), Math.floor(cy - 0.45)) !== T.WATER && mob.vy < 0) { mob.vy = Math.abs(mob.vy) * (this.get(Math.floor(cx), ny) !== T.WATER && mob.vy > 0 ? -0.6 : 0.4); mob.dir = -mob.dir; }
    D.moveBody(mob, dt, solid);
    if (mob.hitX) { mob.dir = Math.PI - mob.dir; } if (mob.hitY) mob.dir = -mob.dir;
    if (Math.abs(mob.vx) > 0.1) mob.f = mob.vx > 0 ? 1 : -1;
  }

  // ---------------------------------------------------------------- fishing
  /** cast / reel with a fishing rod. m = { a: 'cast', x, y } | { a: 'reel' } */
  onFish(p, m) {
    if (p.dead || p.sleep) return;
    const s = p.inv[p.sel], it = s && ITEMS[s[0]]; if (!it || it.kind !== 'rod') { p.line = null; return; }
    if (m.a === 'reel' || p.line) {
      if (!p.line) return; const ln = p.line;
      if (ln.st === 1) this.catchFish(p, s);
      else this.send(p, { t: 'toast', m: 'You reeled in too early' });
      p.line = null; return;
    }
    const x = m.x | 0; let y = m.y | 0;
    if (!(x > 1 && x < this.W - 1 && y > 1 && y < this.H - 2) || this.get(x, y) !== T.WATER) return this.send(p, { t: 'toast', m: 'Aim at water to cast' });
    if (Math.hypot(x + 0.5 - p.x, y + 0.5 - (p.y + 0.8)) > 9.5) return this.send(p, { t: 'toast', m: 'Too far — step closer to the water' });
    while (this.get(x, y - 1) === T.WATER) y--;
    let lure = false; for (const q of p.inv) if (q && q[0] === I.LURE) { lure = true; if (--q[1] <= 0) p.inv[p.inv.indexOf(q)] = null; p.invDirty = true; break; }
    p.line = { x: x + 0.5, y: y + 0.38, tx: x, ty: y, st: 0, t: 0, bite: lure ? 1.5 + Math.random() * 3 : 3 + Math.random() * 6, lure, cast: Date.now() };
    this.fx.push(['cast', p.line.x, p.line.y, p.id]);
  }
  catchFish(p, s) {
    const ln = p.line, cave = ln.ty > this.surf[Math.max(0, Math.min(this.W - 1, ln.tx))] + 14;
    const [id, n] = D.rollCatch(this.biome[Math.max(0, Math.min(this.W - 1, ln.tx))], cave, ln.lure, Math.random);
    const left = addToInv(p.inv, id, n, 0); if (left > 0) this.spawnDrop(id, left, p.x, p.y);
    p.invDirty = true; this.state.fished = (this.state.fished || 0) + 1; this.dirty = true;
    this.fx.push(['catch', ln.x, ln.y, id]);
    this.send(p, { t: 'toast', m: `Caught ${n > 1 ? n + '× ' : ''}${ITEMS[id].name}!` });
    s[2]--; if (s[2] <= 0) { p.inv[p.sel] = null; this.send(p, { t: 'toolBreak', item: s[0] }); }
  }
  stepFishing(dt) {
    for (const p of this.players.values()) {
      const ln = p.line; if (!ln) continue;
      const s = p.inv[p.sel], it = s && ITEMS[s[0]];
      if (p.dead || p.sleep || !it || it.kind !== 'rod' || this.get(ln.tx, ln.ty) !== T.WATER || Math.hypot(ln.x - p.x, ln.y - p.y) > 15) { p.line = null; continue; }
      ln.t += dt;
      if (ln.st === 0 && ln.t >= ln.bite) { ln.st = 1; ln.t = 0; this.fx.push(['bite', ln.x, ln.y, p.id]); }
      else if (ln.st === 1 && ln.t > 1.5) { p.line = null; this.send(p, { t: 'toast', m: 'It got away…' }); }
    }
  }

  /** Build one world snapshot, then cut it down per player: only what is within the view window is sent (saves a lot of bandwidth). */
  snapshotAll() {
    const p = [];
    for (const q of this.players.values()) {
      const s = q.inv[q.sel];
      p.push([q.id, r2(q.x), r2(q.y), r2(q.vx), r2(q.vy), q.f, q.dead ? 9 : q.a, s ? s[0] : 0, Math.ceil(q.hp), q.maxhp, q.eq.head ? q.eq.head[0] : 0, q.eq.body ? q.eq.body[0] : 0]);
    }
    const m = [], d = [];
    for (const o of this.mobs.values()) m.push([o.id, o.type, r2(o.x), r2(o.y), o.f, o.hp, o.maxhp, o.hurt > 0 ? 1 : 0, o.fuse > 0 ? r2(o.fuse) : 0, (o.baby ? 1 : 0) | (o.owner ? 2 : 0) | (o.sit ? 4 : 0) | (o.love > 0 ? 8 : 0)]);
    for (const o of this.drops.values()) d.push([o.id, o.item, o.n, r2(o.x), r2(o.y)]);
    const fl = []; for (const q of this.players.values()) if (q.line) fl.push([q.id, r2(q.line.x), r2(q.line.y), q.line.st]);
    const b = this.findBoss();
    return { p, m, d, fl, ar: this.arrows.map((a) => [r2(a.x), r2(a.y), r2(a.vx), r2(a.vy), a.k || 0]),
      bs: b ? { id: b.id, ph: b.ph, sh: b.sh, st: b.stun > 0 ? 1 : 0, f: b.fists.map((f) => [r2(f.x), r2(f.y), f.st]) } : null,
      rain: Math.round(this.weather.rain * 100) / 100, tm: Math.round(this.state.time * 10000) / 10000 };
  }
  snapshotFor(a, me) {
    const VX = 58, VY = 40, cx = me.x, cy = me.y, near = (x, y) => Math.abs(x - cx) < VX && Math.abs(y - cy) < VY;
    return { t: 'snap', fl: a.fl.filter((l) => near(l[1], l[2])), ar: a.ar.filter((r) => near(r[0], r[1])), bs: a.bs, rain: a.rain, tm: a.tm, p: a.p,
      m: a.m.filter((o) => near(o[2], o[3]) || (a.bs && o[0] === a.bs.id)), d: a.d.filter((o) => near(o[3], o[4])), fx: this.fx.filter((f) => Math.abs(f[1] - cx) < VX + 30 && Math.abs(f[2] - cy) < VY + 30) };
  }
  snapshot() { const a = this.snapshotAll(); return this.snapshotFor(a, { x: this.spawn.x, y: this.spawn.y }); }
  flush() {
    if (this.pending.length) { this.broadcast({ t: 'tiles', c: this.pending }); this.pending = []; }
    if (this.players.size) { const a = this.snapshotAll(); for (const p of this.players.values()) this.send(p, this.snapshotFor(a, p)); }
    this.fx = [];
    for (const p of this.players.values()) {
      if (p.invDirty) { p.invDirty = false; this.send(p, { t: 'inv', inv: p.inv, eq: p.eq }); }
      if (p.statDirty) { p.statDirty = false; this.send(p, { t: 'stat', hp: Math.ceil(p.hp), maxhp: p.maxhp, def: D.defenseFor(p.eq) }); }
    }
    if (this.tick % 100 === 0 && this.players.size) this.broadcast({ t: 'prog', prog: this.prog() });
  }
  extra() {
    const W = this.W, b = Buffer.alloc(W * 3); b.set(this.biome, 0); for (let x = 0; x < W; x++) b.writeUInt16LE(this.surf[x], W + x * 2);
    return zlib.deflateSync(b);
  }
  save() {
    const players = [...this.players.values()].map((p) => this.playerData(p));
    for (const [pid, data] of Object.entries(this.saved)) if (!players.some((x) => x.pid === pid)) players.push({ pid, name: data.name || 'Player', data });
    this.db.putWorld({ code: this.code, name: this.name, seed: this.seed, w: this.W, h: this.H, host: this.host, settings: this.settings,
      state: this.state, tiles: this.tiles, chests: this.chests, created: this.created, players, extra: this.extra() });
    this.dirty = false; this.lastSave = Date.now();
  }
}
module.exports = { World, DIFF };
