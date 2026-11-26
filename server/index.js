'use strict';
// WILDERLAND server: static file host + WebSocket game server (authoritative) + SQLite persistence.
const zlib = require('zlib');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ws = require('./ws.js');
const { openDb } = require('./db.js');
const { World } = require('./game.js');
const D = require('../public/js/defs.js');

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const PUBLIC = path.join(__dirname, '..', 'public');
const db = openDb(DATA_DIR);
const worlds = new Map(); // code -> World
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function getWorld(code) {
  code = String(code || '').toUpperCase().trim();
  let w = worlds.get(code);
  if (!w) { w = World.load(db, code); if (w) worlds.set(code, w); }
  return w;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (url.pathname === '/api/health') return res.end(JSON.stringify({ ok: true, worlds: worlds.size, players: [...worlds.values()].reduce((n, w) => n + w.players.size, 0) }));
    const m = url.pathname.match(/^\/api\/world\/([A-Za-z0-9]{3,8})$/);
    if (m) {
      const code = m[1].toUpperCase(), live = worlds.get(code), info = db.info(code);
      if (!info && !live) { res.writeHead(404); return res.end('{"error":"not found"}'); }
      const i = info || {};
      return res.end(JSON.stringify({ code, name: live ? live.name : i.name, online: live ? live.players.size : 0, max: D.C.MAX_PLAYERS,
        w: live ? live.W : i.w, h: live ? live.H : i.h, updated: i.updated || Date.now(), players: live ? live.plist().map((p) => p.name) : [] }));
    }
    const ex = url.pathname.match(/^\/api\/export\/([A-Za-z0-9]{3,8})$/);
    if (ex && req.method === 'GET') {
      const code = ex[1].toUpperCase(), pid = String(url.searchParams.get('pid') || '');
      try {
        const live = worlds.get(code); if (live) live.save();
        const rec = db.getWorld(code); if (!rec) { res.writeHead(404); return res.end('{"error":"not found"}'); }
        const pl = db.getPlayers(code);
        if (pid !== rec.host && !pl[pid]) { res.writeHead(403); return res.end('{"error":"not a member of this world"}'); }
        const players = Object.entries(pl).map(([k, v]) => { const { name, ...data } = v; return { pid: k, name, data }; });
        return res.end(JSON.stringify({ v: 1, code, name: rec.name, seed: rec.seed, w: rec.w, h: rec.h, host: rec.host, settings: rec.settings, state: rec.state, chests: rec.chests,
          created: rec.created, saved: Date.now(), tiles: zlib.deflateSync(rec.tiles, { level: 6 }).toString('base64'), extra: rec.extra ? zlib.deflateSync(rec.extra).toString('base64') : null, players }));
      } catch (e) { console.error('export error', e); res.writeHead(500); return res.end('{"error":"export failed"}'); }
    }
    if (url.pathname === '/api/import' && req.method === 'POST') {
      const chunks = []; let n = 0;
      req.on('data', (c) => { n += c.length; if (n > 48e6) { res.writeHead(413); res.end('{"error":"too big"}'); req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        try {
          const b = JSON.parse(Buffer.concat(chunks).toString()), pid = String(b.pid || '');
          const code = String(b.code || '').toUpperCase();
          if (b.v !== 1 || !/^[A-Z0-9]{3,8}$/.test(code) || !b.w || !b.h) { res.writeHead(400); return res.end('{"error":"bad backup file"}'); }
          if (!(pid === b.host || (b.players || []).some((p) => p.pid === pid))) { res.writeHead(403); return res.end('{"error":"this backup is not yours"}'); }
          if (db.exists(code) || worlds.has(code)) { res.writeHead(409); return res.end('{"error":"world already exists on the server"}'); }
          const tiles = zlib.inflateSync(Buffer.from(b.tiles, 'base64'));
          if (tiles.length !== b.w * b.h) { res.writeHead(400); return res.end('{"error":"corrupt backup"}'); }
          const extra = b.extra ? Buffer.from(b.extra, 'base64') : null;
          db.putWorld({ code, name: String(b.name || 'World').slice(0, 24), seed: b.seed | 0, w: b.w, h: b.h, host: b.host, settings: b.settings || {}, state: b.state || {}, tiles, chests: b.chests || {}, created: b.created || Date.now(), extra,
            players: (b.players || []).map((p) => ({ pid: String(p.pid), name: String(p.name || 'Player'), data: p.data || {} })) });
          res.end(JSON.stringify({ ok: true, code }));
        } catch (e) { console.error('import error', e); res.writeHead(400); res.end('{"error":"could not restore"}'); }
      });
      return;
    }
    res.writeHead(404); return res.end('{}');
  }
  let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

ws.attach(server, (sock) => {
  let world = null, player = null;
  const timer = setTimeout(() => { if (!player) sock.close(1008); }, 10000);
  sock.isAlive = true;
  sock.on('message', (data, isText) => {
    if (!isText) return;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (player) { try { world.handle(player, m); } catch (e) { console.error('handler error', e); } return; }
    if (m.t !== 'join' && m.t !== 'create') return;
    const pid = String(m.pid || '').replace(/[^\w-]/g, '').slice(0, 40); if (pid.length < 8) { sock.send(JSON.stringify({ t: 'err', m: 'Bad player id' })); return; }
    try {
      if (m.t === 'create') {
        if (worlds.size >= 40) { sock.send(JSON.stringify({ t: 'err', m: 'Server is busy, try again later' })); return; }
        world = World.create(db, { pid, name: m.wname, size: m.size, seed: m.seed, difficulty: m.difficulty, mobs: m.mobs });
        worlds.set(world.code, world); world.save();
      } else {
        world = getWorld(m.code);
        if (!world) { sock.send(JSON.stringify({ t: 'err', m: 'No world found with that room code' })); return; }
        const returning = [...world.players.values()].some((p) => p.pid === pid);
        if (world.players.size >= D.C.MAX_PLAYERS && !returning) { sock.send(JSON.stringify({ t: 'err', m: `World is full (${D.C.MAX_PLAYERS}/${D.C.MAX_PLAYERS})` })); return; }
      }
      clearTimeout(timer);
      player = world.addPlayer(sock, pid, m.name, m.look);
      world.welcome(player);
    } catch (e) { console.error('join error', e); sock.send(JSON.stringify({ t: 'err', m: 'Server error' })); }
  });
  sock.on('close', () => { clearTimeout(timer); if (player && !sock.replaced) world.dropPlayer(player); });
});

// game loop
const DT = 1 / D.C.TICK; let last = Date.now();
setInterval(() => {
  const now = Date.now(); const dt = Math.min(0.1, (now - last) / 1000); last = now;
  for (const [code, w] of worlds) {
    if (w.players.size) { try { w.step(dt); w.flush(); } catch (e) { console.error('tick error', e); } }
    if (now - w.lastSave > 30000 && (w.dirty || w.players.size)) { try { w.save(); } catch (e) { console.error('save error', e); } }
    if (!w.players.size && w.emptySince && now - w.emptySince > 120000) { try { w.save(); } catch (e) { console.error(e); } worlds.delete(code); }
  }
}, DT * 1000);
setInterval(() => { for (const w of worlds.values()) for (const p of w.players.values()) { if (!p.ws.isAlive) { p.ws.close(1001); continue; } p.ws.isAlive = false; p.ws.ping(); } }, 25000);

function shutdown() { console.log('Saving worlds…'); for (const w of worlds.values()) { try { w.save(); } catch (e) { console.error(e); } } db.close(); process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
server.listen(PORT, () => console.log(`WILDERLAND server listening on http://localhost:${PORT}  (data: ${DATA_DIR})`));
