'use strict';
const { T, I, ITEMS } = require('../public/js/defs.js');

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash2(x, y, s) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct) {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += vnoise(x * f, y * f, s + i * 101) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}

const slot = (id, n) => [id, n, ITEMS[id] && ITEMS[id].dur ? ITEMS[id].dur : 0];

function makeLoot(rnd, depthF) {
  const table = [
    [I.APPLE, 2, 5, 0], [I.COOKED_MEAT, 2, 4, 0], [T.TORCH, 10, 20, 0], [I.POTION, 1, 2, 0], [I.COPPER_BAR, 4, 9, 0],
    [T.PLANKS, 15, 30, 0], [I.IRON_BAR, 3, 8, 0.2], [I.GOLD_BAR, 2, 6, 0.4], [T.CRYSTAL, 4, 10, 0.4], [I.GEL, 3, 8, 0],
  ];
  const out = [];
  const n = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const e = table[Math.floor(rnd() * table.length)];
    if (depthF < e[3]) { i--; if (rnd() < 0.3) break; continue; }
    out.push(slot(e[0], e[1] + Math.floor(rnd() * (e[2] - e[1] + 1))));
  }
  if (rnd() < 0.35) {
    const rare = [I.AMULET, I.GOLD_HELM, I.IRON_HELM, I.IRON_PICK, I.COPPER_MAIL, I.IRON_MAIL, I.CRYSTAL_BLADE];
    const pick = depthF > 0.5 ? rare : rare.slice(0, 5);
    out.push(slot(pick[Math.floor(rnd() * pick.length)], 1));
  }
  return out;
}

