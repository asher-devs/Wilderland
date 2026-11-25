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
    this.weather = { rain: 0, t: 60 + Math.random() * 120, target: 0 }; this.nextId = 1; this.fx = []; this.pending = []; this.dirty = !rec.tiles; this.tick = 0; this.spawnT = 0;
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
      p.bed = sv.bed || null; p.inv = sv.inv || p.inv; while (p.inv.length < C.INV) p.inv.push(null); p.eq = sv.eq || p.eq; p.hp = Math.max(1, sv.hp || p.hp);
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
  playerData(p) { return { pid: p.pid, name: p.name, data: { look: p.look, bed: p.bed || null, inv: p.inv, eq: p.eq, hp: p.dead ? p.maxhp : p.hp, x: r2(p.x), y: r2(p.y) } }; }
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
    if (id === T.BED || id === T.BED_R) { // beds are two tiles: remove the other half too, drop one bed
      const ox = id === T.BED ? x + 1 : x - 1; if (this.get(ox, y) === (id === T.BED ? T.BED_R : T.BED)) this.setTile(ox, y, T.AIR);
      if (id === T.BED_R) this.spawnDrop(T.BED, 1, x + 0.5, y + 0.5);
      for (const q of this.players.values()) if (q.sleep && (q.sleep.x === x || q.sleep.x === ox) && q.sleep.y === y) this.wake(q);
    }
    if (b.drop >= 0 && Math.random() < b.dropP) this.spawnDrop(b.drop, 1, x + 0.5, y + 0.5);
    if (D.LEAF[id] && id !== T.PINE && Math.random() < 0.07) this.spawnDrop(I.APPLE, 1, x + 0.5, y + 0.5);
    if (D.LOGS[id]) this.fellTree(p, x, y, id);
    // plants above lose their support
    const up = this.get(x, y - 1);
    if (D.DECOR[up] && up !== T.ROCK && up !== T.MUSHROOM) { this.setTile(x, y - 1, T.AIR); if (BLOCKS[up].drop >= 0 && Math.random() < BLOCKS[up].dropP) this.spawnDrop(BLOCKS[up].drop, 1, x + 0.5, y - 0.5); }
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
    if (!(cur === T.AIR || cur === T.WATER || D.DECOR[cur] && cur !== T.ROCK || D.LEAF[cur])) return;
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
    dmg = Math.max(1, Math.round(dmg));
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
    // contact damage
    for (const mob of this.mobs.values()) {
      if (!mob.dmg) continue;
      for (const p of this.players.values()) {
        if (p.dead || p.invul > 0) continue;
        if (Math.abs(mob.x - p.x) < (mob.w + p.w) / 2 && mob.y < p.y + p.h && mob.y + mob.h > p.y) this.hurtPlayer(p, mob.dmg, mob.x < p.x ? 1 : -1, mob.name);
      }
    }
  }
  hurtPlayer(p, dmg, dir, by) {
    const reduce = Math.min(0.65, D.defenseFor(p.eq) * 0.04);
    dmg = Math.max(1, Math.round(dmg * (1 - reduce)));
    p.hp -= dmg; p.invul = 0.9; p.regen = 0; p.statDirty = true;
    this.send(p, { t: 'kb', vx: dir * 7, vy: -7 });
    this.fx.push(['hurt', p.x, p.y + 0.8, p.id]);
    if (p.hp <= 0) {
      p.hp = 0; p.dead = true; p.deadT = 3.5; p.mine = null; p.sleep = null; p.chest = null;
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
    if (this.mobs.size >= 44) return;
    for (const p of this.players.values()) {
      if (p.dead) continue;
      let near = 0; for (const m of this.mobs.values()) if (Math.abs(m.x - p.x) < 60 && Math.abs(m.y - p.y) < 40) near++;
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
        case 0: return night ? (r < 0.65 ? 'zombie' : 'slime') : (r < 0.7 ? 'rabbit' : 'slime');
        case 3: return night ? (r < 0.7 ? 'zombie' : 'slime') : (r < 0.85 ? 'rabbit' : 'slime');
        case 5: return night ? (r < 0.4 ? 'zombie' : 'frog') : (r < 0.7 ? 'frog' : 'slime');
        case 4: return night ? (r < 0.6 ? 'wolf' : 'zombie') : (r < 0.25 ? 'wolf' : 'rabbit');
        case 1: return night ? 'scorpion' : (r < 0.35 ? 'scorpion' : 'rabbit');
        default: return night ? (r < 0.7 ? 'frostling' : 'wolf') : (r < 0.35 ? 'frostling' : 'rabbit');
      }
    }
    if (d < 100) return (b === 2 || b === 4) && r < 0.4 ? 'frostling' : r < 0.45 ? 'bat' : r < 0.75 ? (b === 5 ? 'frog' : 'slime') : b === 1 ? 'scorpion' : 'zombie';
    return r < 0.4 ? 'crawler' : r < 0.7 ? 'bat' : b === 2 ? 'frostling' : 'zombie';
  }
  addMob(type, x, y, depthF, diff) {
    const def = MOBS[type];
    const hpMul = (def.passive ? 1 : (1 + depthF * 1.1) * diff.hp), dmgMul = (1 + depthF * 0.7) * diff.dmg;
    const mob = { id: this.nextId++, type, name: def.name, x, y, w: def.w, h: def.h, vx: 0, vy: 0, hp: Math.round(def.hp * hpMul), maxhp: Math.round(def.hp * hpMul),
      dmg: Math.round(def.dmg * dmgMul), f: 1, hurt: 0, t: Math.random() * 3, dir: 0, step: type !== 'slime' && !def.fly, onGround: false, kind: 'mob', grav: def.fly ? 0 : 1 };
    this.mobs.set(mob.id, mob); return mob;
  }
  stepMob(mob, dt, night, solid) {
    const def = MOBS[mob.type];
    // despawn
    let nearest = null, nd = Infinity;
    for (const p of this.players.values()) { if (p.dead) continue; const d = Math.hypot(p.x - mob.x, p.y + 0.8 - mob.y); if (d < nd) { nd = d; nearest = p; } }
    if (!nearest || nd > 70) { this.mobs.delete(mob.id); return; }
    if (mob.type === 'zombie' && !night && mob.y < this.top[Math.max(0, Math.min(this.W - 1, Math.floor(mob.x)))] + 1) {
      mob.hp -= 4 * dt; if (Math.random() < dt * 4) this.fx.push(['smoke', mob.x, mob.y, 0]);
      if (mob.hp <= 0) { this.mobs.delete(mob.id); return; }
    }
    mob.t += dt; if (mob.hurt > 0) mob.hurt -= dt;
    const aggro = def.passive ? 0 : (def.fly ? 20 : 24);
    const target = !def.passive && nd < aggro ? nearest : null;
    const cx = mob.x, cy = mob.y + mob.h / 2;
    if (def.fly) {
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
        let flee = null; for (const p of this.players.values()) if (!p.dead && Math.abs(p.x - cx) < 6 && Math.abs(p.y - mob.y) < 4) flee = p;
        if (flee) dir = cx < flee.x ? -1 : 1;
        else { if (mob.t > (mob.nextT || 0)) { mob.nextT = mob.t + 1 + Math.random() * 3; mob.dir = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? -1 : 1); } dir = mob.dir; }
        if (mob.onGround && (dir !== 0) && (mob.t > (mob.hopT || 0))) { mob.vy = -7.5; mob.hopT = mob.t + 0.5 + Math.random() * 0.5; }
        mob.vx = dir * (flee ? def.speed * 1.5 : def.speed * 0.6) * (mob.onGround || mob.vy < 0 ? 1 : 0.7);
        if (!dir) mob.vx = 0;
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

  snapshot() {
    const p = [], m = [], d = [];
    for (const q of this.players.values()) {
      const s = q.inv[q.sel];
      p.push([q.id, r2(q.x), r2(q.y), r2(q.vx), r2(q.vy), q.f, q.dead ? 9 : q.a, s ? s[0] : 0, Math.ceil(q.hp), q.maxhp, q.eq.head ? q.eq.head[0] : 0, q.eq.body ? q.eq.body[0] : 0]);
    }
    for (const o of this.mobs.values()) m.push([o.id, o.type, r2(o.x), r2(o.y), o.f, o.hp, o.maxhp, o.hurt > 0 ? 1 : 0]);
    for (const o of this.drops.values()) d.push([o.id, o.item, o.n, r2(o.x), r2(o.y)]);
    return { t: 'snap', rain: Math.round(this.weather.rain * 100) / 100, tm: Math.round(this.state.time * 10000) / 10000, p, m, d, fx: this.fx };
  }
  flush() {
    if (this.pending.length) { this.broadcast({ t: 'tiles', c: this.pending }); this.pending = []; }
    if (this.players.size) this.broadcast(this.snapshot());
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
