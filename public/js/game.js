/* WILDERLAND client: networking, local prediction, rendering, lighting, input. UI lives in ui.js. */
const Settings = {
  d: { master: 0.8, sfx: 0.8, music: 0.5, look: null, zoom: 'auto', touch: 'auto', server: '', name: '', shake: true, light: 'smooth' },
  load() { try { Object.assign(this.d, JSON.parse(localStorage.getItem('wl_settings') || '{}')); } catch (e) { /* ignore */ } return this.d; },
  save() { try { localStorage.setItem('wl_settings', JSON.stringify(this.d)); } catch (e) { /* ignore */ } },
};
Settings.load();
function playerId() {
  let p = null; try { p = localStorage.getItem('wl_pid'); } catch (e) { /* ignore */ }
  if (!p) { p = 'p' + Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join(''); try { localStorage.setItem('wl_pid', p); } catch (e) { /* ignore */ } }
  return p;
}

const Game = (() => {
  const { T, I, BLOCKS, ITEMS, C, RECIPES, MOBS } = DEFS;
  const cv = document.getElementById('game'), g = cv.getContext('2d');
  const lightCv = document.createElement('canvas'), lg = lightCv.getContext('2d');
  let W = 0, H = 0, tiles = null, biome = null, surf = null, top = null;
  const S = {
    running: false, ws: null, code: '', id: 0, host: false, inv: [], eq: {}, sel: 0, hp: 100, maxhp: 100, def: 0, time: 0.1, nights: 0,
    players: new Map(), mobs: new Map(), drops: new Map(), plist: [], settings: {}, dead: false, leaving: false, wname: '',
    me: null, cam: { x: 0, y: 0 }, TS: 32, cw: 0, ch: 0, dpr: 1, shake: 0, flash: 0, clock: 0, touchMode: 'mine', input: { left: false, right: false, jump: false, down: false },
    rain: 0, flashL: 0, falling: [], lightning: 0, act: { active: false, mode: null, px: 0, py: 0, edge: false, id: -1 }, mineProg: null, particles: [], texts: [], ambient: [], chest: null, prog: {},
  };
  const keys = new Set();
  const solid = (x, y) => DEFS.SOLID[get(x, y)] === 1;
  const coll = (x, y) => DEFS.COLL[get(x, y)];
  function get(x, y) { if (x < 0 || x >= W || y >= H) return T.BEDROCK; if (y < 0) return T.AIR; return tiles[y * W + x]; }
  function rescanTop(x) { let y = 0; while (y < H && !DEFS.OPAQUE[tiles[y * W + x]]) y++; top[x] = y; }
  const url = () => {
    let s = (Settings.d.server || (window.WILDERLAND_CONFIG && window.WILDERLAND_CONFIG.server) || '').trim();
    if (!s) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    if (!/^wss?:\/\//.test(s)) s = (/^(localhost|127\.|192\.168\.|10\.)/.test(s) ? 'ws://' : 'wss://') + s;
    return s.replace(/\/+$/, '');
  };
  const httpBase = () => url().replace(/^ws/, 'http');

  // ---------------------------------------------------------------- networking
  async function inflate(buf) {
    const ds = new DecompressionStream('deflate');
    return new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer());
  }
  function open(first, { onProgress } = {}) {
    return new Promise((resolve, reject) => {
      let ws, welcome = null, done = false;
      const fail = (m) => { if (!done) { done = true; try { ws.close(); } catch (e) { /* ignore */ } reject(new Error(m)); } };
      try { ws = new WebSocket(url()); } catch (e) { return reject(new Error('Bad server address')); }
      ws.binaryType = 'arraybuffer';
      const to = setTimeout(() => fail('Could not reach the server (timed out)'), 12000);
      ws.onopen = () => { onProgress && onProgress('Joining world…', 0.25); ws.send(JSON.stringify(first)); };
      ws.onerror = () => fail('Could not connect to the server');
      ws.onclose = () => { clearTimeout(to); if (!done) fail('Connection closed'); else if (S.ws === ws) onClose(ws); };
      ws.onmessage = async (e) => {
        if (typeof e.data === 'string') {
          const m = JSON.parse(e.data);
          if (!done && m.t === 'welcome') { welcome = m; onProgress && onProgress('Downloading world…', 0.5); return; }
          if (!done && m.t === 'err') return fail(m.m);
          if (done) onMessage(m); return;
        }
        if (done || !welcome) return;
        try {
          onProgress && onProgress('Unpacking terrain…', 0.75);
          const raw = await inflate(e.data); done = true; clearTimeout(to);
          const w = welcome.W, h = welcome.H;
          tiles = raw.slice(0, w * h); biome = raw.slice(w * h, w * h + w); W = w; H = h;
          surf = new Uint16Array(w); const dv = new DataView(raw.buffer, raw.byteOffset); for (let x = 0; x < w; x++) surf[x] = dv.getUint16(w * h + w + x * 2, true);
          top = new Int16Array(w); for (let x = 0; x < w; x++) rescanTop(x);
          S.ws = ws; resolve(welcome);
        } catch (err) { fail('Failed to read world data'); }
      };
    });
  }
  function send(o) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(o)); }
  // ---------- world backups (kept on this device; the free server host wipes saves on every deploy)
  const Backup = (() => {
    let dbp = null;
    const idb = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open('wilderland', 1); r.onupgradeneeded = () => r.result.createObjectStore('backups'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
    const tx = async (mode, fn) => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('backups', mode), r = fn(t.objectStore('backups')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
    const get = (code) => tx('readonly', (s) => s.get(code)).catch(() => null);
    const put = (code, data) => tx('readwrite', (s) => s.put(data, code));
    async function pull(code) {
      const r = await fetch(httpBase() + '/api/export/' + code + '?pid=' + encodeURIComponent(playerId())); if (!r.ok) throw new Error('export ' + r.status);
      const data = await r.json(); await put(code, data); return data;
    }
    async function push(data) {
      const r = await fetch(httpBase() + '/api/import', { method: 'POST', body: JSON.stringify({ ...data, pid: playerId() }) });
      if (r.ok || r.status === 409) return true; const j = await r.json().catch(() => ({})); throw new Error(j.error || 'restore failed');
    }
    /** put the backed-up world back on the server; true if restored (or already there) */
    async function restore(code) { const d = await get(code); if (!d) return false; await push(d); return true; }
    let timer = 0;
    function start() { stop(); const run = () => { if (S.code && S.ws && !document.hidden) pull(S.code).catch(() => {}); }; setTimeout(run, 15000); timer = setInterval(run, 180000); }
    function stop() { if (timer) clearInterval(timer); timer = 0; }
    async function download(code) { const d = (await get(code)) || (await pull(code)); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' })); a.download = 'wilderland-' + code + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
    async function fromFile(file) { const d = JSON.parse(await file.text()); if (d.v !== 1 || !d.code) throw new Error('Not a Wilderland backup'); await push(d); await put(d.code, d); return d; }
    return { get, pull, restore, start, stop, download, fromFile };
  })();

  let reconnecting = false;
  function onClose(ws) {
    if (S.ws !== ws || S.leaving) return;
    S.ws = null; UI.reconnecting(true);
    if (reconnecting) return; reconnecting = true;
    (async () => {
      for (let i = 0; i < 40 && !S.leaving; i++) {
        await new Promise((r) => setTimeout(r, i < 3 ? 1000 : 2500));
        if (S.leaving) break;
        try { const w = await open({ t: 'join', pid: playerId(), name: nm(), look: Settings.d.look, code: S.code }); applyWelcome(w, true); UI.reconnecting(false); reconnecting = false; return; }
        catch (e) { if (/No world/.test(e.message) && !e.restored) { try { if (await Backup.restore(S.code)) continue; } catch (e2) { /* fall through */ } } if (/full|No world/.test(e.message)) { UI.error(e.message); leave(true); reconnecting = false; return; } }
      }
      reconnecting = false; if (!S.leaving) { UI.error('Lost connection to the server'); leave(true); }
    })();
  }
  const lookOf = (id) => { const q = S.plist.find((x) => x.id === id); return q && q.look ? q.look : id; };
  const myLook = () => S._myLook || (S._myLook = Gfx.playerLook(Settings.d.look || lookOf(S.id)));
  const nm = () => (Settings.d.name || 'Wanderer').slice(0, 14);

  async function create(o) {
    UI.showLoading('Connecting…', 0.1);
    const w = await open({ t: 'create', pid: playerId(), name: nm(), look: Settings.d.look, wname: o.name, size: o.size, difficulty: o.difficulty, mobs: o.mobs, seed: o.seed }, { onProgress: UI.showLoading });
    applyWelcome(w, false); return w;
  }
  async function join(code) {
    UI.showLoading('Connecting…', 0.1);
    const w = await open({ t: 'join', pid: playerId(), name: nm(), look: Settings.d.look, code: String(code).toUpperCase().trim() }, { onProgress: UI.showLoading });
    applyWelcome(w, false); return w;
  }
  function applyWelcome(w, isReconnect) {
    S.id = w.id; S.code = w.code; S.wname = w.wname; S.host = w.host; S.settings = w.settings; S.time = w.time; S.inv = w.inv; S.eq = w.eq; S.hp = w.hp; S.maxhp = w.maxhp; S.def = w.def; S.prog = w.prog || {};
    S.players.clear(); S.mobs.clear(); S.drops.clear(); S.plist = w.players; S.dead = false; S.chest = null;
    if (!S.me || !isReconnect) {
      S.me = { x: w.x, y: w.y, vx: 0, vy: 0, w: C.PW, h: C.PH, f: 1, onGround: false, step: true, swing: -1, swingT: 0, sendT: 0, coyote: 0, jumpBuf: 0, hurt: 0, anim: 0, walkT: 0, inWater: false, stepT: 0, lastSend: '', fall: 0 };
      S.cam.x = w.x; S.cam.y = w.y;
    } else { S.me.x = w.x; S.me.y = w.y; S.me.vx = S.me.vy = 0; }
    S.running = true; S.leaving = false; S.mineProg = null;
    UI.enter(w, isReconnect);
    try { window.history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
    rememberWorld(w); Backup.start();
    resize(); if (!raf) raf = requestAnimationFrame(frame);
  }
  function rememberWorld(w) {
    try {
      const list = JSON.parse(localStorage.getItem('wl_worlds') || '[]').filter((x) => x.code !== w.code);
      list.unshift({ code: w.code, name: w.wname, last: Date.now(), server: Settings.d.server || '' });
      localStorage.setItem('wl_worlds', JSON.stringify(list.slice(0, 12)));
    } catch (e) { /* ignore */ }
  }
  function leave(silent) {
    if (S.code) Backup.pull(S.code).catch(() => {}); Backup.stop();
    S.sleeping = false; UI.sleeping(false);
    S.leaving = true; S.running = false; try { S.ws && S.ws.close(); } catch (e) { /* ignore */ } S.ws = null; reconnecting = false;
    tiles = null; S.players.clear(); S.mobs.clear(); S.drops.clear(); S.particles.length = 0;
    UI.left(silent);
  }

  // ---------------------------------------------------------------- incoming messages
  function onMessage(m) {
    switch (m.t) {
      case 'snap': return onSnap(m);
      case 'tiles': for (const [x, y, v] of m.c) { tiles[y * W + x] = v; if (DEFS.OPAQUE[v]) { if (y < top[x]) top[x] = y; } else if (y === top[x]) rescanTop(x); } return;
      case 'inv': S.inv = m.inv; S.eq = m.eq; UI.updateInv(); return;
      case 'stat': { const lost = m.hp < S.hp; S.hp = m.hp; S.maxhp = m.maxhp; S.def = m.def; UI.updateStat(lost); return; }
      case 'plist': S.plist = m.p; for (const q of m.p) { const e = S.players.get(q.id); if (e && q.look) e.look = Gfx.playerLook(q.look); } S._myLook = null; UI.updatePlayers(); return;
      case 'chat': UI.chat(m.n, m.m, m.id); if (m.id !== S.id) Sound.play('chat'); return;
      case 'sys': UI.sys(m.m); if (/joined|rejoined/.test(m.m)) Sound.play('join'); else if (/disconnected|removed/.test(m.m)) Sound.play('leave'); if (/Dawn breaks/.test(m.m)) Sound.play('dawn'); return;
      case 'toast': UI.toast(m.m); return;
      case 'mp': S.mineProg = m.no ? null : { x: m.x, y: m.y, p: m.p, t: performance.now() };
        if (m.no && performance.now() - (S.noToolT || 0) > 900) { S.noToolT = performance.now(); UI.toast(DEFS.needText(get(m.x, m.y)), 1700); Sound.play('clink'); S.shake = Math.max(S.shake, 0.08); for (let i = 0; i < 4; i++) part(m.x + 0.5, m.y + 0.5, (Math.random() - 0.5) * 5, -Math.random() * 3, 0.4, [255, 230, 150], 2); } return;
      case 'kb': if (S.me) { S.me.vx = m.vx; S.me.vy = m.vy; } return;
      case 'tp': if (S.me) { S.me.x = m.x; S.me.y = m.y; S.me.vx = S.me.vy = 0; } return;
      case 'dead': S.dead = true; S.act.active = false; UI.dead(m.by); Sound.play('die'); return;
      case 'sleepOn': S.sleeping = true; S.me.x = m.x; S.me.y = m.y; S.me.vx = S.me.vy = 0; UI.sleeping(true); return;
      case 'wake': S.sleeping = false; UI.sleeping(false); return;
      case 'respawn': S.dead = false; S.sleeping = false; UI.sleeping(false); S.me.x = m.x; S.me.y = m.y; S.me.vx = S.me.vy = 0; S.cam.x = m.x; S.cam.y = m.y; UI.respawned(); return;
      case 'chest': S.chest = { x: m.x, y: m.y, slots: m.slots }; UI.chest(); return;
      case 'chestClosed': S.chest = null; UI.chest(); return;
      case 'crafted': Sound.play('craft'); UI.crafted(m.item); return;
      case 'toolBreak': Sound.play('toolbreak'); UI.toast(`Your ${ITEMS[m.item].name} broke!`); return;
      case 'settings': S.settings = m.settings; UI.hostSettings(); return;
      case 'prog': S.prog = m.prog; UI.updateProg(); return;
      case 'kicked': UI.error('You were removed from the world by the host'); leave(true); return;
      default:
    }
  }
  function onSnap(m) {
    S.time = m.tm; S.rain = m.rain || 0;
    const seen = new Set();
    for (const a of m.p) {
      const id = a[0]; if (id === S.id) continue; seen.add(id);
      let p = S.players.get(id);
      if (!p) { p = { id, x: a[1], y: a[2], t: Math.random() * 10, look: Gfx.playerLook(lookOf(id)), walkAmt: 0 }; S.players.set(id, p); }
      p.tx = a[1]; p.ty = a[2]; p.vx = a[3]; p.vy = a[4]; p.f = a[5]; p.a = a[6]; p.held = a[7]; p.hp = a[8]; p.maxhp = a[9]; p.head = a[10]; p.body = a[11];
    }
    for (const id of S.players.keys()) if (!seen.has(id)) S.players.delete(id);
    S.lines = m.fl || []; S.arrows = m.ar || [];
    const seenM = new Set();
    for (const a of m.m) { seenM.add(a[0]); let o = S.mobs.get(a[0]); if (!o) { o = { id: a[0], type: a[1], x: a[2], y: a[3], t: Math.random() * 9, w: MOBS[a[1]].w, h: MOBS[a[1]].h, px: a[2], py: a[3] }; S.mobs.set(a[0], o); } o.tx = a[2]; o.ty = a[3]; o.f = a[4]; o.hp = a[5]; o.maxhp = a[6]; o.hurt = a[7]; o.fuse = a[8] || 0; }
    for (const id of S.mobs.keys()) if (!seenM.has(id)) S.mobs.delete(id);
    const seenD = new Set();
    for (const a of m.d) { seenD.add(a[0]); let o = S.drops.get(a[0]); if (!o) { o = { id: a[0], item: a[1], x: a[3], y: a[4], t: Math.random() * 6 }; S.drops.set(a[0], o); } o.n = a[2]; o.tx = a[3]; o.ty = a[4]; }
    for (const id of S.drops.keys()) if (!seenD.has(id)) S.drops.delete(id);
    for (const f of m.fx) fx(f);
  }
  const near = (x, y, r = 34) => S.me && Math.hypot(x - S.me.x, y - S.me.y) < r;
  function fx([k, x, y, v]) {
    if (!near(x, y)) return;
    switch (k) {
      case 'hit': Sound.play('hit', v); burst(x, y, v, 3, 0.7); break;
      case 'break': { Sound.play('break', v); const mat = BLOCKS[v] ? BLOCKS[v].mat : 'soft'; burst(x, y, v, mat === 'stone' ? 10 : 12, 1.2);
        if (mat === 'stone' || mat === 'ore') { for (let i = 0; i < 6; i++) part(x, y, (Math.random() - 0.5) * 8, -Math.random() * 6, 0.35, mat === 'ore' ? Gfx.avg(v).map((c) => Math.min(255, c + 80)) : [210, 210, 220], 2, 0.6); for (let i = 0; i < 5; i++) part(x, y, (Math.random() - 0.5) * 3, -Math.random() * 1.5, 0.8, [160, 160, 170], 5, -0.15); }
        else if (mat === 'wood') for (let i = 0; i < 7; i++) part(x, y, (Math.random() - 0.5) * 7, -Math.random() * 6, 0.7, [140 + Math.random() * 40, 96, 50], 2 + Math.random() * 2);
        else if (DEFS.LEAF[v]) for (let i = 0; i < 10; i++) part(x, y, (Math.random() - 0.5) * 5, -Math.random() * 2, 1.2, [70 + Math.random() * 60, 160, 60], 3, 0.25);
        else for (let i = 0; i < 4; i++) part(x, y, (Math.random() - 0.5) * 3, -Math.random() * 1.5, 0.7, Gfx.avg(v).map((c) => c + 25), 4, -0.1);
        break; }
      case 'tree': { Sound.play('treefall'); S.falling.push({ x, y, lg: v.lg || T.LOG, h: v.h, dir: v.dir, leaves: v.leaves, t: 0, thud: false }); break; }
      case 'shoot': Sound.play('swing'); break;
      case 'boom': Sound.play('mobdie'); Sound.play('smoke'); S.shake = Math.max(S.shake || 0, 0.5); for (let i = 0; i < 40; i++) { const an = Math.random() * 6.28, sp = 2 + Math.random() * 9; part(x, y, Math.cos(an) * sp, Math.sin(an) * sp, 0.5 + Math.random() * 0.6, i % 3 ? [255, 170 + Math.random() * 60, 40] : [70, 70, 70], 4 + Math.random() * 3, 0.3); } break;
      case 'door': Sound.play('place', T.PLANKS); break;
      case 'cast': Sound.play('splash'); for (let i = 0; i < 6; i++) part(x, y, (Math.random() - 0.5) * 3, -Math.random() * 3, 0.5, [170, 215, 255], 2); break;
      case 'bite': Sound.play('splash'); S.texts.push({ x, y: y - 0.9, txt: '!', life: 0.9, max: 0.9, c: '#ff5a4a' }); for (let i = 0; i < 8; i++) part(x, y, (Math.random() - 0.5) * 4, -Math.random() * 4, 0.5, [190, 225, 255], 2); break;
      case 'catch': Sound.play('splash'); for (let i = 0; i < 12; i++) part(x, y, (Math.random() - 0.5) * 5, -Math.random() * 7, 0.7, [190, 225, 255], 3); break;
      case 'place': Sound.play('place', v); burst(x, y, v, 3, 0.4); break;
      case 'mobhit': Sound.play('mobhit'); S.texts.push({ x, y: y - 0.6, txt: String(v), life: 0.9, max: 0.9, c: '#ffd36a' }); for (let i = 0; i < 6; i++) part(x, y, (Math.random() - 0.5) * 6, -Math.random() * 5, 0.5, [255, 90, 70], 3); break;
      case 'mobdie': Sound.play('mobdie'); for (let i = 0; i < 16; i++) part(x, y, (Math.random() - 0.5) * 7, -Math.random() * 6, 0.7, [220, 220, 240], 4, 0.6); break;
      case 'hurt': if (v === S.id) { Sound.play('hurt'); S.flash = 1; if (Settings.d.shake) S.shake = 0.35; } else { Sound.play('mobhit'); } for (let i = 0; i < 8; i++) part(x, y, (Math.random() - 0.5) * 6, -Math.random() * 5, 0.6, [230, 40, 50], 3); break;
      case 'die': for (let i = 0; i < 30; i++) part(x, y, (Math.random() - 0.5) * 9, -Math.random() * 8, 1.2, [230, 40, 50], 4); break;
      case 'heal': Sound.play('heal'); for (let i = 0; i < 12; i++) part(x + (Math.random() - 0.5), y + 1, (Math.random() - 0.5), -2 - Math.random() * 2, 1, [110, 240, 140], 3, -0.2); break;
      case 'pickup': if (v === S.id) Sound.play('pickup'); break;
      case 'smoke': Sound.play('smoke'); part(x, y, (Math.random() - 0.5), -2, 0.8, [90, 90, 90], 4, -0.3); break;
      default:
    }
  }
  function part(x, y, vx, vy, life, c, size, grav = 1) { if (S.particles.length > 500) return; S.particles.push({ x, y, vx, vy, life, max: life, c, size, grav }); }
  function burst(x, y, id, n, spd) { const c = Gfx.avg(id); for (let i = 0; i < n; i++) part(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 6 * spd, -Math.random() * 5 * spd, 0.5 + Math.random() * 0.5, c.map((v) => v + (Math.random() - 0.5) * 30), 3 + Math.random() * 3); if (id === T.CRYSTAL) for (let i = 0; i < 8; i++) part(x, y, (Math.random() - 0.5) * 4, -Math.random() * 4, 1, [180, 240, 255], 3, -0.1); }

  // ---------------------------------------------------------------- input
  const cursorPos = { x: 0, y: 0 };
  function setSel(i) { i = (i + C.HOTBAR) % C.HOTBAR; if (i === S.sel) return; S.sel = i; send({ t: 'sel', i }); UI.updateSel(); Sound.play('click'); }
  window.addEventListener('keydown', (e) => {
    if (!S.running || UI.typing()) return;
    const k = e.key.toLowerCase();
    if (e.repeat && k !== 'q') { if (['a', 'd', 'arrowleft', 'arrowright', ' ', 'w', 'arrowup'].includes(k)) e.preventDefault(); return; }
    keys.add(k);
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
    if (k >= '0' && k <= '9') { setSel(k === '0' ? 9 : +k - 1); }
    else if (k === 'e' || k === 'i') UI.toggleInventory();
    else if (k === 'escape') UI.escape();
    else if (k === 't' || k === 'enter') { e.preventDefault(); UI.openChat(); }
    else if (k === 'q') { if (S.inv[S.sel]) send({ t: 'drop', i: S.sel, all: e.shiftKey }); }
    else if (k === 'tab') { e.preventDefault(); UI.togglePlayers(true); }
  });
  window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); keys.delete(k); if (k === 'tab') UI.togglePlayers(false); });
  window.addEventListener('blur', () => keys.clear());
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { if (!S.running || UI.modalOpen()) return; e.preventDefault(); setSel(S.sel + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
  cv.addEventListener('pointerdown', (e) => {
    if (!S.running || S.dead) return; if (UI.modalOpen()) { UI.closeModals(); return; }
    Sound.ensure();
    cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
    const px = e.clientX * S.dpr, py = e.clientY * S.dpr;
    const mode = e.pointerType === 'touch' ? (S.touchMode === 'mine' ? 'mine' : 'place') : (e.button === 2 ? 'place' : 'mine');
    S.act = { active: true, mode, px, py, edge: true, id: e.pointerId, touch: e.pointerType === 'touch' }; cursorPos.x = px; cursorPos.y = py;
  });
  cv.addEventListener('pointermove', (e) => { cursorPos.x = e.clientX * S.dpr; cursorPos.y = e.clientY * S.dpr; if (S.act.active && S.act.id === e.pointerId) { S.act.px = cursorPos.x; S.act.py = cursorPos.y; } });
  const up = (e) => { if (S.act.id === e.pointerId) { S.act.active = false; send({ t: 'mineStop' }); S.mineProg = null; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  // ---------------------------------------------------------------- local simulation
  let atkT = 0, mineT = 0, placeT = 0, useT = 0, lastMineKey = '';
  function aimWorld() { return { x: S.cam.x + (S.act.active ? S.act.px - S.cw / 2 : cursorPos.x - S.cw / 2) / S.TS, y: S.cam.y + (S.act.active ? S.act.py - S.ch / 2 : cursorPos.y - S.ch / 2) / S.TS }; }
  function inReach(tx, ty) { const m = S.me; return Math.hypot(m.x - (tx + 0.5), m.y + m.h / 2 - (ty + 0.5)) <= C.REACH + 0.4; }
  function updateMe(dt) {
    const m = S.me, now = performance.now();
    if (S.dead) { m.vx *= 0.8; m.anim = 9; return; }
    if (S.sleeping) { // lie still until you press a move key (or the Wake button)
      m.vx = 0; m.vy = 0; m.anim = 10; m.walk = false;
      if (keys.has('a') || keys.has('d') || keys.has('w') || keys.has(' ') || keys.has('arrowleft') || keys.has('arrowright') || keys.has('arrowup') || S.input.left || S.input.right || S.input.jump) { S.sleeping = false; UI.sleeping(false); send({ t: 'wake' }); }
      m.sendT -= dt; if (m.sendT <= 0) { m.sendT = 0.5; send({ t: 'mv', x: m.x, y: m.y, vx: 0, vy: 0, f: m.f, a: 10 }); }
      return;
    }
    const modal = UI.typing();
    let dir = 0; if (!modal) { if (keys.has('a') || keys.has('arrowleft') || S.input.left) dir -= 1; if (keys.has('d') || keys.has('arrowright') || S.input.right) dir += 1; }
    const wantJump = !modal && (keys.has(' ') || keys.has('w') || keys.has('arrowup') || S.input.jump);
    const cx = Math.floor(m.x), cy = Math.floor(m.y + m.h * 0.5), cyFeet = Math.floor(m.y + m.h * 0.85);
    const wasWater = m.inWater; m.inWater = get(cx, cy) === T.WATER; if (m.inWater && !wasWater) { Sound.play('splash'); for (let i = 0; i < 10; i++) part(m.x, m.y + m.h * 0.5, (Math.random() - 0.5) * 5, -Math.random() * 5, 0.6, [150, 200, 255], 3); }
    const sprint = !modal && (keys.has('shift')) && m.onGround; const run = C.RUN * (m.inWater ? 0.6 : 1) * (sprint ? 1.35 : 1);
    const accel = m.onGround ? 16 : 8;
    m.vx += (dir * run - m.vx) * Math.min(1, dt * (dir ? accel : (m.onGround ? 14 : 3)));
    if (m.onGround) m.coyote = 0.1; else m.coyote -= dt;
    if (wantJump) m.jumpBuf = 0.12; else m.jumpBuf -= dt;
    const onLadder = !m.inWater && (get(cx, cy) === T.LADDER || get(cx, Math.floor(m.y + m.h * 0.2)) === T.LADDER || get(cx, cyFeet) === T.LADDER);
    const down = !modal && (keys.has('s') || keys.has('arrowdown') || S.input.down);
    if (onLadder && (wantJump || down || ((m.climbing || !m.onGround) && !dir))) {
      // climb: up/jump goes up, down/S goes down, otherwise cling in place; steering sideways lets go
      m.vy = wantJump ? -4.6 : down ? 5.2 : 0; m.vx *= 0.6; m.jumpBuf = 0; m.coyote = 0.1; m.climbing = true;
    } else { m.climbing = false; }
    if (m.climbing) { /* gravity suspended while on a ladder */ }
    else if (m.inWater) { m.vy += C.GRAVITY * 0.25 * dt; m.vy = Math.min(m.vy, 4); if (wantJump) m.vy = Math.max(m.vy - 40 * dt, -5.5); }
    else {
      if (m.jumpBuf > 0 && m.coyote > 0) { m.vy = -C.JUMP; m.jumpBuf = 0; m.coyote = 0; Sound.play('jump'); }
      if (!wantJump && m.vy < -4.5) m.vy += C.GRAVITY * 1.6 * dt;
      m.vy = Math.min(C.MAXFALL, m.vy + C.GRAVITY * dt);
    }
    const preVy = m.vy, wasGround = m.onGround;
    DEFS.moveBody(m, dt, coll);
    if (m.onGround && !wasGround && preVy > 12) { Sound.play('land'); for (let i = 0; i < 6; i++) part(m.x, m.y + m.h, (Math.random() - 0.5) * 5, -Math.random() * 2, 0.4, [200, 190, 170], 3); }
    m.x = Math.max(1, Math.min(W - 1, m.x));
    if (m.y > H + 5) { m.y = 10; m.vy = 0; }
    if (dir) m.f = dir; m.walk = Math.abs(m.vx) > 0.8 && m.onGround;
    if (m.walk) { m.stepT -= dt * Math.abs(m.vx) / 7; if (m.stepT <= 0) { m.stepT = 0.26; Sound.play('step'); if (Math.random() < 0.3) part(m.x, m.y + m.h, -dir, -1, 0.35, [180, 170, 150], 2); } }
    m.walkT += dt * (0.5 + Math.abs(m.vx) / 7 * 0.8);
    if (sprint && m.walk && Math.random() < dt * 14) part(m.x - m.f * 0.3, m.y + m.h, -m.f * 2, -0.5 - Math.random(), 0.35, [190, 178, 150], 3, 0.3);
    m.anim = (m.onGround || m.inWater ? (m.walk ? 1 : 0) : 2);
    // actions
    const a = S.act; let acting = false;
    if (a.active && !modal) {
      const aim = aimWorld(), tx = Math.floor(aim.x), ty = Math.floor(aim.y), held = S.inv[S.sel], it = held && ITEMS[held[0]];
      if (Math.abs(aim.x - m.x) > 0.3) { m.f = aim.x > m.x ? 1 : -1; }
      if (a.mode === 'mine') {
        let target = null;
        for (const o of S.mobs.values()) { if (Math.abs(aim.x - o.x) < o.w / 2 + 0.6 && aim.y > o.y - 0.7 && aim.y < o.y + o.h + 0.7 && Math.hypot(o.x - m.x, o.y - m.y) < 4) { target = o; break; } }
        if (target || (it && it.kind === 'sword')) {
          acting = true; if (now > atkT) { atkT = now + (it && it.kind === 'sword' ? 330 : 450); send({ t: 'atk', d: aim.x >= m.x ? 1 : -1 }); m.swing = 0; Sound.play('swing'); }
        } else {
          const id = get(tx, ty), b = BLOCKS[id];
          if (b && id !== T.AIR && id !== T.WATER && isFinite(b.hard) && inReach(tx, ty)) {
            acting = true; const key = tx + ',' + ty; if (key !== lastMineKey) { lastMineKey = key; S.mineProg = null; }
            if (now > mineT) { mineT = now + 85; send({ t: 'mine', x: tx, y: ty }); }
          } else if (lastMineKey) { lastMineKey = ''; send({ t: 'mineStop' }); S.mineProg = null; }
        }
      } else if (a.mode === 'place') {
        const id = get(tx, ty);
        if (a.edge && id === T.CHEST && inReach(tx, ty)) { send({ t: 'chestOpen', x: tx, y: ty }); }
        else if (a.edge && DEFS.DOORTILE[id] && inReach(tx, ty)) { send({ t: 'door', x: tx, y: ty }); }
        else if (a.edge && (id === T.BED || id === T.BED_R) && inReach(tx, ty)) { send({ t: 'sleep', x: tx, y: ty }); }
        else if (a.edge && (id === T.BENCH || id === T.FURNACE || id === T.MASON) && inReach(tx, ty)) { UI.openInventory(); }
        else if (it && it.kind === 'rod') { if (now > placeT) { placeT = now + 450; send({ t: 'fish', a: 'cast', x: tx, y: ty }); m.swing = 0; acting = true; } }
        else if (it && it.kind === 'axe' && DEFS.STRIPPED[id] && inReach(tx, ty)) { if (now > placeT) { placeT = now + 350; send({ t: 'place', x: tx, y: ty }); acting = true; } }
        else if (it && it.block !== undefined) { if (now > placeT && inReach(tx, ty)) { placeT = now + 120; send({ t: 'place', x: tx, y: ty }); acting = true; } }
        else if (it && it.heal && now > useT) { useT = now + 350; send({ t: 'use' }); }
      }
      a.edge = false;
    }
    if (m.swing >= 0) { m.swing += dt / 0.25; if (m.swing >= 1) m.swing = -1; }
    if (acting && a.mode === 'mine' && m.swing < 0) m.swing = 0;
    m.anim |= (m.swing >= 0 ? 4 : 0);
    // net sync (20 Hz)
    m.sendT -= dt;
    if (m.sendT <= 0) {
      m.sendT = 0.05; const msg = { t: 'mv', x: +m.x.toFixed(2), y: +m.y.toFixed(2), vx: +m.vx.toFixed(2), vy: +m.vy.toFixed(2), f: m.f, a: m.anim };
      const key = msg.x + '|' + msg.y + '|' + msg.a + '|' + msg.f; if (key !== m.lastSend || (now % 1000) < 60) { m.lastSend = key; send(msg); }
    }
  }
  function updateEntities(dt) {
    const k = Math.min(1, dt * 14);
    for (const p of S.players.values()) { p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.t += dt; p.walkAmt = Math.abs(p.vx) > 0.8 ? 1 : 0; p.swingT = ((p.swingT || 0) + dt * 4) % 1; }
    for (const o of S.mobs.values()) { o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.t += dt; o.air = Math.abs(o.y - o.py) > 0.02; o.py = o.y; }
    for (const d of S.drops.values()) { d.x += (d.tx - d.x) * k; d.y += (d.ty - d.y) * k; d.t += dt; }
    for (let i = S.particles.length - 1; i >= 0; i--) { const p = S.particles[i]; p.life -= dt; if (p.life <= 0) { S.particles.splice(i, 1); continue; } p.vy += 14 * p.grav * dt; if (p.wob) { p.vx += Math.sin(S.clock * 5 + p.y * 3) * dt * 5; p.vy += Math.cos(S.clock * 4 + p.x * 3) * dt * 5; } p.x += p.vx * dt; p.y += p.vy * dt; }
    for (let i = S.texts.length - 1; i >= 0; i--) { const t = S.texts[i]; t.life -= dt; t.y -= dt * 1.2; if (t.life <= 0) S.texts.splice(i, 1); }
    if (S.mineProg && performance.now() - S.mineProg.t > 450) S.mineProg = null;
    S.shake = Math.max(0, S.shake - dt); S.flash = Math.max(0, S.flash - dt * 2.2);
  }

  // ---------------------------------------------------------------- rendering helpers
  function daylight(t) { // 1 = full day, 0 = deep night
    const sm = (a, b, x) => { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
    if (t < 0.5) return 1; if (t < 0.62) return 1 - sm(0.5, 0.62, t) * 0.9; if (t < 0.9) return 0.1; return 0.1 + sm(0.9, 0.99, t) * 0.9;
  }
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  function skyColors(t) {
    const D = daylight(t), dusk = Math.max(0, 1 - Math.abs(D - 0.5) * 2.6);
    let tp = mix([66, 76, 160], [86, 164, 238], D), bt = mix([96, 92, 176], [186, 226, 252], D);
    tp = mix(tp, [120, 100, 180], dusk * 0.7); bt = mix(bt, [255, 150, 96], dusk * 0.85);
    return { top: tp, bot: bt, D };
  }
  function lightTint(t) { // sunlight colour at this time
    const D = daylight(t), dusk = Math.max(0, 1 - Math.abs(D - 0.5) * 2.6);
    let c = mix([0.3, 0.36, 0.62], [1, 1, 1], D); c = mix(c, [1, 0.72, 0.6], dusk * 0.5); return c;
  }
  const stars = Array.from({ length: 90 }, (_, i) => ({ x: Gfx.hash(i) , y: Gfx.hash(i + 99) * 0.7, s: Gfx.hash(i + 7) }));
  const cloudsDef = Array.from({ length: 9 }, (_, i) => ({ x: Gfx.hash(i + 3) * 1.6, y: 0.05 + Gfx.hash(i + 17) * 0.28, w: 5 + Gfx.hash(i + 31) * 9, sp: 0.004 + Gfx.hash(i + 5) * 0.01 }));
  let vignette = null;
  function drawSky(t) {
    const { cw, ch, TS } = S, sc = skyColors(t); const grd = g.createLinearGradient(0, 0, 0, ch); grd.addColorStop(0, rgb(sc.top)); grd.addColorStop(1, rgb(sc.bot)); g.fillStyle = grd; g.fillRect(0, 0, cw, ch);
    const D = sc.D, u = Math.max(2, Math.round(TS / 8));
    if (D < 0.85) { for (const s of stars) { const tw = 0.6 + 0.4 * Math.sin(S.clock * 2 + s.s * 40); g.fillStyle = `rgba(255,255,255,${(1 - D) * tw})`; g.fillRect(Math.floor(s.x * cw), Math.floor(s.y * ch), s.s > 0.8 ? u : u / 2 | 0 || 1, s.s > 0.8 ? u : u / 2 | 0 || 1); } }
    // sun & moon travel in an arc
    const arc = (p) => ({ x: cw * (0.08 + 0.84 * p), y: ch * 0.62 - Math.sin(Math.PI * p) * ch * 0.5 });
    if (t < 0.58) { const p = arc(t / 0.58); g.fillStyle = 'rgba(255,230,120,0.18)'; g.beginPath(); g.arc(p.x, p.y, u * 9, 0, 7); g.fill(); g.fillStyle = '#ffe36e'; g.fillRect(p.x - u * 4, p.y - u * 4, u * 8, u * 8); g.fillStyle = '#fff6b8'; g.fillRect(p.x - u * 3, p.y - u * 3, u * 6, u * 6); g.fillStyle = '#ffe36e'; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + S.clock * 0.1; g.fillRect(p.x + Math.cos(a) * u * 7 - u / 2, p.y + Math.sin(a) * u * 7 - u / 2, u, u); } }
    if (t > 0.5) { const p = arc(Math.min(1, (t - 0.52) / 0.46)); g.fillStyle = 'rgba(200,220,255,0.15)'; g.beginPath(); g.arc(p.x, p.y, u * 8, 0, 7); g.fill(); g.fillStyle = '#e8eefc'; g.beginPath(); g.arc(p.x, p.y, u * 4, 0, 7); g.fill(); g.fillStyle = '#c4cce4'; g.fillRect(p.x - u * 2, p.y - u, u, u); g.fillRect(p.x + u, p.y + u, u * 1.4, u * 1.4); g.fillStyle = sc.top.map((v) => v) && rgb(sc.top); g.beginPath(); g.arc(p.x + u * 2.2, p.y - u * 1.2, u * 3.6, 0, 7); g.fill(); }
    // clouds
    g.fillStyle = `rgba(255,255,255,${0.35 + D * 0.45})`;
    for (const c of cloudsDef) { const x = (((c.x + S.clock * c.sp) % 1.7) - 0.3) * cw - S.cam.x * TS * 0.04 % cw; const y = c.y * ch - (S.cam.y - 90) * TS * 0.05; const w = c.w * u; g.fillRect(x, y, w, u * 2); g.fillRect(x + u * 2, y - u * 1.5, w * 0.6, u * 2); g.fillRect(x - u, y + u, w * 0.5, u); }
    // parallax hills by biome
    const cxT = Math.floor(S.cam.x); const wB = [0, 0, 0, 0, 0, 0]; let tot = 0; for (let k = -40; k <= 40; k += 8) { wB[biome[Math.max(0, Math.min(W - 1, cxT + k))]]++; tot++; }
    // per-layer colours for [forest, desert, snow, plains, mountain, swamp]
    const HC = [[[86, 140, 130], [60, 124, 96], [48, 108, 70]], [[210, 168, 120], [200, 150, 96], [186, 138, 84]], [[214, 228, 242], [190, 210, 232], [170, 194, 220]], [[130, 184, 130], [104, 170, 96], [88, 150, 76]], [[132, 140, 168], [112, 120, 150], [92, 100, 128]], [[92, 120, 100], [70, 98, 76], [56, 80, 56]]];
    const layers = [{ par: 0.12, off: -14, amp: 9, f: 0.04 }, { par: 0.25, off: -6, amp: 7, f: 0.07 }, { par: 0.42, off: 2, amp: 5, f: 0.1 }];
    layers[0].amp = 9 + wB[4] / tot * 12; layers[1].amp = 7 + wB[4] / tot * 8;
    const baseY = H * 0.3; const swampMist = wB[5] / tot; layers.forEach((L, li) => {
      const c0 = [0, 0, 0]; for (let q = 0; q < 6; q++) { const k = wB[q] / tot; c0[0] += HC[q][li][0] * k; c0[1] += HC[q][li][1] * k; c0[2] += HC[q][li][2] * k; }
      const c = mix(c0, sc.bot, 0.18); g.fillStyle = rgb(c);
      const by = ch / 2 + (baseY + L.off - S.cam.y) * TS * (0.5 + L.par); if (by > ch + 200 || by < -200) return;
      g.beginPath(); g.moveTo(0, ch + 10); for (let x = 0; x <= cw; x += Math.max(8, u * 3)) { const wx = x / TS + S.cam.x * L.par * 0.9; const hy = by - (Math.sin(wx * L.f * 2 + li) * 0.6 + Math.sin(wx * L.f * 5.3 + li * 3) * 0.4 + 1) * L.amp * TS * 0.5; g.lineTo(x, Math.round(hy / u) * u); } g.lineTo(cw, ch + 10); g.fill();
    });
  }

  // ---- lighting
  let LR = null, LG = null, LB = null, ATT = null, lightImg = null, lightCap = 0, glows = [];
  function computeLight(x0, y0, gw, gh, tint, D) {
    const n = gw * gh; if (n > lightCap) { lightCap = n; LR = new Float32Array(n); LG = new Float32Array(n); LB = new Float32Array(n); ATT = new Float32Array(n); }
    if (!lightImg || lightImg.width !== gw || lightImg.height !== gh) { lightCv.width = gw; lightCv.height = gh; lightImg = lg.createImageData(gw, gh); }
    glows.length = 0;
    const amb = 0.075, t = S.clock;
    for (let j = 0; j < gh; j++) {
      const y = y0 + j;
      for (let i = 0; i < gw; i++) {
        const x = x0 + i, idx = j * gw + i, v = get(x, y); const sol = DEFS.SOLID[v] === 1;
        let r = amb * 0.9, gg = amb, b = amb * 1.4; ATT[idx] = DEFS.CLEAR[v] ? 0.94 : sol ? 0.74 : DEFS.BACKWALL[v] ? 0.86 : (DEFS.LEAF[v] ? 0.82 : 0.93);
        if (x >= 0 && x < W) {
          if (y <= top[x]) { const k = sol ? 1 : 1; const lt = DEFS.LEAF[v] ? 0.78 : k; r = Math.max(r, tint[0] * lt); gg = Math.max(gg, tint[1] * lt); b = Math.max(b, tint[2] * lt); }
          const bl = BLOCKS[v] && BLOCKS[v].light;
          if (bl) { const fl = v === T.TORCH ? 0.93 + Math.sin(t * 9 + x * 3.1) * 0.07 + Math.sin(t * 23 + y) * 0.03 : v === T.CRYSTAL ? 0.8 + Math.sin(t * 2 + x + y) * 0.12 : 1; const s = v === T.FURNACE ? 0.55 : 1; r = Math.max(r, bl[0] * fl * s); gg = Math.max(gg, bl[1] * fl * s); b = Math.max(b, bl[2] * fl * s); if (glows.length < 90 && v !== T.CRYSTAL || (v === T.CRYSTAL && glows.length < 90 && ((x + y) & 1) === 0)) glows.push([x, y, bl, v === T.TORCH ? 3.6 : v === T.CRYSTAL ? 2.4 : 2.2, fl]); }
        }
        LR[idx] = r; LG[idx] = gg; LB[idx] = b;
      }
    }
    // player + creature glows
    const addSrc = (wx, wy, c, k) => { const i = Math.floor(wx) - x0, j = Math.floor(wy) - y0; if (i < 0 || j < 0 || i >= gw || j >= gh) return; const idx = j * gw + i; LR[idx] = Math.max(LR[idx], c[0] * k); LG[idx] = Math.max(LG[idx], c[1] * k); LB[idx] = Math.max(LB[idx], c[2] * k); };
    if (S.me && !S.dead) addSrc(S.me.x, S.me.y + 0.8, [1, 0.88, 0.7], 0.78);
    for (const p of S.players.values()) addSrc(p.x, p.y + 0.8, [1, 0.88, 0.7], 0.78);
    for (const o of S.mobs.values()) { const d = MOBS[o.type]; if (d.glow) addSrc(o.x, o.y + o.h / 2, d.glow, 0.7); }
    for (const d of S.drops.values()) { const b = d.item === T.CRYSTAL ? [0.55, 0.75, 1] : null; if (b) addSrc(d.x, d.y, b, 0.6); }
    for (const q of S.particles) if (q.glow) addSrc(q.x, q.y, q.glow, 0.5);
    const sweep = (a0, a1, step, stride) => { for (let i = a0 + step; i !== a1; i += step) { const att = ATT[i], p = i - stride; let v = LR[p] * att; if (v > LR[i]) LR[i] = v; v = LG[p] * att; if (v > LG[i]) LG[i] = v; v = LB[p] * att; if (v > LB[i]) LB[i] = v; } };
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < gh; j++) { sweep(j * gw, j * gw + gw, 1, 1); sweep(j * gw + gw - 1, j * gw - 1, -1, -1); }
      for (let i = 0; i < gw; i++) { for (let j = 1; j < gh; j++) { const idx = j * gw + i, p = idx - gw, att = ATT[idx]; let v = LR[p] * att; if (v > LR[idx]) LR[idx] = v; v = LG[p] * att; if (v > LG[idx]) LG[idx] = v; v = LB[p] * att; if (v > LB[idx]) LB[idx] = v; } for (let j = gh - 2; j >= 0; j--) { const idx = j * gw + i, p = idx + gw, att = ATT[idx]; let v = LR[p] * att; if (v > LR[idx]) LR[idx] = v; v = LG[p] * att; if (v > LG[idx]) LG[idx] = v; v = LB[p] * att; if (v > LB[idx]) LB[idx] = v; } }
    }
    const d = lightImg.data; for (let i = 0; i < n; i++) { const o = i * 4; d[o] = Math.min(255, LR[i] * 255); d[o + 1] = Math.min(255, LG[i] * 255); d[o + 2] = Math.min(255, LB[i] * 255); d[o + 3] = 255; }
    lg.putImageData(lightImg, 0, 0);
  }

  function hash2(x, y) { return (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 13; }
  function drawWorld() {
    const { cw, ch, TS, cam } = S; const t = S.clock;
    let shx = 0, shy = 0; if (S.shake > 0) { shx = (Math.random() - 0.5) * S.shake * 14; shy = (Math.random() - 0.5) * S.shake * 14; }
    const ox = Math.round(cw / 2 - cam.x * TS + shx), oy = Math.round(ch / 2 - cam.y * TS + shy);
    const x0 = Math.floor(cam.x - cw / 2 / TS) - 1, x1 = Math.ceil(cam.x + cw / 2 / TS) + 1, y0 = Math.floor(cam.y - ch / 2 / TS) - 1, y1 = Math.ceil(cam.y + ch / 2 / TS) + 1;
    g.imageSmoothingEnabled = false; const A = Gfx.atlas, u = Math.max(1, Math.round(TS / 16));
    const water = [];
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        const v = tiles[y * W + x], sx = x * TS + ox, sy = y * TS + oy, sol = DEFS.SOLID[v] === 1, vr = hash2(x, y) & 3;
        const s = surf[x];
        if ((!sol || DEFS.CLEAR[v]) && y > s) { const d = y - s, b = biome[x]; const bg = (b === 0 || b === 3 || b === 5) && d < 14 ? Gfx.BG.DIRT : b === 1 && d < 30 ? Gfx.BG.SAND : (b === 2 || (b === 4 && s < H * 0.3 - 24)) && d < 30 ? Gfx.BG.ICE : Gfx.BG.STONE; g.drawImage(A, bg * 16, vr * 16, 16, 16, sx, sy, TS, TS); }
        if (v === T.AIR) continue;
        if (v === T.WATER) { water.push(x, y); continue; }
        if (DEFS.DECOR[v] || DEFS.LEAF[v]) {
          const leaf = DEFS.LEAF[v] === 1; let tv = vr, b = biome[x];
          if (v === T.PLANT) { if (b === 1) tv = 3; else if (b === 2) continue; else tv = vr === 3 ? 0 : vr; }
          let push = 0;
          if (!leaf && S.me) { const dx = (x + 0.5) - S.me.x, adx = Math.abs(dx); if (adx < 1.4 && Math.abs(y - (S.me.y + 1)) < 2.2) { push = Math.sign(dx) * (1.4 - adx) * u * 2.2 * (v === T.ROCK ? 0 : 1); if (Math.abs(S.me.vx) > 3 && Math.random() < 0.012 && v !== T.ROCK) part(x + 0.5, y + 0.4, (Math.random() - 0.5) * 2, -1 - Math.random(), 0.6, b === 3 ? [255, 230, 120] : [110, 200, 80], 2, 0.2); } }
          const sw = Math.round(Math.sin(t * 1.7 + x * 0.8 + y * 0.3) * (leaf ? u * 0.5 : v === T.ROCK ? 0 : v === T.REED ? u * 1.6 : u * 1.2) + push);
          if (leaf) { g.drawImage(A, v * 16, tv * 16, 16, 16, sx + sw, sy, TS, TS); if ((v === T.PINE || v === T.LEAVES) && (b === 2 || (b === 4 && surf[x] < H * 0.3 - 24))) { g.fillStyle = 'rgba(240,248,255,0.78)'; if (!DEFS.LEAF[get(x, y - 1)]) g.fillRect(sx + sw + u * 1, sy, TS - u * 2, u * 2); g.fillRect(sx + sw + u * 4, sy + u * 6, u * 3, u); } }
          else if (v === T.ROCK || v === T.MUSHROOM) g.drawImage(A, v * 16, tv * 16, 16, 16, sx, sy, TS, TS);
          else { g.drawImage(A, v * 16, tv * 16 + 8, 16, 8, sx, sy + TS / 2, TS, TS / 2); g.drawImage(A, v * 16, tv * 16, 16, 8, sx + sw, sy, TS, TS / 2); }
          continue;
        }
        if (DEFS.SHAPE[v]) {
          const sh = DEFS.SHAPE[v], wl = (q) => { const k = get(q, y); return DEFS.SOLID[k] === 1 || (DEFS.SHAPE[k] && DEFS.SHAPE[k].kind === 'wall'); };
          Gfx.drawShape(g, v, sx, sy, TS, vr, sh.kind === 'wall' && wl(x - 1), sh.kind === 'wall' && wl(x + 1));
          if (S.mineProg && S.mineProg.x === x && S.mineProg.y === y) { const st = Math.min(4, Math.floor(S.mineProg.p * 5)); g.drawImage(Gfx.cracks, st * 16, 0, 16, 16, sx, sy, TS, TS); }
          continue;
        }
        g.drawImage(A, v * 16, vr * 16, 16, 16, sx, sy, TS, TS);
        if (DEFS.BACKWALL[v]) { g.fillStyle = 'rgba(8,10,20,0.42)'; g.fillRect(sx, sy, TS, TS); }
        if (sol) {
          if (v !== T.GRASS && v !== T.SNOW && !DEFS.CLEAR[v] && !DEFS.SOLID[get(x, y - 1)]) { g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(sx, sy, TS, u); }
          if (!DEFS.CLEAR[v] && !DEFS.SOLID[get(x, y + 1)]) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(sx, sy + TS - u, TS, u); }
        }
        if (S.mineProg && S.mineProg.x === x && S.mineProg.y === y) { const st = Math.min(4, Math.floor(S.mineProg.p * 5)); g.drawImage(Gfx.cracks, st * 16, 0, 16, 16, sx, sy, TS, TS); }
      }
    }
    // drops
    for (const d of S.drops.values()) { const sx = d.x * TS + ox, sy = (d.y) * TS + oy + Math.sin(d.t * 3) * TS * 0.06 - TS * 0.2; const sz = TS * 0.5; g.drawImage(Gfx.icon(d.item), sx - sz / 2, sy - sz / 2, sz, sz); if (d.n > 1) { g.fillStyle = '#fff'; g.font = `${Math.round(TS * 0.3)}px monospace`; g.fillText(d.n, sx + sz / 3, sy + sz / 1.5); } }
    // mobs
    for (const o of S.mobs.values()) Gfx.drawMob(g, o.type, o.x * TS + ox, (o.y + o.h) * TS + oy, TS / 16, { f: o.f, t: o.t, hurt: o.hurt, air: o.air, id: o.id, moving: Math.abs(o.tx - o.x) > 0.004 || Math.abs(o.ty - o.y) > 0.004, angry: MOBS[o.type].neutral && o.hurt, fuse: o.fuse });
    // other players
    for (const p of S.players.values()) { const dead = p.a === 9, slp = p.a === 10; Gfx.drawPlayer(g, p.x * TS + ox, (p.y + C.PH) * TS + oy, TS / 16, { look: p.look, f: p.f, t: p.t, walk: p.walkAmt, air: !slp && (p.a & 3) === 2, swing: (p.a & 4) && !dead && !slp ? p.swingT : -1, held: p.held, head: p.head, body: p.body, dead, sleep: slp }); }
    if (S.me && !(S.dead)) { const m = S.me; Gfx.drawPlayer(g, m.x * TS + ox, (m.y + C.PH) * TS + oy, TS / 16, { look: myLook(), f: m.f, t: m.walkT, walk: m.walk ? 1 : 0, air: !S.sleeping && !m.onGround && !m.inWater, swing: m.swing, held: S.inv[S.sel] ? S.inv[S.sel][0] : 0, head: S.eq.head ? S.eq.head[0] : 0, body: S.eq.body ? S.eq.body[0] : 0, hurt: S.flash > 0.5 ? 1 : 0, sleep: S.sleeping }); }
    // falling trees
    for (let i = S.falling.length - 1; i >= 0; i--) {
      const f = S.falling[i]; f.t += (S.dt || 0.016); const k = Math.min(1, f.t / 1.15), ang = f.dir * (k * k * (Math.PI / 2) * 1.0) + (k > 0.9 ? f.dir * Math.sin((k - 0.9) * 30) * 0.03 : 0);
      g.save(); g.translate(Math.round(f.x * TS + ox), Math.round(f.y * TS + oy)); g.rotate(ang); g.imageSmoothingEnabled = false;
      for (let q = 1; q <= f.h; q++) g.drawImage(A, f.lg * 16, 0, 16, 16, -TS / 2, -q * TS, TS, TS);
      for (const [dx, dy, lt] of f.leaves) g.drawImage(A, lt * 16, 0, 16, 16, (dx - 0.5) * TS, dy * TS, TS, TS);
      g.restore();
      if (f.t >= 1.15 && !f.thud) { f.thud = true; Sound.play('thud'); S.shake = Math.max(S.shake, 0.12); for (const [dx, dy] of f.leaves.filter((_, j) => j % 3 === 0)) part(f.x + f.dir * (-dy) * 0.9 + dx * 0.1, f.y - 0.5, (Math.random() - 0.5) * 5, -Math.random() * 3, 1.2, [80 + Math.random() * 60, 170, 60], 3, 0.3); }
      if (f.t > 1.3) S.falling.splice(i, 1);
    }
    // water overlay: depth-shaded, animated surface, foam, caustics
    for (let i = 0; i < water.length; i += 2) {
      const x = water[i], y = water[i + 1], sx = x * TS + ox, sy = y * TS + oy; const topW = get(x, y - 1) !== T.WATER, wv = Math.sin(t * 2 + x * 0.9) * u * 0.6;
      let dep = 0; while (dep < 5 && get(x, y - dep - 1) === T.WATER) dep++;
      const sw = biome[x] === 5; g.fillStyle = sw ? `rgba(54,104,84,${0.55 + dep * 0.06})` : `rgba(${52 - dep * 6},${120 - dep * 8},${220 - dep * 6},${0.46 + dep * 0.06})`; g.fillRect(sx, sy + (topW ? u * 2 + wv : 0), TS, TS - (topW ? u * 2 + wv : 0));
      if (topW) { g.fillStyle = 'rgba(210,235,255,0.8)'; g.fillRect(sx, sy + u * 2 + wv, TS, u); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(sx + ((x * 7 + Math.floor(t * 2)) % 3) * u * 4, sy + u * 4 + wv, u * 4, u); if (!DEFS.SOLID[get(x - 1, y)] && get(x - 1, y) !== T.WATER) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(sx, sy + u * 2 + wv, u * 2, u * 2); } if (sw) { g.fillStyle = 'rgba(120,160,70,0.55)'; g.fillRect(sx + ((x * 5) % 3) * u * 4, sy + u * 2 + wv, u * 4, u * 2); } }
      else { const c = (x * 31 + y * 17 + Math.floor(t * 1.5)) % 11; if (c === 0) { g.fillStyle = 'rgba(200,235,255,0.35)'; g.fillRect(sx + u * 3, sy + u * 5, u * 3, u * 2); } else if (c === 5) { g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(sx + u * 9, sy + u * 10, u * 2, u); } }
    }
    // particles
    for (const p of S.particles) { const k = Math.max(0, p.life / p.max); g.fillStyle = `rgba(${p.c[0] | 0},${p.c[1] | 0},${p.c[2] | 0},${Math.min(1, k * 1.6)})`; const sz = Math.max(2, Math.round(p.size * TS / 32)); g.fillRect(Math.round(p.x * TS + ox), Math.round(p.y * TS + oy), sz, sz); }
    // lighting
    const tint = lightTint(S.time).map((c) => c * (1 - S.rain * 0.28)), pad = 8; const lx0 = x0 - pad, ly0 = y0 - pad, gw = x1 - x0 + 1 + pad * 2, gh = y1 - y0 + 1 + pad * 2;
    computeLight(lx0, ly0, gw, gh, tint, S.D);
    g.save(); g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = Settings.d.light !== 'pixel'; g.imageSmoothingQuality = 'low';
    g.drawImage(lightCv, 0, 0, gw, gh, lx0 * TS + ox, ly0 * TS + oy, gw * TS, gh * TS); g.restore();
    // additive glows
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [x, y, c, r, fl] of glows) { const sx = (x + 0.5) * TS + ox, sy = (y + 0.5) * TS + oy; if (sx < -TS * 4 || sx > cw + TS * 4 || sy < -TS * 4 || sy > ch + TS * 4) continue; const rad = r * TS; const gr = g.createRadialGradient(sx, sy, 0, sx, sy, rad); const a = 0.2 * fl * (0.4 + (1 - S.D) * 0.6 + 0.0); gr.addColorStop(0, `rgba(${c[0] * 255 | 0},${c[1] * 255 | 0},${c[2] * 255 | 0},${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(sx - rad, sy - rad, rad * 2, rad * 2); }
    g.restore();
    // cursor / placement ghost (desktop & touch)
    if (S.me && !S.dead && (S.act.active || (!S.act.touch && cursorPos.x))) {
      const aim = aimWorld(), tx = Math.floor(aim.x), ty = Math.floor(aim.y), ok = inReach(tx, ty); const sx = tx * TS + ox, sy = ty * TS + oy;
      const held = S.inv[S.sel], it = held && ITEMS[held[0]];
      if (it && it.block !== undefined && ok && get(tx, ty) === T.AIR) { g.globalAlpha = 0.4; if (DEFS.SHAPE[it.block]) { const sh = DEFS.SHAPE[it.block]; const id2 = sh.kind === 'stairR' ? DEFS.SHAPE_OF[sh.base + (S.me.x < tx + 0.5 ? ':stairR' : ':stairL')] : it.block; Gfx.drawShape(g, id2, sx, sy, TS, 0, true, true); } else g.drawImage(Gfx.atlas, it.block * 16, 0, 16, 16, sx, sy, TS, TS); g.globalAlpha = 1; }
      g.strokeStyle = ok ? 'rgba(255,255,255,0.8)' : 'rgba(255,90,90,0.6)'; g.lineWidth = Math.max(1, u); g.strokeRect(sx + 0.5, sy + 0.5, TS - 1, TS - 1);
    }
    // names, hp bars, floating text
    g.font = `bold ${Math.max(11, Math.round(TS * 0.36))}px "Segoe UI", system-ui, sans-serif`; g.textAlign = 'center';
    const tag = (txt, x, y, host, col) => { const w = g.measureText(txt).width + 12; g.fillStyle = 'rgba(8,12,24,0.55)'; g.fillRect(x - w / 2, y - 13, w, 17); g.fillStyle = col || '#fff'; g.fillText((host ? '★ ' : '') + txt, x, y); };
    for (const p of S.players.values()) { const info = S.plist.find((q) => q.id === p.id); tag(info ? info.name : 'Player', p.x * TS + ox, (p.y - 0.45) * TS + oy, info && info.host, '#fff'); if (p.hp < p.maxhp) hpBar(p.x * TS + ox, (p.y - 0.25) * TS + oy, p.hp / p.maxhp, TS * 1.1); }
    for (const a of (S.arrows || [])) { const ang = Math.atan2(a[3], a[2]); g.save(); g.translate(a[0] * TS + ox, a[1] * TS + oy); g.rotate(ang); g.fillStyle = '#c9a66b'; g.fillRect(-TS * 0.4, -1, TS * 0.8, Math.max(2, TS / 14)); g.fillStyle = '#d8dde6'; g.fillRect(TS * 0.4, -TS * 0.07, TS * 0.14, TS * 0.14); g.fillStyle = '#e8e8f0'; g.fillRect(-TS * 0.45, -TS * 0.07, TS * 0.12, TS * 0.14); g.restore(); }
    g.save(); for (const l of (S.lines || [])) { const pl = l[0] === S.id ? S.me : S.players.get(l[0]); if (!pl) continue; const hx = (pl.x + (pl.f || 1) * 0.55) * TS + ox, hy = (pl.y + 0.1) * TS + oy, bob = Math.sin(performance.now() / 260) * (l[3] ? 0.12 : 0.04), bx = l[1] * TS + ox, by = (l[2] + bob + (l[3] ? 0.1 : 0)) * TS + oy;
      g.strokeStyle = 'rgba(235,240,250,0.85)'; g.lineWidth = Math.max(1, TS / 16); g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo((hx + bx) / 2, Math.min(hy, by) - TS * 0.5, bx, by); g.stroke();
      g.fillStyle = '#e04040'; g.fillRect(bx - TS * 0.1, by - TS * 0.16, TS * 0.2, TS * 0.16); g.fillStyle = '#fff'; g.fillRect(bx - TS * 0.1, by, TS * 0.2, TS * 0.1);
      if (l[3]) { g.fillStyle = '#ff5a4a'; g.font = 'bold ' + Math.round(TS * 0.9) + 'px sans-serif'; g.textAlign = 'center'; g.fillText('!', bx, by - TS * 0.5); } } g.restore();
    for (const o of S.mobs.values()) if (o.hp < o.maxhp) hpBar(o.x * TS + ox, (o.y - 0.35) * TS + oy, o.hp / o.maxhp, TS * 0.9);
    g.font = `bold ${Math.round(TS * 0.45)}px monospace`;
    for (const tx of S.texts) { const k = tx.life / tx.max; g.globalAlpha = Math.min(1, k * 2); g.fillStyle = '#000'; g.fillText(tx.txt, tx.x * TS + ox + 1, tx.y * TS + oy + 1); g.fillStyle = tx.c; g.fillText(tx.txt, tx.x * TS + ox, tx.y * TS + oy); g.globalAlpha = 1; }
    g.textAlign = 'left';
    return { ox, oy };
  }
  function hpBar(x, y, k, w) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 6); g.fillStyle = k > 0.5 ? '#6ee86e' : k > 0.25 ? '#f0c040' : '#ee4a4a'; g.fillRect(x - w / 2, y, w * k, 4); }
  function ambientFx(dt) {
    const m = S.me; if (!m) return; const b = biome[Math.max(0, Math.min(W - 1, Math.floor(m.x)))], depth = m.y - surf[Math.floor(Math.max(0, Math.min(W - 1, m.x)))], night = S.D < 0.5;
    if (depth < 6 && b === 2 && Math.random() < dt * 40) S.particles.push({ x: S.cam.x + (Math.random() - 0.3) * S.cw / S.TS, y: S.cam.y - S.ch / S.TS / 2 - 1, vx: -0.8 + Math.random() * 0.6, vy: 2 + Math.random() * 2, life: 5, max: 5, c: [255, 255, 255], size: 3, grav: 0, snow: true });
    if (depth < 6 && b === 1 && Math.random() < dt * 8) S.particles.push({ x: S.cam.x - S.cw / S.TS / 2, y: S.cam.y + (Math.random() - 0.2) * S.ch / S.TS / 2, vx: 7 + Math.random() * 4, vy: (Math.random() - 0.5), life: 4, max: 4, c: [226, 200, 140], size: 2, grav: 0 });
    if (depth < 6 && (b === 0 || b === 5 || b === 3) && night && Math.random() < dt * (b === 5 ? 6 : 3)) S.particles.push({ x: S.cam.x + (Math.random() - 0.5) * S.cw / S.TS, y: S.cam.y + (Math.random() - 0.2) * S.ch / S.TS / 2, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, life: 5, max: 5, c: [220, 255, 120], size: 3, grav: 0, glow: [0.7, 0.9, 0.3] });
    if (depth < 6 && !night && (b === 3 || b === 0) && S.rain < 0.3 && Math.random() < dt * (b === 3 ? 0.9 : 0.35)) { const cols = [[255, 190, 80], [250, 120, 160], [140, 190, 255], [255, 250, 150]]; S.particles.push({ x: S.cam.x + (Math.random() - 0.5) * S.cw / S.TS, y: m.y - 1 + Math.random() * 2, vx: (Math.random() - 0.5), vy: 0, life: 9, max: 9, c: cols[(Math.random() * 4) | 0], size: 3, grav: 0, wob: true }); }
    if (depth < 6 && b === 0 && !night && Math.random() < dt * 1.2) S.particles.push({ x: S.cam.x + (Math.random() - 0.5) * S.cw / S.TS, y: S.cam.y - S.ch / S.TS / 2, vx: 0.4, vy: 1, life: 8, max: 8, c: [[120, 190, 70], [220, 190, 60], [200, 110, 50]][(Math.random() * 3) | 0], size: 3, grav: 0, wob: true });
    if (depth < 8 && b === 4 && Math.random() < dt * 5) S.particles.push({ x: S.cam.x - S.cw / S.TS / 2, y: S.cam.y + (Math.random() - 0.5) * S.ch / S.TS / 2, vx: 6 + Math.random() * 4, vy: 0.5 + Math.random(), life: 4, max: 4, c: [240, 245, 255], size: 2, grav: 0 });
    if (depth > 10 && Math.random() < dt * 4) S.particles.push({ x: S.cam.x + (Math.random() - 0.5) * S.cw / S.TS, y: S.cam.y + (Math.random() - 0.5) * S.ch / S.TS, vx: (Math.random() - 0.5) * 0.3, vy: -0.2 - Math.random() * 0.3, life: 4, max: 4, c: [200, 190, 220], size: 2, grav: 0 });
    for (let i = 0; i < 0; i++);
  }

  // ---------------------------------------------------------------- weather
  function drawWeather(dt) {
    const m = S.me, { cw, ch, TS, dpr } = S, bx = Math.max(0, Math.min(W - 1, Math.floor(m.x))), b = biome[bx];
    const open = m.y <= top[bx] + 2 ? 1 : 0; S.wx = (S.wx || 0) + (S.rain * open - (S.wx || 0)) * Math.min(1, dt * 1.5);
    const snowy = b === 2 || (b === 4 && surf[bx] < H * 0.3 - 24), desert = b === 1, t = S.clock; Sound.setContext({ rain: desert ? 0 : S.wx * (snowy ? 0.3 : 1) });
    S.sx = (S.sx || 0) + (open * (snowy ? 0.4 + S.rain * 0.6 : 0) - (S.sx || 0)) * Math.min(1, dt * 1.2);
    if (S.wx > 0.02 && !desert) {
      g.fillStyle = `rgba(28,38,64,${S.wx * 0.2})`; g.fillRect(0, 0, cw, ch);
      if (!snowy) {
        g.strokeStyle = 'rgba(190,212,255,0.5)'; g.lineWidth = Math.max(1, dpr); g.beginPath(); const n = Math.floor(S.wx * (cw * ch) / (dpr * dpr) / 5200);
        for (let i = 0; i < n; i++) { const x = ((i * 97.31 + t * 120 * (1 + (i % 3) * 0.1)) % (cw + 40)) - 20, y = ((i * 53.17 + t * (780 + (i % 5) * 80)) % (ch + 40)) - 20; g.moveTo(x, y); g.lineTo(x - 5 * dpr, y + 14 * dpr); }
        g.stroke();
        for (let i = 0; i < 2 * S.wx; i++) { const x = Math.floor(S.cam.x + (Math.random() - 0.5) * cw / TS); if (x >= 0 && x < W && top[x] > 0) part(x + Math.random(), top[x] - 0.05, (Math.random() - 0.5) * 1.5, -1.5 - Math.random(), 0.25, [200, 225, 255], 2, 1); }
        if (S.rain > 0.75 && Math.random() < dt * 0.06) { S.lightning = 1; setTimeout(() => Sound.play('thunder'), 500 + Math.random() * 900); }
      }
    }
    if (S.sx > 0.02) { g.fillStyle = 'rgba(255,255,255,0.9)'; const n = Math.floor(S.sx * 130 * (cw * ch) / (1280 * 720 * dpr * dpr)); for (let i = 0; i < n; i++) { const x = ((i * 71.7 + t * (20 + (i % 4) * 8) + Math.sin(t + i) * 18) % (cw + 20)) - 10, y = ((i * 41.3 + t * (60 + (i % 5) * 22)) % (ch + 20)) - 10; const sz = (1 + (i % 3 === 0 ? 1 : 0)) * dpr; g.fillRect(x, y, sz * 1.6, sz * 1.6); } }
    if (desert && S.rain > 0.3 && open) { g.fillStyle = `rgba(214,170,100,${Math.min(0.3, S.rain * 0.3)})`; g.fillRect(0, 0, cw, ch); g.fillStyle = 'rgba(230,200,140,0.5)'; for (let i = 0; i < 70; i++) { const x = ((i * 131 + t * 600) % (cw + 80)) - 40, y = (i * 61.7) % ch; g.fillRect(x, y, 26 * dpr, dpr); } }
    if (b === 5 && open) { for (let i = 0; i < 3; i++) { const y = ch * (0.55 + i * 0.12), off = Math.sin(t * 0.2 + i * 2) * 80; const gr = g.createLinearGradient(0, y - 40, 0, y + 40); gr.addColorStop(0, 'rgba(190,215,195,0)'); gr.addColorStop(0.5, `rgba(190,215,195,${0.1 + S.rain * 0.05})`); gr.addColorStop(1, 'rgba(190,215,195,0)'); g.fillStyle = gr; g.fillRect(off, y - 40, cw, 80); } }
    if (S.lightning > 0) { g.fillStyle = `rgba(235,240,255,${S.lightning * 0.55})`; g.fillRect(0, 0, cw, ch); S.lightning = Math.max(0, S.lightning - dt * 3.5); }
    // underwater tint + bubbles
    if (get(Math.floor(m.x), Math.floor(m.y + 0.3)) === T.WATER) { g.fillStyle = 'rgba(30,90,190,0.32)'; g.fillRect(0, 0, cw, ch); if (Math.random() < dt * 6) part(m.x + (Math.random() - 0.5) * 0.4, m.y + 0.2, 0, -2, 0.9, [210, 235, 255], 3, -0.3); }
  }

  // ---------------------------------------------------------------- main loop
  let raf = 0, last = 0;
  function resize() {
    S.dpr = Math.min(2, window.devicePixelRatio || 1); const w = window.innerWidth, h = window.innerHeight;
    cv.width = Math.floor(w * S.dpr); cv.height = Math.floor(h * S.dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; S.cw = cv.width; S.ch = cv.height;
    const z = Settings.d.zoom; let css = z === 'close' ? 48 : z === 'far' ? 24 : z === 'normal' ? 32 : (w >= 1500 ? 48 : w >= 700 ? 32 : 24);
    if (z === 'auto' && h < 460) css = Math.min(css, 24);
    S.TS = Math.max(16, Math.round(css * S.dpr));
  }
  window.addEventListener('resize', resize);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    if (!S.running || !tiles) { if (!S.running) { cancelAnimationFrame(raf); raf = 0; } return; }
    S.clock += dt; S.dt = dt; S.D = daylight(S.time);
    updateMe(dt); updateEntities(dt); ambientFx(dt);
    const m = S.me, k = Math.min(1, dt * 7);
    const lookX = m.f * Math.min(2.2, Math.abs(m.vx) * 0.3), lookY = Math.max(-1, Math.min(3, m.vy * 0.08));
    S.cam.x += (m.x + lookX - S.cam.x) * Math.min(1, dt * 4.5); S.cam.y += (m.y + 0.6 + lookY - S.cam.y) * Math.min(1, dt * 6);
    const hw = S.cw / S.TS / 2, hh = S.ch / S.TS / 2; S.cam.x = Math.max(hw - 2, Math.min(W - hw + 2, S.cam.x)); S.cam.y = Math.max(hh - 14, Math.min(H - hh + 1, S.cam.y));
    const bx = Math.max(0, Math.min(W - 1, Math.floor(m.x))); Sound.setContext({ day: S.D, depth: m.y - surf[bx], biome: biome[bx] });
    drawSky(S.time); const o = drawWorld();
    drawWeather(dt);
    if (S.flash > 0) { g.fillStyle = `rgba(200,20,30,${S.flash * 0.35})`; g.fillRect(0, 0, S.cw, S.ch); }
    if (!vignette || vignette.w !== S.cw || vignette.h !== S.ch) { vignette = document.createElement('canvas'); vignette.w = vignette.width = S.cw; vignette.h = vignette.height = S.ch; const vg = vignette.getContext('2d'); const gr = vg.createRadialGradient(S.cw / 2, S.ch / 2, Math.min(S.cw, S.ch) * 0.35, S.cw / 2, S.ch / 2, Math.max(S.cw, S.ch) * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,10,0.45)'); vg.fillStyle = gr; vg.fillRect(0, 0, S.cw, S.ch); }
    g.drawImage(vignette, 0, 0);
    UI.frame(dt);
  }
  // test/debug hooks
  window.__G = { Backup, leave, S, get: (x, y) => get(x, y), world: () => ({ W, H, tiles, biome, surf, top }), send };
  function setLook(l) { Settings.d.look = l; Settings.save(); S._myLook = null; send({ t: 'look', look: l }); }
  return { Backup, S, setLook, create, join, leave, send, setSel, url, httpBase, resize, get, keys, nm, daylight };
})();
