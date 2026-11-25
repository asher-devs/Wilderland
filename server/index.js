'use strict';
// WILDERLAND server: static file host + WebSocket game server (authoritative) + SQLite persistence.
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