function generate(seed, W, H) {
  const S = seed | 0, rnd = mulberry32(S ^ 0x5bd1e995);
  const tiles = new Uint8Array(W * H), biome = new Uint8Array(W), surf = new Int16Array(W);
  const chests = {};
  const idx = (x, y) => y * W + x;
  const cx = W >> 1;

  // ---- biomes: 0 forest, 1 desert, 2 snow, 3 plains, 4 mountain, 5 swamp (forest is always at spawn)
  const FOREST = 0, DESERT = 1, SNOW = 2, PLAINS = 3, MOUNTAIN = 4, SWAMP = 5;
  const flip = rnd() < 0.5;
  const order = flip ? [DESERT, SWAMP, FOREST, PLAINS, MOUNTAIN, SNOW] : [SNOW, MOUNTAIN, PLAINS, FOREST, SWAMP, DESERT];
  const fr = flip ? [0.25, 0.38, 0.60, 0.72, 0.87] : [0.13, 0.28, 0.40, 0.62, 0.75];
  const bounds = fr.map((f) => Math.floor(W * (f + (rnd() - 0.5) * 0.03)));
  for (let x = 0; x < W; x++) {
    const xx = x + (fbm(x / 14, 3.3, S + 7, 2) - 0.5) * 26; let k = 0; while (k < 5 && xx > bounds[k]) k++;
    biome[x] = order[k];
  }

  // ---- terrain height
  const base = Math.floor(H * 0.3);
  const AMP = [1.0, 0.6, 1.5, 0.45, 2.3, 0.22], LIFT = [0, 0, -5, 0, -30, 6];
  const ampRaw = new Float32Array(W), liftRaw = new Float32Array(W);
  for (let x = 0; x < W; x++) { const b = biome[x]; ampRaw[x] = AMP[b] * Math.min(1, 0.3 + Math.abs(x - cx) / 90); liftRaw[x] = LIFT[b]; }
  const amp = new Float32Array(W), lift = new Float32Array(W);
  for (let x = 0; x < W; x++) { let s1 = 0, s2 = 0, c = 0; for (let k = -14; k <= 14; k++) { const xx = x + k; if (xx >= 0 && xx < W) { s1 += ampRaw[xx]; s2 += liftRaw[xx]; c++; } } amp[x] = s1 / c; lift[x] = s2 / c; }
  const hs = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    hs[x] = base + lift[x] + (fbm(x / 90, 0.5, S + 1, 2) - 0.5) * 2 * 22 * amp[x] + (fbm(x / 24, 9.1, S + 2, 2) - 0.5) * 2 * 5 * amp[x]
      + (biome[x] === DESERT ? Math.sin(x / 7 + fbm(x / 40, 1, S + 4, 1) * 6) * 1.6 : 0)
      + (biome[x] === MOUNTAIN ? (fbm(x / 11, 4.4, S + 6, 2) - 0.5) * 14 : 0);
  }
  // smooth transitions + flat spawn platform
  const flatY = hs[cx];
  for (let x = 0; x < W; x++) {
    const d = Math.abs(x - cx);
    let h = hs[x];
    if (d < 22) { const t = d <= 9 ? 1 : 1 - (d - 9) / 13; const s2 = t * t * (3 - 2 * t); h = h + (flatY - h) * s2; }
    surf[x] = Math.max(16, Math.min(Math.floor(H * 0.5), Math.round(h)));
  }
  // ponds (adjust heights before layering)
  const ponds = [];
  const pondCount = Math.floor(W / 110);
  for (let k = 0; k < pondCount; k++) {
    const xc = 30 + Math.floor(rnd() * (W - 60)); const b = biome[xc];
    if (Math.abs(xc - cx) < 26 || (b === DESERT && rnd() < 0.6) || b === MOUNTAIN) continue;
    if (ponds.some((p) => Math.abs(p.x - xc) < 30)) continue;
    const w = 5 + Math.floor(rnd() * 5), lvl = surf[xc];
    for (let dx = -w - 4; dx <= w + 4; dx++) {
      const x = xc + dx; if (x < 1 || x >= W - 1) continue;
      const t = Math.min(1, Math.max(0, (w + 4 - Math.abs(dx)) / 4)); const s = t * t * (3 - 2 * t);
      surf[x] = Math.round(surf[x] + (lvl - surf[x]) * s);
    }
    ponds.push({ x: xc, w, lvl, b });
  }

  for (let x = 12; x < W - 12; x += 26) { // swamps are full of shallow pools
    if (biome[x] !== SWAMP || ponds.some((p) => Math.abs(p.x - x) < 14)) continue;
    const xc = x + Math.floor(rnd() * 8), w = 4 + Math.floor(rnd() * 5), lvl = surf[xc];
    for (let dx = -w - 3; dx <= w + 3; dx++) { const xx = xc + dx; if (xx < 1 || xx >= W - 1) continue; const t = Math.min(1, Math.max(0, (w + 3 - Math.abs(dx)) / 3)); surf[xx] = Math.round(surf[xx] + (lvl - surf[xx]) * t * t * (3 - 2 * t)); }
    ponds.push({ x: xc, w, lvl, b: SWAMP });
  }

  // ---- layers
  const peak = base - 24;
  for (let x = 0; x < W; x++) {
    const b = biome[x], s = surf[x];
    const dirtD = 4 + Math.floor(fbm(x / 9, 2, S + 3, 2) * 5);
    const sandD = 24 + Math.floor(fbm(x / 12, 5, S + 5, 2) * 14);
    const slate = (y) => y > s + (H - s) * (0.46 + (fbm(x / 14, y / 10, S + 21, 2) - 0.5) * 0.12);
    for (let y = s; y < H; y++) {
      const d = y - s; let t = T.STONE;
      if (b === FOREST) t = d === 0 ? T.GRASS : d < dirtD ? T.DIRT : T.STONE;
      else if (b === PLAINS) t = d === 0 ? T.GRASS : d < 3 + (dirtD >> 2) ? T.DIRT : T.STONE;
      else if (b === SWAMP) t = d < 2 ? T.MUD : d < dirtD + 2 ? T.DIRT : T.STONE;
      else if (b === DESERT) t = d < 7 ? T.SAND : d < sandD ? T.SANDSTONE : T.STONE;
      else if (b === SNOW) t = d < 2 ? T.SNOW : d < dirtD + 1 ? T.DIRT : T.STONE;
      else { // mountain: bare rock, snowy peaks, grassy foothills
        if (s < peak) t = d < 2 ? T.SNOW : T.STONE; else if (s > base - 10) t = d === 0 ? T.GRASS : d < 3 ? T.DIRT : T.STONE; else t = T.STONE;
      }
      if (t === T.STONE && slate(y)) t = T.SLATE;
      if (y >= H - 3) t = T.BEDROCK;
      tiles[idx(x, y)] = t;
    }
    if (b === SNOW || (b === MOUNTAIN && s < peak + 8)) for (let y = s + 8; y < Math.min(H - 4, s + 90); y++) {
      if ((tiles[idx(x, y)] === T.STONE) && fbm(x / 9, y / 8, S + 9, 2) > 0.64) tiles[idx(x, y)] = T.ICE;
    }
  }

  // ---- caves
  for (let y = 8; y < H - 4; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y), v = tiles[i]; if (v === T.AIR || v === T.BEDROCK) continue;
    const d = y - surf[x]; if (d < 8) continue;
    const df = Math.min(1, d / 170), th = 0.045 + 0.03 * df;
    const n1 = Math.abs(fbm(x / 30, y / 22, S + 11, 2) - 0.5);
    let air = false;
    if (n1 < th) { const n2 = Math.abs(fbm(x / 30 + 77, y / 22 + 13, S + 12, 2) - 0.5); air = n2 < th; }
    if (!air) air = fbm(x / 52, y / 36, S + 13, 2) > (d < 40 ? 0.78 : 0.70);
    if (air) tiles[i] = T.AIR;
  }
  const carve = (x0, y0, r) => {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = x0 + dx, y = y0 + dy; if (x < 1 || x >= W - 1 || y < 1 || y >= H - 4) continue;
      const v = tiles[idx(x, y)]; if (v !== T.BEDROCK && v !== T.WATER) tiles[idx(x, y)] = T.AIR;
    }
  };
  // cave mouths / shafts from the surface
  const shafts = Math.floor(W / 65);
  for (let k = 0; k < shafts; k++) {
    let x = 12 + rnd() * (W - 24); if (Math.abs(x - cx) < 16) continue;
    let y = surf[Math.floor(x)] - 1, len = 28 + rnd() * 50, dir = (rnd() - 0.5) * 1.6;
    for (let s = 0; s < len; s++) {
      carve(Math.floor(x), Math.floor(y), 1.4 + rnd() * 1.0);
      x += dir + (rnd() - 0.5) * 1.4; y += 0.9; dir *= 0.97; dir += (rnd() - 0.5) * 0.3;
    }
  }

  // winding worm tunnels linking everything together
  const worms = Math.floor(W / 17);
  for (let k = 0; k < worms; k++) {
    let x = 10 + rnd() * (W - 20); let y = surf[Math.floor(x)] + 14 + rnd() * (H - surf[Math.floor(x)] - 30);
    let ang = rnd() * Math.PI * 2, len = 70 + rnd() * 200, r = 1.3 + rnd() * 1.6;
    for (let s = 0; s < len; s++) {
      carve(Math.floor(x), Math.floor(y), r + Math.sin(s / 9) * 0.5);
      ang += (rnd() - 0.5) * 0.55; ang *= 0.98; if (Math.abs(Math.sin(ang)) > 0.85) ang *= 0.8;
      x += Math.cos(ang) * 1.1; y += Math.sin(ang) * 0.8;
      if (x < 6 || x > W - 6 || y < surf[Math.floor(x)] + 10 || y > H - 8) break;
    }
  }

  // ---- ores
  const area = W * H;
  const blob = (x0, y0, id, r) => {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const dd = Math.sqrt(dx * dx + dy * dy); if (dd > r + rnd() * 0.6 - 0.3) continue;
      const x = x0 + dx, y = y0 + dy; if (x < 1 || x >= W - 1 || y < 1 || y >= H - 4) continue;
      const v = tiles[idx(x, y)]; if (v === T.STONE || v === T.SLATE || v === T.SANDSTONE || (v === T.DIRT && id === T.COPPER)) tiles[idx(x, y)] = id;
    }
  };
  const scatter = (count, id, minD, maxD, rmin, rmax, biomeBoost) => {
    for (let k = 0; k < count; k++) {
      const x = Math.floor(rnd() * W), d = minD + rnd() * (maxD - minD), y = Math.floor(surf[x] + d);
      if (y >= H - 5) continue;
      const boost = biomeBoost && biomeBoost[biome[x]];
      if (boost !== undefined && rnd() > boost) continue;
      blob(x, y, id, rmin + rnd() * (rmax - rmin));
    }
  };
  scatter(Math.floor(area / 1300), T.COPPER, 6, 130, 1.6, 3.2);
  scatter(Math.floor(area / 2300), T.IRON, 38, 200, 1.6, 3.0);
  scatter(Math.floor(area / 5200), T.GOLD, 90, 260, 1.4, 2.5, { 0: 0.8, 1: 1, 2: 0.8, 3: 0.8, 4: 1, 5: 0.7 });
  scatter(Math.floor(area / 4500), T.GOLD, 70, 260, 1.4, 2.4, { 0: 0, 1: 1, 2: 0, 3: 0, 4: 0, 5: 0 }); // desert bonus gold

  // glowing crystals embedded in cave walls
  const hasAirNb = (x, y) => tiles[idx(x - 1, y)] === T.AIR || tiles[idx(x + 1, y)] === T.AIR || tiles[idx(x, y - 1)] === T.AIR || tiles[idx(x, y + 1)] === T.AIR;
  for (let y = 40; y < H - 6; y++) for (let x = 3; x < W - 3; x++) {
    const v = tiles[idx(x, y)]; if (!(v === T.STONE || v === T.SLATE || v === T.ICE || v === T.SANDSTONE)) continue;
    if (y - surf[x] < 45 || !hasAirNb(x, y)) continue;
    if (rnd() > (biome[x] === SNOW || biome[x] === MOUNTAIN ? 0.02 : 0.008)) continue;
    tiles[idx(x, y)] = T.CRYSTAL;
    for (let j = 0; j < 5; j++) {
      const xx = x + Math.floor((rnd() - 0.5) * 5), yy = y + Math.floor((rnd() - 0.5) * 5);
      const w2 = tiles[idx(xx, yy)];
      if ((w2 === T.STONE || w2 === T.SLATE || w2 === T.ICE) && hasAirNb(xx, yy)) tiles[idx(xx, yy)] = T.CRYSTAL;
    }
  }

  // ---- water: underground lakes
  const lakeTries = Math.floor(area / 4500);
  let lakes = 0;
  for (let k = 0; k < lakeTries && lakes < W / 60; k++) {
    const x0 = 20 + Math.floor(rnd() * (W - 40)), y0 = Math.floor(surf[x0] + 30 + rnd() * (H - surf[x0] - 70));
    if (y0 >= H - 8 || tiles[idx(x0, y0)] !== T.AIR || tiles[idx(x0, y0 + 1)] === T.AIR) continue;
    const seen = new Set([y0 * W + x0]), q = [[x0, y0]]; let ok = true;
    for (let qi = 0; qi < q.length; qi++) {
      const [x, y] = q[qi];
      if (Math.abs(x - x0) > 22 || y > y0 + 6 || q.length > 420) { ok = false; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy, key = ny * W + nx;
        if (nx < 1 || nx >= W - 1 || ny >= H - 4 || seen.has(key)) continue;
        if (tiles[key] === T.AIR) { seen.add(key); q.push([nx, ny]); }
      }
    }
    if (!ok || q.length < 14) continue;
    for (const [x, y] of q) tiles[idx(x, y)] = T.WATER;
    lakes++;
  }
  // surface ponds
  for (const p of ponds) {
    for (let dx = -p.w; dx <= p.w; dx++) {
      const x = p.x + dx, t = 1 - (dx / p.w) * (dx / p.w), depth = Math.max(1, Math.round(t * 3.6));
      for (let k = 0; k < depth; k++) tiles[idx(x, p.lvl + k)] = T.WATER;
      if (p.b === SNOW) tiles[idx(x, p.lvl)] = T.ICE; // frozen over
      if (p.lvl + depth < H) { const below = tiles[idx(x, p.lvl + depth)]; if (below === T.GRASS || below === T.STONE) tiles[idx(x, p.lvl + depth)] = p.b === SWAMP ? T.MUD : T.DIRT; }
    }
    surfOverride(p);
  }
  function surfOverride(p) { for (let dx = -p.w; dx <= p.w; dx++) surf[p.x + dx] = p.lvl; }

  // ---- vegetation & surface decoration
  const inPond = (x) => ponds.some((p) => Math.abs(p.x - x) <= p.w);
  const setIf = (x, y, v) => { if (x > 0 && x < W - 1 && y > 0 && tiles[idx(x, y)] === T.AIR) tiles[idx(x, y)] = v; };
  const trunk = (x, y, h) => { for (let k = 1; k <= h; k++) tiles[idx(x, y - k)] = T.LOG; };
  const blobLeaves = (cxx, cyy, rx, ry, leaf) => { for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) { const e = (dx * dx) / (rx * rx + 0.3) + (dy * dy) / (ry * ry + 0.3); if (e <= 1.05 && (rnd() > 0.1 || e < 0.5)) setIf(cxx + dx, cyy + dy, leaf); } };
  function oak(x, y, kind, leaf) {
    if (kind === 0) { const h = 4 + Math.floor(rnd() * 3); trunk(x, y, h); blobLeaves(x, y - h - 1, 2, 2, leaf); }
    else if (kind === 1) { const h = 6 + Math.floor(rnd() * 4); trunk(x, y, h); blobLeaves(x, y - h - 1, 4, 3, leaf); blobLeaves(x - 3, y - h + 1, 2, 1, leaf); blobLeaves(x + 3, y - h + 1, 2, 1, leaf); setIf(x - 1, y - h + 1, T.AIR); tiles[idx(x - 1, y - 3)] = rnd() < 0.5 ? T.LOG : T.AIR; }
    else { const h = 8 + Math.floor(rnd() * 4); trunk(x, y, h); blobLeaves(x, y - h - 2, 2, 4, leaf); }
  }
  function pine(x, y, h) { trunk(x, y, h); for (let r = 0; r < h - 1; r++) { const half = Math.min(3, 1 + Math.floor(r / 2)); const ly = y - h - 1 + r + 1; if (ly >= y - 1) break; for (let dx = -half; dx <= half; dx++) if (!(dx === 0 && ly >= y - h)) setIf(x + dx, ly, T.PINE); } setIf(x, y - h - 1, T.PINE); setIf(x, y - h - 2, T.PINE); }
  function willow(x, y, h) { trunk(x, y, h); blobLeaves(x, y - h, 3, 2, T.WILLOW); for (const dx of [-3, -2, 2, 3, -1, 1]) { const len = 2 + Math.floor(rnd() * 3); for (let k = 1; k <= len; k++) setIf(x + dx, y - h + 2 + k - 1, T.WILLOW); } }
  let lastTree = -10;
  for (let x = 3; x < W - 3; x++) {
    const b = biome[x], y = surf[x], here = tiles[idx(x, y)]; if (here === T.WATER || here === T.ICE && inPond(x)) continue;
    const nearSpawn = Math.abs(x - cx) < 9, r = rnd(), above = tiles[idx(x, y - 1)] === T.AIR;
    const space = x - lastTree > 4;
    if (b === FOREST && here === T.GRASS) {
      if (!nearSpawn && space && r < 0.22) { lastTree = x; const k = rnd(); oak(x, y, k < 0.45 ? 0 : k < 0.8 ? 1 : 2, T.LEAVES); }
      else if (above) { const q = rnd(); if (q < 0.4) tiles[idx(x, y - 1)] = T.PLANT; else if (q < 0.47) tiles[idx(x, y - 1)] = T.BUSH; else if (q < 0.5) tiles[idx(x, y - 1)] = T.MUSHROOM; else if (q < 0.53) tiles[idx(x, y - 1)] = T.ROCK; }
    } else if (b === PLAINS && here === T.GRASS) {
      if (!nearSpawn && x - lastTree > 11 && r < 0.045) { lastTree = x; oak(x, y, 0, T.MAPLE); }
      else if (above) { const q = rnd(); if (q < 0.62) tiles[idx(x, y - 1)] = T.PLANT; else if (q < 0.72) tiles[idx(x, y - 1)] = T.BUSH; else if (q < 0.75) tiles[idx(x, y - 1)] = T.ROCK; }
    } else if (b === SWAMP && (here === T.MUD || here === T.DIRT)) {
      if (space && x - lastTree > 6 && r < 0.1) { lastTree = x; willow(x, y, 5 + Math.floor(rnd() * 3)); }
      else if (above) { const q = rnd(); if (q < 0.3) { const h = 2 + Math.floor(rnd() * 3); for (let k = 1; k <= h; k++) tiles[idx(x, y - k)] = T.REED; } else if (q < 0.38) tiles[idx(x, y - 1)] = T.MUSHROOM; else if (q < 0.43) tiles[idx(x, y - 1)] = T.BUSH; }
    } else if (b === SNOW && here === T.SNOW) {
      if (!nearSpawn && x - lastTree > 5 && r < 0.09) { lastTree = x; pine(x, y, 5 + Math.floor(rnd() * 5)); }
      else if (r < 0.15) { const h = 2 + Math.floor(rnd() * 5); for (let k = 1; k <= h; k++) tiles[idx(x, y - k)] = T.ICE; }
      else if (above && r < 0.19) tiles[idx(x, y - 1)] = T.ROCK;
    } else if (b === MOUNTAIN) {
      if ((here === T.GRASS || here === T.STONE) && x - lastTree > 6 && r < 0.035 && y > peak + 6) { lastTree = x; pine(x, y, 4 + Math.floor(rnd() * 4)); }
      else if (above && r < 0.09 && (here === T.STONE || here === T.GRASS || here === T.SNOW)) tiles[idx(x, y - 1)] = T.ROCK;
      else if (above && here === T.GRASS && r < 0.2) tiles[idx(x, y - 1)] = T.PLANT;
    } else if (b === DESERT && here === T.SAND) {
      if (!nearSpawn && x - lastTree > 5 && r < 0.08) { lastTree = x; const h = 3 + Math.floor(rnd() * 3); for (let k = 1; k <= h; k++) tiles[idx(x, y - k)] = T.CACTUS; if (h >= 4 && rnd() < 0.7) { const ax = rnd() < 0.5 ? -1 : 1, ay = y - 2; setIf(x + ax, ay, T.CACTUS); setIf(x + ax, ay - 1, T.CACTUS); } }
      else if (above) { const q = rnd(); if (q < 0.07) tiles[idx(x, y - 1)] = T.PLANT; else if (q < 0.1) tiles[idx(x, y - 1)] = T.ROCK; }
    }
  }
  // glowing mushrooms on cave floors
  for (let y = 40; y < H - 6; y++) for (let x = 3; x < W - 3; x++) if (tiles[idx(x, y)] === T.AIR && y - surf[x] > 30 && D_isFloor(x, y) && rnd() < 0.012) tiles[idx(x, y)] = T.MUSHROOM;
  function D_isFloor(x, y) { const b = tiles[idx(x, y + 1)]; return b !== T.AIR && b !== T.WATER && b !== T.MUSHROOM && b !== T.TORCH && b !== T.CHEST && b !== 0 && tiles[idx(x, y - 1)] === T.AIR; }

  // ---- surface cabins (plains/forest) and abandoned mine tunnels
  const structures = [];
  for (let k = 0; k < W / 160; k++) {
    const x0 = 30 + Math.floor(rnd() * (W - 60)); if (Math.abs(x0 - cx) < 25 || (biome[x0] !== PLAINS && biome[x0] !== FOREST)) continue;
    let ok = true, ys = surf[x0]; for (let dx = 0; dx < 8; dx++) { if (Math.abs(surf[x0 + dx] - ys) > 1 || tiles[idx(x0 + dx, surf[x0 + dx])] === T.WATER) ok = false; } if (!ok) continue;
    for (let dy = 1; dy <= 6; dy++) for (let dx = 0; dx < 8; dx++) tiles[idx(x0 + dx, ys - dy)] = T.AIR;
    for (let dx = 0; dx < 8; dx++) { tiles[idx(x0 + dx, ys - 6)] = T.PLANKS; tiles[idx(x0 + dx, ys)] = tiles[idx(x0 + dx, ys)] === T.GRASS ? T.PLANKS : tiles[idx(x0 + dx, ys)]; }
    for (let dy = 1; dy <= 5; dy++) { tiles[idx(x0, ys - dy)] = T.PLANKS; tiles[idx(x0 + 7, ys - dy)] = T.PLANKS; }
    tiles[idx(x0, ys - 1)] = T.AIR; tiles[idx(x0, ys - 2)] = T.AIR; // doorway
    tiles[idx(x0 + 5, ys - 1)] = T.CHEST; chests[(x0 + 5) + ',' + (ys - 1)] = makeLoot(rnd, 0.05); tiles[idx(x0 + 3, ys - 4)] = T.TORCH; tiles[idx(x0 + 2, ys - 1)] = T.BENCH;
    structures.push({ type: 'cabin', x: x0, y: ys });
  }
  for (let k = 0, made2 = 0; k < 60 && made2 < Math.max(1, W / 260); k++) {
    const len = 28 + Math.floor(rnd() * 24), x0 = 20 + Math.floor(rnd() * (W - 60 - len)), y0 = Math.floor(surf[x0] + 40 + rnd() * (H - surf[x0] - 80));
    if (y0 + 5 >= H - 4) continue;
    for (let x = x0; x < x0 + len; x++) for (let y = y0 - 3; y < y0; y++) if (tiles[idx(x, y)] !== T.WATER) tiles[idx(x, y)] = T.AIR;
    for (let x = x0; x < x0 + len; x++) { if (tiles[idx(x, y0)] === T.AIR) tiles[idx(x, y0)] = T.PLANKS; if ((x - x0) % 7 === 3) { for (let y = y0 - 3; y < y0; y++) tiles[idx(x, y)] = (y === y0 - 3 || (x - x0) % 14 === 3 && y === y0 - 1) ? T.PLANKS : tiles[idx(x, y)]; if ((x - x0) % 14 === 10 && tiles[idx(x, y0 - 2)] === T.AIR) tiles[idx(x, y0 - 2)] = T.TORCH; } }
    const cxm = x0 + len - 2; tiles[idx(cxm, y0 - 1)] = T.CHEST; chests[cxm + ',' + (y0 - 1)] = makeLoot(rnd, Math.min(1, (y0 - surf[x0]) / (H - surf[x0]) + 0.2));
    structures.push({ type: 'mine', x: x0, y: y0 }); made2++;
  }

  // ---- hidden treasure rooms
  const roomCount = Math.floor(W / 85); let made = 0;
  for (let k = 0; k < roomCount * 4 && made < roomCount; k++) {
    const rw = 9 + Math.floor(rnd() * 5), rh = 5 + Math.floor(rnd() * 2);
    const x0 = 12 + Math.floor(rnd() * (W - 24 - rw)); const y0 = Math.floor(surf[x0] + 60 + rnd() * (H - surf[x0] - 95));
    if (y0 + rh + 2 >= H - 4) continue;
    const depthF = Math.min(1, (y0 - surf[x0]) / (H - surf[x0]));
    for (let y = y0 - 1; y <= y0 + rh; y++) for (let x = x0 - 1; x <= x0 + rw; x++) {
      const edge = y === y0 - 1 || y === y0 + rh || x === x0 - 1 || x === x0 + rw;
      tiles[idx(x, y)] = edge ? (y === y0 + rh ? T.PLANKS : T.STONE) : T.AIR;
    }
    const floorY = y0 + rh - 1;
    tiles[idx(x0 + (rw >> 1), floorY)] = T.CHEST;
    chests[(x0 + (rw >> 1)) + ',' + floorY] = makeLoot(rnd, depthF);
    tiles[idx(x0 + 1, floorY)] = T.TORCH; tiles[idx(x0 + rw - 2, floorY)] = T.TORCH;
    tiles[idx(x0, y0)] = T.CRYSTAL; tiles[idx(x0 + rw - 1, y0)] = T.CRYSTAL; tiles[idx(x0 + (rw >> 1), y0)] = T.CRYSTAL;
    made++;
  }

  // ---- bedrock floor, spawn
  for (let x = 0; x < W; x++) for (let y = H - 3; y < H; y++) tiles[idx(x, y)] = T.BEDROCK;
  for (let y = 0; y < H; y++) { if (tiles[idx(0, y)] === T.AIR && y > surf[0]) tiles[idx(0, y)] = T.STONE; if (tiles[idx(W - 1, y)] === T.AIR && y > surf[W - 1]) tiles[idx(W - 1, y)] = T.STONE; }
  const spawn = { x: cx + 0.5, y: surf[cx] - 1.8 };
  return { tiles, biome, surf, chests, spawn, structures };
}

module.exports = { generate, mulberry32, fbm };
