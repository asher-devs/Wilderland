/* WILDERLAND procedural pixel art: tile atlas, item icons, character + creature drawing. No external assets. */
const Gfx = (() => {
  const { T, I, ITEMS } = DEFS;
  const TS = 16, VARS = 4;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const clamp = (v) => Math.max(0, Math.min(255, v | 0));
  const col = (c, d = 0) => `rgb(${clamp(c[0] + d)},${clamp(c[1] + d)},${clamp(c[2] + d)})`;
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  let atlas, atlasCtx, cracks, avg = {};
  const BG = { STONE: 24, SAND: 25, ICE: 26, DIRT: 27 };

  function pixel(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  function noiseFill(g, base, amt, r, x0 = 0, y0 = 0, w = TS, h = TS) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) pixel(g, x, y, col(base, (r() - 0.5) * amt));
  }
  function blob(g, cx, cy, rad, c, r) {
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad + (r() * 1.2 - 0.4) && cx + x >= 0 && cx + x < TS && cy + y >= 0 && cy + y < TS) pixel(g, cx + x, cy + y, col(c, (r() - 0.5) * 14));
  }
  function line(g, x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) pixel(g, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
  }
  function poly(g, pts, c) {
    let minx = 99, maxx = -99, miny = 99, maxy = -99; for (const p of pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
    for (let y = Math.floor(miny); y <= maxy; y++) for (let x = Math.floor(minx); x <= maxx; x++) {
      let inside = false; const px = x + 0.5, py = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (((a[1] > py) !== (b[1] > py)) && (px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside; }
      if (inside) pixel(g, x, y, c);
    }
  }

  const STONE = [112, 116, 126], DIRT = [124, 84, 50];
  function paintStone(g, r, base = STONE) {
    noiseFill(g, base, 20, r);
    for (let k = 0; k < 2; k++) { let x = (r() * 14) | 0, y = (r() * 14) | 0; for (let s = 0; s < 5; s++) { pixel(g, x, y, col(base, -34)); x += r() < 0.6 ? 1 : 0; y += r() < 0.6 ? 1 : -1; x = Math.max(0, Math.min(15, x)); y = Math.max(0, Math.min(15, y)); } }
    for (let i = 0; i < 6; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col(base, 22));
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 15, 16, 1); g.fillRect(15, 0, 1, 16);
  }
  function paintDirt(g, r) {
    noiseFill(g, DIRT, 22, r);
    for (let i = 0; i < 4; i++) blob(g, (r() * 16) | 0, (r() * 16) | 0, 1, [92, 60, 36], r);
    for (let i = 0; i < 8; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([156, 108, 66], (r() - 0.5) * 10));
  }
  const painters = {
    [T.GRASS](g, r) {
      paintDirt(g, r);
      for (let x = 0; x < 16; x++) {
        const h = 3 + ((r() * 2.4) | 0);
        for (let y = 0; y < h; y++) pixel(g, x, y, col(y === h - 1 ? [48, 124, 40] : [84, 176, 56], (r() - 0.5) * 22));
        if (r() < 0.35) pixel(g, x, 0, col([140, 214, 80]));
        if (r() < 0.25 && h > 3) pixel(g, x, h, col([62, 140, 44]));
      }
    },
    [T.DIRT]: paintDirt,
    [T.STONE]: paintStone,
    [T.LOG](g, r) {
      for (let x = 0; x < 16; x++) { const edge = x < 2 || x > 13, stripe = x % 4 === 1; for (let y = 0; y < 16; y++) pixel(g, x, y, col(edge ? [70, 44, 22] : stripe ? [88, 56, 28] : [122, 82, 42], (r() - 0.5) * 14)); }
      for (let i = 0; i < 3; i++) { const y = (r() * 14) | 0, x = 3 + ((r() * 9) | 0); pixel(g, x, y, col([60, 38, 20])); pixel(g, x + 1, y, col([60, 38, 20])); pixel(g, x, y + 1, col([60, 38, 20])); }
    },
    [T.SAND](g, r) { noiseFill(g, [228, 208, 142], 14, r); for (let i = 0; i < 10; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([200, 174, 108])); for (let i = 0; i < 4; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([246, 232, 176])); },
    [T.SNOW](g, r) { noiseFill(g, [238, 245, 252], 10, r); for (let x = 0; x < 16; x++) for (let y = 11; y < 16; y++) if (r() < 0.5) pixel(g, x, y, col([205, 224, 242], (r() - 0.5) * 10)); for (let i = 0; i < 4; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, '#fff'); },
    [T.SANDSTONE](g, r) { noiseFill(g, [206, 174, 110], 14, r); for (let y = 3; y < 16; y += 5) { g.fillStyle = 'rgba(150,110,60,0.35)'; g.fillRect(0, y, 16, 1); } for (let i = 0; i < 6; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([232, 204, 140])); },
    [T.ICE](g, r) {
      noiseFill(g, [146, 208, 240], 14, r); for (let i = 0; i < 3; i++) { const x = (r() * 12) | 0, y = (r() * 12) | 0; line(g, x, y + 4, x + 4, y, 'rgba(255,255,255,0.75)'); }
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 0, 16, 1); g.fillStyle = 'rgba(30,90,160,0.18)'; g.fillRect(0, 15, 16, 1);
    },
    [T.LEAVES](g, r) {
      const gs = [[40, 110, 38], [58, 146, 46], [32, 92, 34], [90, 176, 60]];
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (r() < 0.14) continue; pixel(g, x, y, col(gs[(r() * 4) | 0])); }
      for (let i = 0; i < 18; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([130, 206, 80]));
    },
    [T.CACTUS](g, r) {
      for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) { const edge = x < 3 || x > 12; const mid = x % 5 === 3; pixel(g, x, y, col(edge ? [32, 92, 46] : mid ? [44, 120, 58] : [66, 156, 76], (r() - 0.5) * 10)); }
      for (let i = 0; i < 9; i++) pixel(g, 4 + ((r() * 8) | 0), (r() * 16) | 0, col([232, 240, 196]));
      for (let y = 0; y < 16; y += 3) { pixel(g, 1, y, col([222, 232, 190])); pixel(g, 14, y + 1, col([222, 232, 190])); }
    },
    [T.PLANKS](g, r) {
      for (let row = 0; row < 4; row++) { const y0 = row * 4; for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) pixel(g, x, y0 + y, y === 3 ? col([112, 72, 34]) : col([182, 132, 70], (r() - 0.5) * 16 - (y === 0 ? -6 : 0))); const jx = (row * 5 + 3) % 16; for (let y = 0; y < 3; y++) pixel(g, jx, y0 + y, col([128, 86, 40])); pixel(g, (jx + 8) % 16, y0 + 1, col([90, 60, 30])); }
    },
    [T.COPPER](g, r) { paintStone(g, r); for (let i = 0; i < 3; i++) blob(g, 3 + ((r() * 10) | 0), 3 + ((r() * 10) | 0), 1 + ((r() * 1.5) | 0), [214, 120, 62], r); for (let i = 0; i < 4; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([112, 190, 150])); for (let i = 0; i < 3; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([255, 190, 120])); },
    [T.IRON](g, r) { paintStone(g, r); for (let i = 0; i < 3; i++) blob(g, 3 + ((r() * 10) | 0), 3 + ((r() * 10) | 0), 1 + ((r() * 1.5) | 0), [206, 182, 170], r); for (let i = 0; i < 4; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([150, 112, 100])); for (let i = 0; i < 2; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([250, 240, 235])); },
    [T.GOLD](g, r) { paintStone(g, r); for (let i = 0; i < 3; i++) blob(g, 3 + ((r() * 10) | 0), 3 + ((r() * 10) | 0), 1 + ((r() * 1.2) | 0), [248, 208, 60], r); for (let i = 0; i < 4; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([255, 248, 170])); },
    [T.CRYSTAL](g, r) {
      paintStone(g, r, [86, 84, 112]);
      const shards = 2 + ((r() * 2) | 0);
      for (let s = 0; s < shards; s++) {
        const cx = 3 + ((r() * 10) | 0), h = 5 + ((r() * 6) | 0), w = 1 + ((r() * 2) | 0), base = 15 - ((r() * 3) | 0);
        const hue = r() < 0.5 ? [116, 226, 255] : [196, 140, 255];
        for (let y = 0; y < h; y++) { const ww = w - (y > h - 3 ? 1 : 0); for (let x = -ww; x <= ww; x++) { const yy = base - y; if (yy < 0) continue; pixel(g, Math.min(15, Math.max(0, cx + x)), yy, col(hue, (x < 0 ? 24 : -18) + y * 3)); } }
        pixel(g, cx, base - h, '#fff');
      }
    },
    [T.BEDROCK](g, r) { noiseFill(g, [32, 30, 40], 22, r); for (let i = 0; i < 14; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([70, 60, 90])); },
    [T.BENCH](g, r) {
      g.fillStyle = col([120, 78, 38]); g.fillRect(1, 8, 3, 8); g.fillRect(12, 8, 3, 8); g.fillRect(3, 12, 10, 2);
      g.fillStyle = col([186, 134, 70]); g.fillRect(0, 5, 16, 4); g.fillStyle = col([220, 170, 100]); g.fillRect(0, 5, 16, 1); g.fillStyle = col([110, 70, 34]); g.fillRect(0, 9, 16, 1);
      g.fillStyle = col([170, 176, 190]); g.fillRect(3, 3, 6, 2); g.fillStyle = col([110, 70, 34]); g.fillRect(9, 2, 2, 3);
    },
    [T.FURNACE](g, r) {
      noiseFill(g, [128, 128, 136], 16, r, 0, 2, 16, 14); g.fillStyle = col([84, 84, 92]); g.fillRect(0, 2, 16, 2); g.fillRect(3, 0, 10, 3); g.fillStyle = col([60, 60, 68]); g.fillRect(6, -1, 4, 2);
      g.fillStyle = col([24, 20, 24]); g.fillRect(4, 7, 8, 7); g.fillStyle = col([240, 110, 20]); g.fillRect(5, 10, 6, 4); g.fillStyle = col([255, 200, 60]); g.fillRect(6, 11, 4, 3); g.fillStyle = '#fff6c0'; g.fillRect(7, 12, 2, 2);
    },
    [T.CHEST](g, r) {
      g.fillStyle = col([84, 50, 20]); g.fillRect(1, 5, 14, 11); g.fillStyle = col([160, 104, 44]); g.fillRect(2, 6, 12, 9); g.fillStyle = col([190, 130, 62]); g.fillRect(2, 6, 12, 2);
      g.fillStyle = col([84, 50, 20]); g.fillRect(2, 9, 12, 1); g.fillStyle = col([200, 204, 216]); g.fillRect(2, 5, 2, 11); g.fillRect(12, 5, 2, 11); g.fillStyle = col([252, 212, 70]); g.fillRect(7, 8, 2, 3); g.fillStyle = col([130, 90, 30]); g.fillRect(7, 10, 2, 1);
    },
    [T.TORCH](g) {
      g.fillStyle = col([128, 88, 44]); g.fillRect(7, 6, 2, 10); g.fillStyle = col([88, 56, 28]); g.fillRect(8, 6, 1, 10);
      g.fillStyle = col([246, 120, 28]); g.fillRect(6, 2, 4, 5); g.fillRect(7, 1, 2, 1); g.fillStyle = col([255, 206, 70]); g.fillRect(7, 3, 2, 3); g.fillStyle = '#fff8d0'; g.fillRect(7, 4, 1, 2);
    },
    [T.PLANT](g, r, v) {
      if (v === 3) { for (const [x0, x1] of [[4, 2], [8, 11], [8, 7]]) line(g, x0, 15, x1, 8 + ((r() * 3) | 0), col([140, 100, 56])); pixel(g, 11, 8, col([166, 124, 70])); return; }
      for (let i = 0; i < 6; i++) { const x = 2 + i * 2 + ((r() * 2) | 0), h = 4 + ((r() * 6) | 0); for (let y = 0; y < h; y++) pixel(g, x + (y > h - 3 ? (r() < 0.5 ? 0 : 1) : 0), 15 - y, col(y > h - 3 ? [130, 206, 76] : [64, 150, 52], (r() - 0.5) * 16)); }
      if (v === 1 || v === 2) { const c = v === 1 ? [238, 70, 90] : [255, 220, 70]; line(g, 8, 15, 8, 8, col([60, 140, 50])); for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) pixel(g, 8 + dx, 7 + dy, col(c)); pixel(g, 8, 7, '#fff3b0'); }
    },
    [T.SLATE](g, r) { paintStone(g, r, [66, 70, 88]); for (let i = 0; i < 3; i++) { const y = 3 + ((r() * 10) | 0); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y, 16, 1); } },
    [T.MUD](g, r) { noiseFill(g, [88, 70, 44], 18, r); for (let i = 0; i < 6; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([58, 46, 30])); for (let x = 0; x < 16; x++) if (r() < 0.6) pixel(g, x, 0, col([84, 110, 48], (r() - 0.5) * 20)); for (let i = 0; i < 3; i++) pixel(g, (r() * 16) | 0, 1 + ((r() * 4) | 0), col([120, 100, 70])); },
    [T.BUSH](g, r, v) { const c = [[44, 126, 52], [60, 150, 60], [34, 100, 46]]; for (let y = 6; y < 16; y++) for (let x = 0; x < 16; x++) { const dx = x - 7.5, dy = y - 12; if (dx * dx / 56 + dy * dy / 24 < 1 && r() > 0.08) pixel(g, x, y, col(c[(r() * 3) | 0])); } for (let i = 0; i < 5; i++) pixel(g, 2 + ((r() * 12) | 0), 7 + ((r() * 7) | 0), col([130, 206, 90])); if (v !== 1) for (let i = 0; i < 4; i++) pixel(g, 3 + ((r() * 10) | 0), 8 + ((r() * 6) | 0), v === 2 ? col([250, 210, 70]) : col([220, 50, 70])); },
    [T.ROCK](g, r, v) { const c = [[122, 124, 134], [96, 98, 108]]; const n = 1 + (v & 1); for (let k = 0; k < n; k++) { const cx = 5 + k * 5 + ((r() * 2) | 0), w = 3 + ((r() * 2) | 0); for (let y = 15 - w; y < 16; y++) for (let x = cx - w; x <= cx + w; x++) { const dx = x - cx, dy = y - 15; if (dx * dx / (w * w) + dy * dy / ((w - 1) * (w - 1)) < 1.05) pixel(g, Math.max(0, Math.min(15, x)), y, col(c[y < 15 - w + 2 ? 0 : 1], (r() - 0.5) * 16)); } pixel(g, cx - 1, 15 - w + 1, '#cfd2dc'); } },
    [T.MUSHROOM](g, r, v) { const cols = [[90, 210, 255], [190, 120, 255], [110, 255, 190], [255, 150, 200]][v]; for (const [x, h] of [[5, 4], [10, 6]]) { g.fillStyle = col([230, 226, 210]); g.fillRect(x, 16 - h, 2, h); g.fillStyle = col(cols); g.fillRect(x - 2, 16 - h - 2, 6, 2); g.fillRect(x - 1, 16 - h - 3, 4, 1); pixel(g, x - 1, 16 - h - 2, '#fff'); pixel(g, x + 2, 16 - h - 2, col(cols, -50)); } },
    [T.REED](g, r) { for (const x of [3, 7, 11]) { const h = 10 + ((r() * 5) | 0); for (let y = 0; y < h; y++) pixel(g, x + (y > h - 3 ? 0 : 0), 15 - y, col([104, 150, 60], (r() - 0.5) * 18)); g.fillStyle = col([110, 72, 36]); g.fillRect(x - 0, 15 - h, 2, 3); pixel(g, x + 1, 15 - h - 1, col([130, 90, 46])); } for (let i = 0; i < 4; i++) line(g, 8, 15, 2 + ((r() * 12) | 0), 8 + ((r() * 4) | 0), col([120, 168, 70])); },
    [T.PINE](g, r) { const gs = [[24, 84, 58], [34, 108, 70], [18, 66, 50], [60, 140, 92]]; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (r() < 0.12 + (x + y) % 2 * 0.06) continue; pixel(g, x, y, col(gs[(r() * 4) | 0])); } for (let i = 0; i < 10; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; line(g, x, y, x + 2, y + 2, col([80, 160, 110])); } },
    [T.WILLOW](g, r) { const gs = [[96, 126, 52], [120, 150, 60], [74, 100, 46], [150, 176, 80]]; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (r() < 0.18 + (x % 3 === 0 ? 0.15 : 0)) continue; pixel(g, x, y, col(gs[(r() * 4) | 0])); } for (let i = 0; i < 5; i++) { const x = (r() * 16) | 0; line(g, x, 4, x, 14, col([140, 170, 76])); } },
    [T.MAPLE](g, r) { const gs = [[96, 170, 52], [124, 192, 60], [78, 144, 46], [210, 170, 60], [226, 120, 50]]; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (r() < 0.14) continue; const k = r(); pixel(g, x, y, col(gs[k < 0.1 ? 4 : k < 0.2 ? 3 : (r() * 3) | 0])); } for (let i = 0; i < 14; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([164, 220, 90])); },
    [BG.STONE](g, r) { noiseFill(g, [52, 50, 62], 14, r); for (let i = 0; i < 5; i++) blob(g, (r() * 16) | 0, (r() * 16) | 0, 1, [40, 38, 50], r); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16); },
    [BG.SAND](g, r) { noiseFill(g, [100, 80, 52], 12, r); for (let y = 3; y < 16; y += 5) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y, 16, 1); } },
    [BG.ICE](g, r) { noiseFill(g, [52, 78, 102], 14, r); for (let i = 0; i < 3; i++) line(g, (r() * 12) | 0, (r() * 12) | 0 + 4, (r() * 12) | 0, (r() * 12) | 0, 'rgba(160,210,255,0.2)'); },
    [BG.DIRT](g, r) { noiseFill(g, [70, 48, 34], 14, r); for (let i = 0; i < 5; i++) blob(g, (r() * 16) | 0, (r() * 16) | 0, 1, [56, 38, 26], r); },
  };

  function buildAtlas() {
    atlas = mk(48 * TS, VARS * TS); atlasCtx = atlas.getContext('2d');
    for (const id of Object.keys(painters)) for (let v = 0; v < VARS; v++) {
      const c = mk(TS, TS), g = c.getContext('2d'); painters[id](g, rng(+id * 977 + v * 131 + 7), v);
      atlasCtx.drawImage(c, id * TS, v * TS);
      if (v === 0) { const d = g.getImageData(0, 0, TS, TS).data; let rr = 0, gg = 0, bb = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { rr += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++; } avg[id] = n ? [rr / n | 0, gg / n | 0, bb / n | 0] : [128, 128, 128]; }
    }
    cracks = mk(TS * 5, TS); const cg = cracks.getContext('2d'); const r = rng(99);
    for (let s = 0; s < 5; s++) { cg.save(); cg.translate(s * TS, 0); const n = 3 + s * 3; for (let k = 0; k < n; k++) { let x = 8 + ((r() - 0.5) * 6 | 0), y = 8 + ((r() - 0.5) * 6 | 0), a = r() * 6.28; for (let j = 0; j < 3 + s; j++) { pixel(cg, Math.max(0, Math.min(15, x | 0)), Math.max(0, Math.min(15, y | 0)), 'rgba(0,0,0,0.75)'); x += Math.cos(a); y += Math.sin(a); a += (r() - 0.5); } } cg.restore(); }
  }

  // ---- item icons
  const TIER = { 1: [[150, 100, 52], [206, 156, 86]], 2: [[134, 136, 146], [190, 192, 204]], 3: [[196, 100, 50], [244, 164, 96]], 4: [[176, 184, 198], [236, 240, 250]], 5: [[96, 210, 250], [220, 250, 255]] };
  const iconCache = {}, iconURLs = {};
  function paintIcon(g, id) {
    const it = ITEMS[id], r = rng(id * 31 + 5);
    if (it.block !== undefined) { g.drawImage(atlas, it.block * TS, 0, TS, TS, 0, 0, TS, TS); return; }
    const hand = [128, 86, 44];
    if (it.kind) {
      const [c, hl] = TIER[it.tier];
      if (it.kind === 'sword') {
        line(g, 3, 13, 6, 10, col(hand)); line(g, 2, 14, 3, 13, col([90, 58, 28]));
        for (let i = 0; i < 9; i++) { const x = 6 + i, y = 10 - i; pixel(g, x, y, col(c)); pixel(g, x + 1, y, col(hl)); pixel(g, x, y + 1, col(c, -30)); }
        pixel(g, 14, 2, col(hl)); pixel(g, 15, 1, col(hl));
        line(g, 4, 8, 8, 12, col([210, 170, 60])); line(g, 5, 8, 8, 11, col([160, 120, 40]));
        if (it.tier === 5) for (let i = 0; i < 4; i++) pixel(g, 7 + i * 2, 9 - i * 2 - 1, '#fff');
      } else {
        line(g, 2, 14, 11, 5, col(hand)); line(g, 3, 14, 12, 5, col(hand, -34));
        if (it.kind === 'pick') {
          for (let k = -5; k <= 4; k++) { const bulge = Math.round((1 - (k / 5) * (k / 5)) * 2.2); const x = 11 + k + 0, y = 5 + k - bulge + (k > 0 ? 0 : 0); pixel(g, x + 1, y - 1 + bulge * 0, col(hl)); pixel(g, x, y, col(c)); pixel(g, x, y + 1, col(c, -28)); }
        } else { poly(g, [[9, 2], [14, 3], [14, 9], [11, 8], [10, 6]], col(c)); line(g, 10, 3, 13, 4, col(hl)); line(g, 14, 4, 14, 8, col(c, -30)); }
      }
      return;
    }
    switch (id) {
      case I.COPPER_BAR: case I.IRON_BAR: case I.GOLD_BAR: {
        const c = id === I.COPPER_BAR ? [214, 120, 62] : id === I.IRON_BAR ? [196, 204, 214] : [250, 210, 64];
        poly(g, [[2, 10], [5, 6], [14, 6], [11, 10]], col(c, 30)); poly(g, [[2, 10], [11, 10], [11, 13], [2, 13]], col(c, -20)); poly(g, [[11, 10], [14, 6], [14, 9], [11, 13]], col(c, -50)); line(g, 6, 7, 12, 7, '#fff8');
        break; }
      case I.GEL: blob(g, 8, 9, 5, [90, 214, 120], r); for (const [x, y] of [[6, 7], [7, 7], [6, 8]]) pixel(g, x, y, 'rgba(255,255,255,0.9)'); line(g, 4, 13, 12, 13, 'rgba(40,140,70,0.9)'); break;
      case I.APPLE: blob(g, 8, 9, 5, [214, 38, 44], r); pixel(g, 6, 7, '#ff9a9a'); pixel(g, 6, 8, '#ff9a9a'); line(g, 8, 4, 9, 2, col([100, 64, 30])); poly(g, [[9, 3], [12, 2], [11, 5]], col([70, 170, 60])); break;
      case I.RAW_MEAT: case I.COOKED_MEAT: { const c = id === I.RAW_MEAT ? [226, 98, 110] : [150, 84, 44]; blob(g, 7, 9, 5, c, r); blob(g, 6, 8, 2, col(c, 40).match(/\d+/g).map(Number), r); line(g, 11, 5, 14, 2, '#f4efe2'); pixel(g, 14, 1, '#f4efe2'); pixel(g, 15, 2, '#f4efe2'); break; }
      case I.POTION: poly(g, [[6, 6], [10, 6], [13, 12], [11, 14], [5, 14], [3, 12]], col([226, 60, 110])); poly(g, [[6, 6], [10, 6], [10, 8], [6, 8]], col([216, 232, 240])); g.fillStyle = col([160, 110, 60]); g.fillRect(6, 3, 4, 3); pixel(g, 5, 11, '#ffc0d8'); pixel(g, 5, 10, '#ffc0d8'); pixel(g, 9, 11, '#fff'); break;
      case I.COPPER_HELM: case I.IRON_HELM: case I.GOLD_HELM: {
        const c = id === I.COPPER_HELM ? [210, 116, 60] : id === I.IRON_HELM ? [186, 194, 208] : [250, 208, 60];
        poly(g, [[3, 12], [3, 7], [5, 4], [11, 4], [13, 7], [13, 12], [11, 12], [11, 9], [5, 9], [5, 12]], col(c)); line(g, 5, 5, 10, 5, col(c, 50)); g.fillStyle = col(c, -50); g.fillRect(3, 11, 2, 2); g.fillRect(11, 11, 2, 2);
        if (id === I.GOLD_HELM) { pixel(g, 4, 3, col(c)); pixel(g, 8, 2, col(c)); pixel(g, 12, 3, col(c)); pixel(g, 8, 3, '#ff4060'); }
        break; }
      case I.COPPER_MAIL: case I.IRON_MAIL: case I.CRYSTAL_MAIL: {
        const c = id === I.COPPER_MAIL ? [210, 116, 60] : id === I.IRON_MAIL ? [186, 194, 208] : [110, 214, 250];
        poly(g, [[1, 5], [5, 3], [7, 5], [9, 5], [11, 3], [15, 5], [14, 9], [12, 8], [12, 14], [4, 14], [4, 8], [2, 9]], col(c)); line(g, 5, 6, 11, 6, col(c, 50)); line(g, 8, 6, 8, 13, col(c, -40)); for (let y = 8; y < 14; y += 2) line(g, 5, y, 11, y, col(c, -25));
        if (id === I.CRYSTAL_MAIL) pixel(g, 8, 9, '#fff');
        break; }
      case I.MUSHROOM: g.fillStyle = col([230, 226, 210]); g.fillRect(7, 8, 3, 6); g.fillStyle = col([90, 210, 255]); g.fillRect(3, 5, 11, 3); g.fillRect(5, 3, 7, 2); pixel(g, 5, 6, '#fff'); pixel(g, 10, 4, '#fff'); pixel(g, 11, 6, col([40, 120, 190])); break;
      case I.AMULET: line(g, 3, 2, 8, 9, col([200, 200, 212])); line(g, 13, 2, 8, 9, col([200, 200, 212])); poly(g, [[8, 8], [11, 11], [8, 15], [5, 11]], col([140, 120, 255])); poly(g, [[8, 8], [11, 11], [8, 11]], col([200, 240, 255])); pixel(g, 7, 10, '#fff'); break;
      default: blob(g, 8, 8, 5, [180, 180, 180], r);
    }
  }
  function icon(id) { if (!iconCache[id]) { const c = mk(TS, TS); paintIcon(c.getContext('2d'), id); iconCache[id] = c; } return iconCache[id]; }
  function iconURL(id) { return iconURLs[id] || (iconURLs[id] = icon(id).toDataURL()); }

  // ---- characters & creatures (drawn in screen space; u = screen px per sprite pixel)
  function hash(n) { return Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1; }
  const PAL = {
    skin: [[250, 218, 184], [240, 196, 152], [214, 160, 114], [176, 120, 80], [130, 88, 60], [92, 62, 44]],
    hair: [[52, 34, 22], [112, 70, 36], [214, 168, 70], [236, 220, 150], [168, 70, 40], [30, 30, 38], [200, 204, 214], [120, 60, 150], [60, 140, 200], [220, 90, 140]],
    shirt: [[214, 62, 62], [236, 130, 50], [236, 200, 60], [90, 176, 80], [50, 170, 150], [70, 130, 220], [110, 90, 210], [190, 90, 200], [236, 120, 170], [240, 240, 240], [70, 74, 90], [120, 84, 52]],
    pants: [[58, 68, 112], [40, 40, 52], [110, 80, 52], [70, 110, 70], [120, 60, 70], [150, 150, 160], [60, 90, 120], [90, 70, 110]],
    accent: [[255, 216, 90], [255, 120, 120], [120, 220, 255], [150, 255, 150], [255, 170, 255], [255, 255, 255], [255, 150, 60], [60, 60, 70]],
  };
  const DEFAULT_LOOK = { skin: 1, hairStyle: 0, hair: 0, shirt: 5, pants: 0, accent: 0 };
  function playerLook(l) {
    if (typeof l === 'number') l = { skin: Math.floor(hash(l + 1) * 6), hairStyle: Math.floor(hash(l + 21) * 6), hair: Math.floor(hash(l + 13) * 10), shirt: Math.floor(hash(l + 7) * 12), pants: Math.floor(hash(l + 3) * 8), accent: Math.floor(hash(l + 9) * 8) };
    l = Object.assign({}, DEFAULT_LOOK, l || {});
    return { skin: PAL.skin[l.skin] || PAL.skin[1], shirt: PAL.shirt[l.shirt] || PAL.shirt[5], hair: PAL.hair[l.hair] || PAL.hair[0], pants: PAL.pants[l.pants] || PAL.pants[0], accent: PAL.accent[l.accent] || PAL.accent[0], hairStyle: l.hairStyle | 0, raw: l };
  }
  function drawPlayer(g, cx, by, u, o) {
    const look = o.look; g.save(); g.translate(Math.round(cx), Math.round(by)); g.scale(o.f < 0 ? -1 : 1, 1);
    if (o.dead) { g.rotate(-1.5); g.translate(-u * 2, 0); }
    const t = o.t, walk = o.walk, air = o.air;
    const flash = o.hurt > 0 ? 0.55 : 0, f = (c, d = 0) => { const k = flash; return col([c[0] + (255 - c[0]) * k * 0.4 + 40 * k, c[1] * (1 - k * 0.5) + d, c[2] * (1 - k * 0.5) + d], d); };
    const bob = air ? 0 : (walk > 0.1 ? Math.abs(Math.sin(t * 11)) * -0.8 : Math.sin(t * 2.2) * -0.35);
    const phase = t * 11, ls = walk > 0.1 ? Math.sin(phase) * 0.75 : 0;
    const pants = look.pants || [60, 70, 110], shoe = [50, 40, 36];
    const limb = (x, y, ang, w, h, c, c2) => { g.save(); g.translate(x * u, y * u); g.rotate(ang); g.fillStyle = col(c); g.fillRect(-w / 2 * u, 0, w * u, h * u); if (c2) { g.fillStyle = col(c2); g.fillRect(-w / 2 * u, (h - 2) * u, (w + 0.6) * u, 2 * u); } g.restore(); };
    const hipY = -10 + bob * 0.5, shY = -19 + bob;
    // back arm + back leg
    limb(0.5, shY + 1, air ? -0.9 : -ls * 0.9 + 0.1, 2.6, 8, o.hurt > 0 ? [255, 160, 150] : look.skin.map((v) => v * 0.82));
    limb(0, hipY, air ? -0.5 : -ls, 3.2, 10, pants.map((v) => v * 0.8), shoe);
    // torso
    const shirt = o.body ? (o.body === I.COPPER_MAIL ? [210, 116, 60] : o.body === I.IRON_MAIL ? [186, 194, 208] : [110, 214, 250]) : look.shirt;
    g.fillStyle = f(shirt); g.fillRect(-3.2 * u, (shY) * u, 6.4 * u, 9.5 * u); g.fillStyle = col(shirt.map((v) => v * 0.78)); g.fillRect(-3.2 * u, (shY + 7) * u, 6.4 * u, 1.2 * u);
    if (o.body) { g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(-3.2 * u, shY * u, 6.4 * u, 1.2 * u); }
    // front leg
    limb(0, hipY, air ? 0.5 : ls, 3.4, 10, pants, shoe);
    // head
    const hy = shY - 8 + bob * 0.3;
    g.fillStyle = f(look.skin); g.fillRect(-3.8 * u, hy * u, 7.6 * u, 7.6 * u);
    g.fillStyle = col(look.hair); const hs = look.hairStyle;
    if (hs !== 5) g.fillRect(-4.2 * u, (hy - 1) * u, 8.4 * u, 3 * u);
    if (hs === 0) g.fillRect(-4.2 * u, hy * u, 2 * u, 6 * u);            // swept back
    else if (hs === 1) g.fillRect(-4.2 * u, hy * u, 1.4 * u, 4 * u);       // short
    else if (hs === 2) { g.fillRect(-4.6 * u, hy * u, 2.4 * u, 9 * u); g.fillRect(-4.2 * u, (hy - 1) * u, 8.4 * u, 2 * u); } // long
    else if (hs === 3) { g.fillRect(-1 * u, (hy - 3.5) * u, 2.2 * u, 3 * u); g.fillRect(-4.2 * u, hy * u, 1.4 * u, 3 * u); } // mohawk-ish tuft
    else if (hs === 4) { g.fillRect(-5 * u, (hy - 2) * u, 10 * u, 2.4 * u); g.fillRect(-4.6 * u, hy * u, 2 * u, 7 * u); g.fillRect(2.6 * u, hy * u, 2 * u, 4 * u); } // big/bushy
    else { g.fillRect(-3.8 * u, (hy - 0.4) * u, 7.6 * u, 1.2 * u); }        // bald with brow stubble
    g.fillStyle = col(look.accent); g.fillRect(-3.2 * u, (shY + 8) * u, 6.4 * u, 1.1 * u); // belt/accent trim shows team colour
    g.fillStyle = '#fff'; g.fillRect(0.8 * u, (hy + 3) * u, 2.2 * u, 2 * u); g.fillStyle = '#243'; g.fillRect(1.9 * u, (hy + 3.2) * u, 1.2 * u, 1.8 * u);
    if (o.head) {
      const c = o.head === I.COPPER_HELM ? [210, 116, 60] : o.head === I.IRON_HELM ? [186, 194, 208] : [250, 208, 60];
      g.fillStyle = col(c); g.fillRect(-4.6 * u, (hy - 1.4) * u, 9.2 * u, 3.4 * u); g.fillRect(-4.6 * u, hy * u, 1.6 * u, 5 * u); g.fillStyle = col(c, 60); g.fillRect(-4 * u, (hy - 1.4) * u, 7 * u, 0.9 * u);
      if (o.head === I.GOLD_HELM) { g.fillStyle = '#ff4060'; g.fillRect(-0.5 * u, (hy - 2.6) * u, 1.4 * u, 1.4 * u); }
    }
    // front arm with held item
    let ang = air ? -0.4 : ls * 0.9 - 0.1;
    const holding = o.held && ITEMS[o.held];
    if (o.swing >= 0) ang = -2.2 + o.swing * 3.4; else if (holding && holding.kind) ang = air ? -0.9 : -0.55 + ls * 0.3;
    g.save(); g.translate(0.5 * u, (shY + 1.2) * u); g.rotate(ang);
    g.fillStyle = f(shirt.map((v) => v * 0.9)); g.fillRect(-1.3 * u, 0, 2.6 * u, 4 * u); g.fillStyle = f(look.skin); g.fillRect(-1.3 * u, 4 * u, 2.6 * u, 4 * u);
    if (holding) {
      g.translate(0, 7 * u);
      if (holding.kind) { g.rotate(Math.PI * 0.75 - 0.35); g.imageSmoothingEnabled = false; const s = 16 * u * 0.95; g.drawImage(icon(o.held), -0.55 * s, -0.72 * s, s, s); }
      else { g.rotate(-0.4); g.imageSmoothingEnabled = false; const s = 9 * u; g.drawImage(icon(o.held), -0.2 * s, -0.5 * s, s, s); }
    }
    g.restore(); g.restore();
  }

  function drawMob(g, type, cx, by, u, o) {
    g.save(); g.translate(Math.round(cx), Math.round(by)); g.scale(o.f < 0 ? -1 : 1, 1); const t = o.t, hurt = o.hurt;
    const C = (c) => (hurt ? col([255, 255, 255], 0) : col(c)); const R = (x, y, w, h, c) => { g.fillStyle = C(c); g.fillRect(x * u, y * u, w * u, h * u); };
    switch (type) {
      case 'rabbit': { const hop = o.air ? -2 : 0; R(-4, -6 + hop, 9, 6, [214, 200, 184]); R(2, -9 + hop, 4, 4, [224, 210, 196]); R(3, -14 + hop, 1.5, 5, [214, 200, 184]); R(5, -13.5 + hop, 1.5, 4.5, [200, 186, 170]); R(-5.5, -4 + hop, 2, 2.5, [255, 255, 255]); R(4.5, -8 + hop, 1, 1, [30, 20, 20]); R(5.8, -7 + hop, 1, 1, [236, 140, 150]); break; }
      case 'slime': { const sq = o.air ? 1.25 : 1 + Math.sin(t * 5) * 0.06; const w = 15 / sq, h = 10 * sq; g.fillStyle = hurt ? '#fff' : 'rgba(70,200,110,0.9)'; g.beginPath(); g.ellipse(0, -h * u / 2, w * u / 2, h * u / 2, 0, 0, 7); g.fill(); g.fillStyle = hurt ? '#fff' : 'rgba(150,255,180,0.7)'; g.beginPath(); g.ellipse(-w * u * 0.18, -h * u * 0.65, w * u * 0.18, h * u * 0.14, 0, 0, 7); g.fill(); R(-3, -h * 0.55, 1.6, 2, [20, 60, 30]); R(2, -h * 0.55, 1.6, 2, [20, 60, 30]); break; }
      case 'zombie': { const ls = Math.sin(t * 7) * 0.6; const limb = (x, y, a, w, h, c) => { g.save(); g.translate(x * u, y * u); g.rotate(a); g.fillStyle = C(c); g.fillRect(-w / 2 * u, 0, w * u, h * u); g.restore(); };
        limb(-1, -10, ls, 3, 10, [64, 74, 120]); limb(1, -10, -ls, 3, 10, [54, 64, 100]); R(-3.2, -19, 6.4, 9.5, [70, 140, 96]); R(-3.8, -27, 7.6, 7.6, [120, 170, 110]); R(1, -24, 2, 2, [255, 60, 60]); R(-1, -21, 3, 0.9, [60, 40, 40]);
        limb(1, -18, -1.45 + Math.sin(t * 3) * 0.1, 2.6, 9, [120, 170, 110]); limb(-1, -18, -1.3 + Math.sin(t * 3 + 1) * 0.1, 2.6, 9, [100, 150, 96]); break; }
      case 'scorpion': { const tail = Math.sin(t * 6) * 1.5; R(-6, -5, 12, 4, [190, 120, 60]); R(2, -8, 5, 4, [210, 140, 70]); for (let i = 0; i < 4; i++) R(-5 + i * 3, -2 + Math.sin(t * 12 + i) * 0.8, 1, 3, [120, 70, 34]); R(-7, -8, 2, 4, [200, 130, 66]); R(-8, -11 + tail, 2, 4, [200, 130, 66]); R(-6.5, -13 + tail, 3, 2, [236, 90, 60]); R(7, -9, 3, 2, [210, 140, 70]); R(5, -7, 1, 1, [20, 10, 10]); break; }
      case 'frostling': { const y = Math.sin(t * 3) * 1.5; g.fillStyle = hurt ? '#fff' : 'rgba(150,220,255,0.35)'; g.beginPath(); g.arc(0, -4.5 * u + y * u, 7.5 * u, 0, 7); g.fill(); R(-4, -8 + y, 8, 7, [170, 230, 255]); R(-2, -10 + y, 4, 2, [210, 245, 255]); R(-5, -6 + y + 1, 1.5, 3, [120, 190, 240]); R(3.5, -6 + y + 1, 1.5, 3, [120, 190, 240]); R(-2.4, -6 + y, 1.5, 1.8, [20, 50, 90]); R(1, -6 + y, 1.5, 1.8, [20, 50, 90]); for (let i = 0; i < 3; i++) R(-3 + i * 3, -1 + y + Math.sin(t * 6 + i) * 0.6, 1.4, 2.5, [200, 240, 255]); break; }
      case 'frog': { const air = o.air; R(-4, -4 - (air ? 1 : 0), 8, 4, [74, 150, 70]); R(2, -6, 3, 3, [90, 170, 80]); R(3, -7, 1.5, 1.5, [250, 240, 120]); R(-4, -2, 2, 2, [56, 120, 56]); R(-5, -1, 3, 1, [56, 120, 56]); R(-1, -3, 4, 1, [150, 210, 120]); break; }
      case 'wolf': { const ls = Math.sin(t * 12) * 1.5; const body = [120, 124, 134], dk = [84, 88, 98]; R(-7, -9, 13, 6, body); R(-7, -9, 13, 2, [150, 154, 164]); R(5, -12, 5, 5, body); R(9, -10.5, 3, 2.5, dk); R(5, -14, 1.5, 2.5, dk); R(8, -14, 1.5, 2.5, dk); R(8, -10.5, 1.2, 1.2, [250, 210, 70]); R(-9, -10 + Math.sin(t * 6) * 0.8, 3, 2, dk); R(-6, -3, 2, 3 + ls * 0.4, dk); R(-2, -3, 2, 3 - ls * 0.4, body); R(2, -3, 2, 3 + ls * 0.4, body); R(5, -3, 2, 3 - ls * 0.4, dk); break; }
      case 'bat': { const fl = Math.sin(t * 22); R(-2, -4, 4, 4, [70, 52, 90]); R(-2, -6, 1.2, 2, [70, 52, 90]); R(1, -6, 1.2, 2, [70, 52, 90]); g.fillStyle = C([54, 40, 72]); g.beginPath(); g.moveTo(-2 * u, -3 * u); g.lineTo(-9 * u, (-6 + fl * 4) * u); g.lineTo(-6 * u, (-1) * u); g.closePath(); g.fill(); g.beginPath(); g.moveTo(2 * u, -3 * u); g.lineTo(9 * u, (-6 + fl * 4) * u); g.lineTo(6 * u, -1 * u); g.closePath(); g.fill(); R(-1.2, -3.2, 1, 1, [255, 80, 80]); R(0.4, -3.2, 1, 1, [255, 80, 80]); break; }
      case 'crawler': { const glow = 0.5 + Math.sin(t * 4) * 0.3; R(-7, -7, 14, 5, [60, 40, 90]); R(3, -9, 6, 5, [74, 50, 110]); for (let i = 0; i < 4; i++) { R(-6 + i * 3.4, -3 + Math.sin(t * 14 + i * 1.7) * 0.7, 1.3, 3.6, [40, 26, 62]); } g.fillStyle = hurt ? '#fff' : `rgba(210,140,255,${glow})`; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo((-5 + i * 3.5) * u, -7 * u); g.lineTo((-4 + i * 3.5) * u, -12 * u); g.lineTo((-3 + i * 3.5) * u, -7 * u); g.fill(); } R(6, -7.5, 1.4, 1.4, [255, 230, 120]); R(4, -7.5, 1.4, 1.4, [255, 230, 120]); break; }
      default: R(-4, -8, 8, 8, [200, 60, 200]);
    }
    g.restore();
  }

  function init() { buildAtlas(); }
  return { init, TS, VARS, BG, get atlas() { return atlas; }, get cracks() { return cracks; }, avg: (id) => avg[id] || [128, 128, 128], icon, iconURL, drawPlayer, drawMob, playerLook, PAL, rng, hash };
})();
