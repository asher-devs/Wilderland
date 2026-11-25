'use strict';
// Persistence using Node's built-in SQLite (node:sqlite, Node >= 22.5). No native modules to install.
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');

function openDb(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(dir, 'wilderland.db'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
    CREATE TABLE IF NOT EXISTS worlds(
      code TEXT PRIMARY KEY, name TEXT, seed INTEGER, w INTEGER, h INTEGER, host TEXT,
      settings TEXT, state TEXT, tiles BLOB, chests TEXT, created INTEGER, updated INTEGER);
    CREATE TABLE IF NOT EXISTS players(
      code TEXT, pid TEXT, name TEXT, data TEXT, updated INTEGER, PRIMARY KEY(code, pid));`);
  try { db.exec('ALTER TABLE worlds ADD COLUMN extra BLOB'); } catch (e) { /* already there */ }
  const q = {
    getWorld: db.prepare('SELECT * FROM worlds WHERE code=?'),
    putWorld: db.prepare(`INSERT INTO worlds(code,name,seed,w,h,host,settings,state,tiles,chests,created,updated,extra)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name, settings=excluded.settings, extra=excluded.extra,
      state=excluded.state, tiles=excluded.tiles, chests=excluded.chests, updated=excluded.updated`),
    getPlayers: db.prepare('SELECT pid,name,data FROM players WHERE code=?'),
    putPlayer: db.prepare(`INSERT INTO players(code,pid,name,data,updated) VALUES(?,?,?,?,?)
      ON CONFLICT(code,pid) DO UPDATE SET name=excluded.name, data=excluded.data, updated=excluded.updated`),
  };
  return {
    raw: db,
    getWorld(code) {
      const r = q.getWorld.get(code); if (!r) return null;
      return { ...r, settings: JSON.parse(r.settings), state: JSON.parse(r.state), chests: JSON.parse(r.chests), tiles: zlib.inflateSync(Buffer.from(r.tiles)), extra: r.extra ? zlib.inflateSync(Buffer.from(r.extra)) : null };
    },
    putWorld(w) {
      db.exec('BEGIN');
      try {
        q.putWorld.run(w.code, w.name, w.seed, w.w, w.h, w.host, JSON.stringify(w.settings), JSON.stringify(w.state),
          zlib.deflateSync(w.tiles, { level: 3 }), JSON.stringify(w.chests), w.created, Date.now(), w.extra);
        for (const p of w.players || []) q.putPlayer.run(w.code, p.pid, p.name, JSON.stringify(p.data), Date.now());
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    getPlayers(code) { const m = {}; for (const r of q.getPlayers.all(code)) m[r.pid] = { name: r.name, ...JSON.parse(r.data) }; return m; },
    exists(code) { return !!db.prepare('SELECT 1 FROM worlds WHERE code=?').get(code); },
    info(code) { return db.prepare('SELECT code,name,w,h,created,updated,settings FROM worlds WHERE code=?').get(code); },
    close() { try { db.close(); } catch (e) { /* ignore */ } },
  };
}
module.exports = { openDb };
