/* WILDERLAND UI: menus, character creator, HUD, inventory/crafting/chests, chat, settings, touch controls. */
const UI = (() => {
  const { T, I, ITEMS, C, RECIPES, BLOCKS } = DEFS;
  const $ = (id) => document.getElementById(id);
  const S = Game.S;
  const TIPS = ['Punch trees for logs, then craft a Workbench.', 'Night brings zombies — build a shelter before dark.', 'Crystals glow in the dark: great for lighting caves.', 'Right-click a Chest to open it. Mine it to get your stuff back.', 'Better pickaxes unlock rarer ores. Copper → Iron → Gold → Crystal.', 'Press Tab to see everyone in your world.', 'Furnaces smelt ore into bars. Place one next to a Workbench.', 'Invite friends with your 5-letter room code!', 'Craft a Bed and right-click it: set your spawn by day, skip the night by sleeping.'];
  const state = { invOpen: false, pauseOpen: false, held: null, drag: null, sel: -1, chatOpen: false, lastChat: 0, hotT: 0, clockT: 0 };

  // ------------------------------------------------------------ screens
  function go(name) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === 's-' + name)); if (name === 'worlds') refreshWorlds(); if (name === 'char') buildChar($('char-opts'), previewDraw); if (name === 'settings') buildSettings($('set-body')); if (name === 'main') refreshWho(); Sound.play('click'); }
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  function err(msg) {
    hideLoading(); const e = document.createElement('div'); e.textContent = msg; e.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);background:#a8283a;border:2px solid #ff8a98;padding:8px 16px;border-radius:3px;z-index:99;max-width:90vw';
    document.body.appendChild(e); setTimeout(() => e.remove(), 4500);
  }
  function showLoading(msg, pct) { const l = $('loading'); l.classList.add('on'); $('load-msg').textContent = msg; $('load-fill').style.width = Math.round((pct || 0) * 100) + '%'; if (!$('load-tip').textContent) $('load-tip').textContent = 'Tip: ' + TIPS[Math.floor(Math.random() * TIPS.length)]; }
  function hideLoading() { $('loading').classList.remove('on'); $('load-tip').textContent = ''; }

  // ------------------------------------------------------------ worlds
  async function refreshWorlds() {
    const list = JSON.parse(localStorage.getItem('wl_worlds') || '[]'), el = $('world-list'); el.innerHTML = '';
    if (!list.length) { el.innerHTML = '<em>No worlds yet — create one!</em>'; return; }
    for (const w of list) {
      const d = document.createElement('div'); d.className = 'wi'; d.innerHTML = `<div><b></b><small></small></div><span class="st"></span>`; d.querySelector('b').textContent = w.name; d.querySelector('small').textContent = w.code + ' · ' + new Date(w.last).toLocaleDateString();
      d.onclick = () => joinCode(w.code); el.appendChild(d);
      const dl = document.createElement('button'); dl.textContent = '⬇'; dl.title = 'Download backup file'; dl.className = 'dlb'; dl.onclick = async (ev) => { ev.stopPropagation(); try { await Game.Backup.download(w.code); } catch (e) { err('No backup available yet'); } }; d.appendChild(dl);
      fetch(Game.httpBase() + '/api/world/' + w.code).then((r) => r.ok ? r.json() : null).then((i) => { const s = d.querySelector('.st'); if (!i) { Game.Backup.get(w.code).then((bk) => { s.textContent = bk ? 'restore ⟳' : 'offline?'; }); return; } s.textContent = i.online ? `● ${i.online}/${i.max} online` : 'saved'; if (i.online) s.classList.add('on'); }).catch(() => { d.querySelector('.st').textContent = 'offline?'; });
    }
  }
  async function joinCode(code) {
    code = (code || '').trim().toUpperCase(); if (code.length < 3) return err('Enter a room code');
    try { await Game.join(code); } catch (e) {
      if (/No world/.test(e.message) && await Game.Backup.get(code)) { try { await Game.Backup.restore(code); await Game.join(code); return; } catch (e2) { err(e2.message); return; } }
      err(e.message);
    }
  }
  $('btn-bk-file').onclick = () => $('bk-file').click();
  $('bk-file').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const d = await Game.Backup.fromFile(f); joinCode(d.code); } catch (x) { err(x.message || 'Could not restore'); } };
  $('btn-join').onclick = () => joinCode($('join-code').value);
  $('join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinCode($('join-code').value); });
  $('btn-create').onclick = async () => {
    try { await Game.create({ name: $('cw-name').value.trim() || 'My World', size: $('cw-size').value, difficulty: $('cw-diff').value, mobs: $('cw-mobs').checked, seed: parseInt($('cw-seed').value, 10) || 0 }); } catch (e) { err(e.message); }
  };

  // ------------------------------------------------------------ character creator
  const OPTS = [['skin', 'Skin', 6, 'skin'], ['hairStyle', 'Hair style', 6], ['hair', 'Hair colour', 10, 'hair'], ['shirt', 'Shirt', 12, 'shirt'], ['pants', 'Pants', 8, 'pants'], ['accent', 'Belt / trim colour', 8, 'accent']];
  const curLook = () => Object.assign({ skin: 1, hairStyle: 0, hair: 0, shirt: 5, pants: 0, accent: 0 }, Settings.d.look || {});
  function buildChar(root, onChange) {
    root.innerHTML = '';
    for (const [key, label, n, pal] of OPTS) {
      const grp = document.createElement('div'); grp.className = 'grp'; grp.innerHTML = `<span>${label}</span><div class="sw"></div>`; const sw = grp.querySelector('.sw');
      for (let i = 0; i < n; i++) {
        let el; if (pal) { el = document.createElement('i'); el.style.background = `rgb(${Gfx.PAL[pal][i].join(',')})`; } else { el = document.createElement('button'); el.textContent = ['Swept', 'Short', 'Long', 'Tuft', 'Bushy', 'Bald'][i]; }
        if (curLook()[key] === i) el.classList.add('on');
        el.onclick = () => { const l = curLook(); l[key] = i; applyLook(l); sw.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); el.classList.add('on'); onChange && onChange(); Sound.play('click'); };
        sw.appendChild(el);
      }
      root.appendChild(grp);
    }
  }
  function applyLook(l) { Settings.d.look = l; Settings.save(); if (S.running) Game.setLook(l); refreshWho(); }
  $('char-rand').onclick = () => { applyLook({ skin: rnd(6), hairStyle: rnd(6), hair: rnd(10), shirt: rnd(12), pants: rnd(8), accent: rnd(8) }); buildChar($('char-opts'), previewDraw); Sound.play('click'); };
  const rnd = (n) => Math.floor(Math.random() * n);
  $('char-name').addEventListener('input', (e) => { Settings.d.name = e.target.value.replace(/[^\w \-.]/g, '').slice(0, 14); Settings.save(); refreshWho(); });
  function drawChar(cv, u, bx, by, t, extra) { const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false; Gfx.drawPlayer(g, bx, by, u, Object.assign({ look: Gfx.playerLook(curLook()), f: 1, t, walk: 0, air: false, swing: -1, held: 0 }, extra)); }
  function previewDraw() { const cv = $('char-prev'); const t = performance.now() / 1000; drawChar(cv, 8, cv.width / 2, 300, t, { walk: Math.sin(t * 0.8) > 0.6 ? 1 : 0, f: Math.sin(t * 0.4) > 0 ? 1 : -1, held: Math.sin(t * 0.8) > 0.2 ? I.IRON_PICK : 0, swing: Math.sin(t * 0.8) > 0.2 ? (t * 2) % 1 : -1 }); }
  function refreshWho() { $('who-name').textContent = Settings.d.name || 'Wanderer'; drawChar($('mini'), 2.2, 32, 90, 0); }
  setInterval(() => { if ($('s-char').classList.contains('on')) previewDraw(); }, 60);

  // ------------------------------------------------------------ settings (shared with pause menu)
  function buildSettings(root, inGame) {
    root.innerHTML = '';
    const row = (label, el) => { const r = document.createElement('div'); r.className = 'set-row'; r.innerHTML = `<span>${label}</span>`; r.appendChild(el); root.appendChild(r); };
    const slider = (key) => { const el = document.createElement('input'); el.type = 'range'; el.min = 0; el.max = 1; el.step = 0.05; el.value = Settings.d[key]; el.oninput = () => { Settings.d[key] = +el.value; Settings.save(); Sound.setVolumes({ master: Settings.d.master, sfx: Settings.d.sfx, music: Settings.d.music }); }; el.onchange = () => Sound.play('click'); return el; };
    const sel = (key, opts, after) => { const el = document.createElement('select'); for (const [v, l] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = l; el.appendChild(o); } el.value = Settings.d[key]; el.onchange = () => { Settings.d[key] = el.value; Settings.save(); after && after(); }; return el; };
    row('Master volume', slider('master')); row('Effects', slider('sfx')); row('Music', slider('music'));
    row('Zoom', sel('zoom', [['auto', 'Auto'], ['far', 'Far'], ['normal', 'Normal'], ['close', 'Close']], () => Game.resize()));
    row('Touch controls', sel('touch', [['auto', 'Auto'], ['on', 'Always on'], ['off', 'Off']], applyTouch));
    row('Lighting', sel('light', [['smooth', 'Smooth'], ['pixel', 'Blocky (faster)']]));
    const sh = document.createElement('input'); sh.type = 'checkbox'; sh.checked = Settings.d.shake; sh.style.width = 'auto'; sh.onchange = () => { Settings.d.shake = sh.checked; Settings.save(); }; row('Screen shake', sh);
    if (!inGame) { const sv = document.createElement('input'); sv.value = Settings.d.server; sv.placeholder = 'same host (default) or my-server.onrender.com'; sv.oninput = () => { Settings.d.server = sv.value.trim(); Settings.save(); }; row('Game server', sv); }
  }
  function applyTouch() { const on = Settings.d.touch === 'on' || (Settings.d.touch === 'auto' && (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window)); document.body.classList.toggle('touch', on); }

  // ------------------------------------------------------------ slots / inventory
  const itemName = (id) => ITEMS[id] ? ITEMS[id].name : '?';
  function slotEl(s, i, o = {}) {
    const d = document.createElement('div'); d.className = 'slot' + (o.cls ? ' ' + o.cls : ''); if (i !== undefined) d.dataset.i = i; if (o.eq) d.dataset.eq = o.eq; if (o.chest !== undefined) d.dataset.ch = o.chest;
    if (o.key) { const k = document.createElement('span'); k.className = 'k'; k.textContent = o.key; d.appendChild(k); }
    if (s) {
      const img = document.createElement('img'); img.src = Gfx.iconURL(s[0]); d.appendChild(img);
      if (s[1] > 1) { const n = document.createElement('span'); n.className = 'n'; n.textContent = s[1]; d.appendChild(n); }
      const it = ITEMS[s[0]]; if (it && it.dur) { const f = Math.max(0, s[2] / it.dur); const b = document.createElement('div'); b.className = 'd'; b.innerHTML = `<i style="width:${f * 100}%;background:${f > 0.5 ? '#6ee86e' : f > 0.2 ? '#f0c040' : '#ee4a4a'}"></i>`; d.appendChild(b); }
    }
    d.onmouseenter = (e) => showTip(s, e); d.onmousemove = (e) => moveTip(e); d.onmouseleave = hideTip; return d;
  }
  function tipHtml(s) {
    const it = ITEMS[s[0]]; let h = `<b>${it.name}</b>`;
    if (it.kind) h += `<small>${it.kind === 'sword' ? 'Weapon · ' + it.dmg + ' damage' : ({ pick: 'Pickaxe', axe: 'Axe', shovel: 'Shovel', rod: 'Fishing rod' }[it.kind]) + (it.kind === 'rod' ? '' : ' · ' + DEFS.TIER_NAMES[it.tier] + ' tier · speed ×' + it.speed)}</small>${it.kind === 'rod' ? '<small>Right-click water to cast, click again at the ! bite</small>' : ''}${it.kind === 'pick' ? `<small>Mines ${['', 'stone & slate', 'copper ore', 'iron ore & crystal', 'gold ore', 'everything'][it.tier]}</small>` : it.kind === 'axe' ? '<small>Fells trees · right-click a log to strip it</small>' : it.kind === 'shovel' ? '<small>Digs dirt, sand, clay & gravel fast</small>' : ''}<small>Durability ${s[2]}/${it.dur}</small>`;
    if (it.armor) h += `<small>${it.armor} slot${it.def ? ' · +' + it.def + ' defense' : ''}${it.hp ? ' · +' + it.hp + ' max HP' : ''}</small><small>Right-click to equip</small>`;
    if (it.heal) h += `<small>Heals ${it.heal} HP</small>`; if (it.block !== undefined) { const bl = BLOCKS[it.block]; h += `<small>Placeable${DEFS.SHAPE[it.block] ? ' ' + DEFS.SHAPE[it.block].kind.replace('stairR', 'stairs') : ' block'}${bl && bl.tier ? ' · mined with ' + DEFS.TIER_NAMES[bl.tier] + ' pickaxe+' : ''}</small>`; } return h;
  }
  const tip = $('tip');
  function showTip(s, e) { if (!s || state.drag) return; tip.innerHTML = tipHtml(s); tip.style.display = 'block'; moveTip(e); }
  function moveTip(e) { tip.style.left = Math.min(innerWidth - 230, e.clientX + 14) + 'px'; tip.style.top = Math.min(innerHeight - 90, e.clientY + 14) + 'px'; }
  function hideTip() { tip.style.display = 'none'; }

  function renderHotbar() {
    const hb = $('hotbar'); hb.innerHTML = '';
    for (let i = 0; i < C.HOTBAR; i++) {
      const d = slotEl(S.inv[i], i, { key: (i + 1) % 10, cls: i === S.sel ? 'sel' : '' });
      d.addEventListener('pointerdown', (e) => { if (state.invOpen) return; e.preventDefault(); e.stopPropagation(); Game.setSel(i); });
      hb.appendChild(d);
    }
    const s = S.inv[S.sel]; $('hotname').textContent = s ? itemName(s[0]) : ''; $('hotname').classList.add('on'); state.hotT = 2;
  }
  function renderInv() {
    const g = $('inv-grid'); g.innerHTML = '';
    for (let i = 0; i < C.INV; i++) { const d = slotEl(S.inv[i], i, { key: i < 10 ? (i + 1) % 10 : '', cls: (i === S.sel ? 'sel ' : '') + (state.held === i ? 'held' : '') }); wire(d, i); g.appendChild(d); }
    const eq = $('eq'); eq.innerHTML = '';
    for (const [k, lab] of [['head', 'Head'], ['body', 'Body'], ['charm', 'Charm']]) { const w = document.createElement('div'); w.className = 'eqs'; const d = slotEl(S.eq[k], undefined, { eq: k }); d.onclick = () => { if (state.held !== null) { Game.send({ t: 'equip', from: state.held }); state.held = null; } else if (S.eq[k]) Game.send({ t: 'unequip', slot: k }); Sound.play('click'); }; w.appendChild(d); w.insertAdjacentHTML('beforeend', `<div class="lab">${lab}</div>`); eq.appendChild(w); }
    $('statline').innerHTML = `❤ ${S.hp}/${S.maxhp}<br>🛡 Defense ${S.def}`;
    const cb = $('chest-box'); cb.classList.toggle('on', !!S.chest);
    if (S.chest) { const cg = $('chest-grid'); cg.innerHTML = ''; S.chest.slots.forEach((s, i) => { const d = slotEl(s, i, { chest: i }); d.onclick = () => { if (s) Game.send({ t: 'chestMove', x: S.chest.x, y: S.chest.y, from: 'chest', i }); Sound.play('click'); }; cg.appendChild(d); }); }
    renderRecipes();
  }
  $('sort-btn').onclick = () => { Game.send({ t: 'sort' }); Sound.play('click'); };
  function wire(d, i) {
    d.addEventListener('pointerdown', (e) => { if (e.button === 2) return; hideTip(); const s = S.inv[i]; state.drag = { i, x: e.clientX, y: e.clientY, moved: false, has: !!s }; });
    d.addEventListener('contextmenu', (e) => { e.preventDefault(); const s = S.inv[i]; if (s && ITEMS[s[0]].armor) Game.send({ t: 'equip', from: i }); else if (s && ITEMS[s[0]].heal) { Game.send({ t: 'sel', i: Math.min(i, 9) }); } });
  }
  const dragEl = $('drag');
  document.addEventListener('pointermove', (e) => {
    const d = state.drag; if (!d) return;
    if (!d.moved && d.has && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7) { d.moved = true; dragEl.src = ''; dragEl.style.display = 'block'; dragEl.style.background = `url(${Gfx.iconURL(S.inv[d.i][0])}) center/contain no-repeat`; }
    if (d.moved) { dragEl.style.left = e.clientX - 18 + 'px'; dragEl.style.top = e.clientY - 18 + 'px'; }
  });
  document.addEventListener('pointerup', (e) => {
    const d = state.drag; if (!d) return; state.drag = null; dragEl.style.display = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY), slot = target && target.closest && target.closest('.slot');
    if (d.moved) {
      if (slot && slot.dataset.i !== undefined && +slot.dataset.i !== d.i) Game.send({ t: 'swap', a: d.i, b: +slot.dataset.i });
      else if (slot && slot.dataset.eq) Game.send({ t: 'equip', from: d.i });
      else if (slot && slot.dataset.ch !== undefined && S.chest) Game.send({ t: 'chestMove', x: S.chest.x, y: S.chest.y, from: 'inv', i: d.i });
      else if (!target.closest('.panel')) Game.send({ t: 'drop', i: d.i, all: true });
      state.held = null; Sound.play('click'); return;
    }
    // click behaviour
    if (S.chest && S.inv[d.i]) { Game.send({ t: 'chestMove', x: S.chest.x, y: S.chest.y, from: 'inv', i: d.i }); Sound.play('click'); return; }
    if (state.held === null) { if (S.inv[d.i]) state.held = d.i; }
    else if (state.held === d.i) state.held = null;
    else { Game.send({ t: 'swap', a: state.held, b: d.i }); state.held = null; }
    if (d.i < 10) Game.setSel(d.i); Sound.play('click'); renderInv();
  });

  // crafting
  let selRecipe = -1;
  const count = (id) => { let c = 0; for (const s of S.inv) if (s && s[0] === id) c += s[1]; return c; };
  function near(tile) { const m = S.me; if (!m) return false; const cx = Math.floor(m.x), cy = Math.floor(m.y + 1); for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 6; x <= cx + 6; x++) if (Game.get(x, y) === tile) return true; return false; }
  const STN = { bench: [T.BENCH, 'a Workbench'], furnace: [T.FURNACE, 'a Furnace'], mason: [T.MASON, "a Mason's Table"] };
  let cat = 'all';
  function status(r) { const st = r.st === 'hand' ? true : near(STN[r.st][0]); const has = r.ing.every(([id, n]) => count(id) >= n); return { st, has, ok: st && has }; }
  function renderRecipes() {
    const el = $('recipes'); el.innerHTML = ''; const bench = near(T.BENCH), fur = near(T.FURNACE), mas = near(T.MASON);
    const tabs = $('rtabs'); tabs.innerHTML = ''; for (const [k, lab] of DEFS.CATS) { const b = document.createElement('button'); b.textContent = lab; b.className = k === cat ? 'on' : ''; b.onclick = () => { cat = k; renderRecipes(); Sound.play('click'); }; tabs.appendChild(b); }
    $('stations').innerHTML = `<span class="st ok">✋ Hand</span><span class="st ${bench ? 'ok' : ''}">🔨 Workbench</span><span class="st ${fur ? 'ok' : ''}">🔥 Furnace</span><span class="st ${mas ? 'ok' : ''}">🧱 Mason</span>`;
    const order = RECIPES.map((r, i) => ({ r, i, s: status(r) })).filter((o) => cat === 'all' || o.r.cat === cat).sort((a, b) => (b.s.ok - a.s.ok) || (a.i - b.i));
    for (const { r, i, s } of order) { const d = slotEl([r.out, r.n, 0], undefined, { cls: 'rc' + (s.ok ? '' : ' no') + (i === selRecipe ? ' sel' : '') }); d.onclick = () => { selRecipe = i; renderRecipes(); Sound.play('click'); }; d.onmouseenter = (e) => showTip([r.out, 1, ITEMS[r.out].dur || 0], e); el.appendChild(d); }
    const det = $('recipe-detail'); const r = RECIPES[selRecipe];
    if (!r) { det.innerHTML = '<small style="color:var(--mu)">Select a recipe. Items you can make now are listed first.</small>'; return; }
    const s = status(r); det.innerHTML = `<b>${itemName(r.out)}</b>${r.n > 1 ? ' ×' + r.n : ''} <small style="color:var(--mu)">needs ${r.st === 'hand' ? 'nothing' : STN[r.st][1]}${s.st ? '' : ' <span style="color:var(--bad)">(not nearby)</span>'}</small><div class="ing">${r.ing.map(([id, n]) => `<span class="${count(id) >= n ? '' : 'lack'}"><img src="${Gfx.iconURL(id)}"> ${itemName(id)} ${count(id)}/${n}</span>`).join('')}</div>`;
    const b = document.createElement('button'); b.className = 'pri'; b.textContent = 'Craft'; b.disabled = !s.ok; b.style.opacity = s.ok ? 1 : 0.4; b.onclick = () => Game.send({ t: 'craft', r: selRecipe }); det.appendChild(b);
  }

  // ------------------------------------------------------------ modals
  function openInventory() { if (state.invOpen) return; state.invOpen = true; $('inv').classList.add('on'); state.held = null; renderInv(); Sound.play('open'); }
  function closeInventory() { if (!state.invOpen) return; state.invOpen = false; $('inv').classList.remove('on'); state.held = null; hideTip(); if (S.chest) Game.send({ t: 'chestClose' }), S.chest = null; Sound.play('close'); }
  function toggleInventory() { state.invOpen ? closeInventory() : openInventory(); }
  function openPause() { state.pauseOpen = true; $('pause').classList.add('on'); buildPause(); Sound.play('open'); }
  function closePause() { state.pauseOpen = false; $('pause').classList.remove('on'); }
  function closeModals() { closeInventory(); closePause(); closeChat(); }
  function modalOpen() { return state.invOpen || state.pauseOpen; }
  function escape() { if (state.chatOpen) closeChat(); else if (modalOpen()) closeModals(); else openPause(); }
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
  $('inv').addEventListener('pointerdown', (e) => { if (e.target === $('inv')) closeInventory(); });
  $('pause').addEventListener('pointerdown', (e) => { if (e.target === $('pause')) closePause(); });
  function buildPause() {
    const b = $('pause-body'); b.innerHTML = '';
    const sec = (t) => b.insertAdjacentHTML('beforeend', `<div class="sec">${t}</div>`);
    const btn = (t, fn, cls) => { const x = document.createElement('button'); x.textContent = t; if (cls) x.className = cls; x.onclick = fn; b.appendChild(x); return x; };
    $('pause-title').textContent = S.wname;
    btn('▶ Resume', closePause, 'pri');
    btn(`📋 Invite friends — room ${S.code}`, copyInvite);
    sec('World'); const p = S.prog || {}; b.insertAdjacentHTML('beforeend', `<small style="color:var(--mu)">Nights survived ${p.nights || 0} · blocks mined ${p.mined || 0} · foes slain ${p.kills || 0} · difficulty ${S.settings.difficulty}</small>`);
    sec('Your character'); const cd = document.createElement('div'); cd.id = 'pause-char'; b.appendChild(cd); buildChar(cd, null);
    sec('Settings'); const sd = document.createElement('div'); b.appendChild(sd); buildSettings(sd, true);
    if (S.host) {
      sec('Host controls'); const h = document.createElement('div'); h.className = 'hostp'; b.appendChild(h);
      const hb = (t, fn) => { const x = document.createElement('button'); x.textContent = t; x.onclick = fn; h.appendChild(x); };
      hb('☀ Set day', () => Game.send({ t: 'host', op: 'time', v: 'day' })); hb('🌙 Set night', () => Game.send({ t: 'host', op: 'time', v: 'night' })); hb('🌧 Rain', () => Game.send({ t: 'host', op: 'weather', v: 'rain' })); hb('⛅ Clear', () => Game.send({ t: 'host', op: 'weather', v: 'clear' }));
      for (const d of ['easy', 'normal', 'hard']) hb(d, () => Game.send({ t: 'host', op: 'difficulty', v: d }));
      hb(S.settings.mobs ? '🚫 Monsters off' : '👾 Monsters on', () => Game.send({ t: 'host', op: 'mobs', v: !S.settings.mobs })); hb('🧹 Clear creatures', () => Game.send({ t: 'host', op: 'clearmobs' })); hb('💾 Save now', () => Game.send({ t: 'host', op: 'save' }));
      for (const q of S.plist) if (q.id !== S.id) { const r = document.createElement('div'); r.className = 'pk'; r.innerHTML = `<span></span>`; r.firstChild.textContent = q.name; const k = document.createElement('button'); k.textContent = 'Kick'; k.onclick = () => Game.send({ t: 'host', op: 'kick', id: q.id }); r.appendChild(k); b.appendChild(r); }
    }
    btn('🚪 Leave world', () => { closePause(); Game.leave(); }, '');
  }
  function copyInvite() { const base = location.origin + location.pathname + '?room=' + S.code + (Settings.d.server ? '&server=' + encodeURIComponent(Settings.d.server) : ''); (navigator.clipboard ? navigator.clipboard.writeText(base) : Promise.reject()).then(() => toast('Invite link copied!'), () => toast('Room code: ' + S.code)); }
  $('info-code').onclick = copyInvite;

  // ------------------------------------------------------------ chat / HUD
  function typing() { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'SELECT') && document.body.classList.contains('playing'); }
  function openChat() { state.chatOpen = true; $('chat').classList.add('open'); $('chat-in').focus(); }
  function closeChat() { state.chatOpen = false; $('chat').classList.remove('open'); $('chat-in').blur(); $('chat-in').value = ''; }
  $('chat-in').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { const v = $('chat-in').value.trim(); if (v) Game.send({ t: 'chat', m: v }); closeChat(); } else if (e.key === 'Escape') closeChat(); });
  function addMsg(html, cls) { const log = $('chat-log'); const d = document.createElement('div'); d.className = 'cm ' + (cls || ''); d.innerHTML = html; log.appendChild(d); while (log.children.length > 40) log.firstChild.remove(); setTimeout(() => d.classList.add('old'), 9000); }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function toast(m, ms = 2200) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; $('toasts').appendChild(t); setTimeout(() => t.remove(), ms); }
  function updatePlayers() {
    const el = $('plist'); el.innerHTML = '';
    for (const p of S.plist) { const d = document.createElement('div'); d.className = 'pl'; const cv = document.createElement('canvas'); cv.width = 20; cv.height = 30; const g = cv.getContext('2d'); Gfx.drawPlayer(g, 10, 29, 1, { look: Gfx.playerLook(p.look || p.id), f: 1, t: 0, walk: 0, air: false, swing: -1, held: 0 }); d.appendChild(cv); const n = document.createElement('span'); n.textContent = (p.host ? '★ ' : '') + p.name + (p.id === S.id ? ' (you)' : ''); d.appendChild(n); el.appendChild(d); }
    if (state.pauseOpen) buildPause();
  }
  function updateStat(lost) { $('hp-fill').style.width = (S.hp / S.maxhp * 100) + '%'; $('hp-txt').textContent = S.hp + ' / ' + S.maxhp; $('def').textContent = '🛡' + S.def; if (state.invOpen) $('statline').innerHTML = `❤ ${S.hp}/${S.maxhp}<br>🛡 Defense ${S.def}`; }
  function updateProg() { const p = S.prog || {}; $('info-prog').textContent = `Night ${(p.nights || 0) + 1} · ⛏ ${p.mined || 0}`; }
  function togglePlayers() {}
  function frame(dt) {
    state.clockT -= dt; if (state.clockT <= 0) { state.clockT = 0.5; const t = S.time; $('info-clock').textContent = t < 0.5 ? '☀ Day' : t < 0.6 ? '🌇 Dusk' : t < 0.92 ? '🌙 Night' : '🌅 Dawn'; }
    if (state.hotT > 0) { state.hotT -= dt; if (state.hotT <= 0) $('hotname').classList.remove('on'); }
  }

  // ------------------------------------------------------------ lifecycle callbacks
  function enter(w, isReconnect) {
    hideLoading(); document.body.classList.add('playing'); document.querySelectorAll('.screen').forEach((s) => s.classList.remove('on'));
    $('info-code').textContent = S.code; $('death').classList.remove('on'); closeModals();
    $('chat-log').innerHTML = ''; updatePlayers(); updateStat(); updateProg(); renderHotbar(); Sound.ensure(); Sound.setVolumes(Settings.d); applyTouch(); Game.resize();
    if (!isReconnect) { toast(w.returning ? `Welcome back to ${S.wname}!` : `Room code ${S.code} — share it with friends!`, 4000); Game.send({ t: 'sel', i: S.sel }); }
  }
  function left(silent) { document.body.classList.remove('playing'); closeModals(); hideLoading(); $('reconnect').classList.remove('on'); go('main'); }
  function updateInv() { renderHotbar(); if (state.invOpen) renderInv(); }
  function updateSel() { renderHotbar(); if (state.invOpen) renderInv(); }
  function chest() { if (S.chest) { if (!state.invOpen) openInventory(); else renderInv(); } else if (state.invOpen) renderInv(); }
  function dead(by) { $('death-by').textContent = `Slain by a ${by}`; $('death').classList.add('on'); closeModals(); }
  function sleeping(v) { $('sleepbar').classList.toggle('on', !!v); }
  $('wake-btn').onclick = () => { S.sleeping = false; sleeping(false); Game.send({ t: 'wake' }); };
  function respawned() { $('death').classList.remove('on'); }

  // touch controls
  const hold = (id, fn) => { const b = $(id); const on = (e) => { e.preventDefault(); Sound.ensure(); fn(true); }, off = (e) => { e.preventDefault(); fn(false); }; b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off); };
  hold('t-left', (v) => { S.input.left = v; }); hold('t-right', (v) => { S.input.right = v; }); hold('t-jump', (v) => { S.input.jump = v; });
  $('t-mode').addEventListener('pointerdown', (e) => { e.preventDefault(); S.touchMode = S.touchMode === 'mine' ? 'build' : 'mine'; $('t-mode').textContent = S.touchMode === 'mine' ? '⛏' : '▦'; $('t-mode').classList.toggle('build', S.touchMode === 'build'); });
  $('t-inv').addEventListener('pointerdown', (e) => { e.preventDefault(); toggleInventory(); }); $('t-chat').addEventListener('pointerdown', (e) => { e.preventDefault(); openChat(); }); $('t-menu').addEventListener('pointerdown', (e) => { e.preventDefault(); openPause(); });
  addEventListener('contextmenu', (e) => { if (!(e.target.tagName === 'INPUT')) e.preventDefault(); });

  // init
  Settings.d.name = Settings.d.name || ('Wanderer' + Math.floor(Math.random() * 900 + 100)); Settings.save();
  $('char-name').value = Settings.d.name; if (!Settings.d.look) { Settings.d.look = { skin: rnd(6), hairStyle: rnd(6), hair: rnd(10), shirt: rnd(12), pants: rnd(8), accent: rnd(8) }; Settings.save(); }
  Gfx.init(); refreshWho(); applyTouch();
  const q = new URLSearchParams(location.search); if (q.get('server')) { Settings.d.server = q.get('server'); Settings.save(); }
  if (q.get('room')) { go('worlds'); $('join-code').value = q.get('room').toUpperCase(); }
  addEventListener('beforeunload', () => {});
  return { sleeping, go, err, showLoading, hideLoading, enter, left, updateInv, updateSel, updateStat, updatePlayers, updateProg, chat: (n, m, id) => addMsg(`<b>${esc(n)}</b>: ${esc(m)}`), sys: (m) => addMsg(esc(m), 'sys'), toast, dead, respawned, chest, crafted: (id) => toast('Crafted ' + itemName(id)), hostSettings: () => { if (state.pauseOpen) buildPause(); }, reconnecting: (v) => $('reconnect').classList.toggle('on', v), error: err, typing, modalOpen, closeModals, toggleInventory, openInventory, escape, openChat, togglePlayers, frame };
})();
