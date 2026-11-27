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
    [T.STONE](g, r) { paintStone(g, r); }, // (not `paintStone` directly: the atlas passes the variant number as 3rd arg, which was being read as the base colour -> black)
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

  // ======== v1.2 building-block painters ========
  const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  /** running-bond brick wall: rows of height rh, bricks bw wide */
  function bricks(g, r, base, mortar, rh = 4, bw = 8, vary = 18) {
    rect(g, 0, 0, 16, 16, col(mortar));
    for (let row = 0, y = 0; y < 16; row++, y += rh) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -off; x < 16; x += bw) {
        const x0 = Math.max(0, x + 1), x1 = Math.min(16, x + bw), tone = (r() - 0.5) * vary;
        for (let yy = y + 1; yy < Math.min(16, y + rh); yy++) for (let xx = x0; xx < x1; xx++) pixel(g, xx, yy, col(base, tone + (r() - 0.5) * 8 + (yy === y + 1 ? 10 : 0)));
      }
    }
  }
  /** square tiles with grout */
  function tiles(g, r, base, grout, n = 2, vary = 10) {
    const s = 16 / n; rect(g, 0, 0, 16, 16, col(grout));
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const tone = (r() - 0.5) * vary; for (let y = 1; y < s; y++) for (let x = 1; x < s; x++) pixel(g, i * s + x, j * s + y, col(base, tone + (r() - 0.5) * 6 + (y === 1 || x === 1 ? 8 : 0))); }
  }
  function moss(g, r, amt) { for (let i = 0; i < amt; i++) { const x = (r() * 16) | 0, y = (r() * 16) | 0; pixel(g, x, y, col([70, 130, 50], (r() - 0.5) * 30)); if (r() < 0.6) pixel(g, Math.min(15, x + 1), y, col([92, 156, 60], (r() - 0.5) * 24)); if (r() < 0.4) pixel(g, x, Math.min(15, y + 1), col([52, 104, 44])); } }
  function crack(g, r, n) { for (let k = 0; k < n; k++) { let x = (r() * 14) | 0, y = (r() * 14) | 0; for (let s = 0; s < 6; s++) { pixel(g, x, y, 'rgba(20,20,26,0.65)'); x = Math.min(15, Math.max(0, x + (r() < 0.5 ? 1 : 0))); y = Math.min(15, Math.max(0, y + (r() < 0.7 ? 1 : -1))); } } }
  /** overlapping scales (roofing): rows of rounded shingles */
  function scales(g, r, base, edge, rh = 4, w = 8) {
    for (let row = 0; row * rh < 20; row++) {
      const y0 = row * rh - 1, off = row % 2 ? w / 2 : 0;
      for (let x = -off; x < 16 + w; x += w) {
        const tone = (r() - 0.5) * 16;
        for (let yy = 0; yy < rh + 1; yy++) for (let xx = 0; xx < w; xx++) {
          const px = x + xx, py = y0 + yy; if (px < 0 || px > 15 || py < 0 || py > 15) continue;
          const dx = xx - (w - 1) / 2, round = yy >= rh - 1 && Math.abs(dx) > (w / 2 - 1.2 - (yy - (rh - 1)) * 1.4);
          if (round) continue;
          pixel(g, px, py, yy >= rh - 1 ? col(edge, tone) : col(base, tone + (yy === 0 ? 12 : 0) + (r() - 0.5) * 8));
        }
      }
    }
  }
  const GL = (g, base, a) => { g.fillStyle = `rgba(${base[0]},${base[1]},${base[2]},${a})`; g.fillRect(0, 0, 16, 16); };
  const stoneMix = { // simple helper tones
    cobble: [118, 120, 128], brick: [126, 128, 138],
  };
  Object.assign(painters, {
    [T.COBBLE](g, r) { rect(g, 0, 0, 16, 16, col([62, 64, 72])); const rocks = [[0, 0, 6, 5], [6, 0, 5, 6], [11, 0, 5, 4], [0, 5, 5, 6], [5, 6, 6, 5], [11, 4, 5, 6], [0, 11, 7, 5], [7, 11, 5, 5], [12, 10, 4, 6]]; for (const [x, y, w, h] of rocks) { const tone = (r() - 0.5) * 26; for (let yy = y + 1; yy < y + h; yy++) for (let xx = x + 1; xx < x + w; xx++) pixel(g, xx, yy, col([124, 126, 136], tone + (r() - 0.5) * 12 + (yy === y + 1 ? 10 : 0))); } },
    [T.STONE_BRICK](g, r) { bricks(g, r, [122, 124, 134], [70, 72, 82], 5, 8, 14); },
    [T.MOSSY_COBBLE](g, r) { painters[T.COBBLE](g, r); moss(g, r, 26); },
    [T.MOSSY_BRICK](g, r) { painters[T.STONE_BRICK](g, r); moss(g, r, 24); },
    [T.CRACKED_BRICK](g, r) { painters[T.STONE_BRICK](g, r); crack(g, r, 3); },
    [T.POLISHED_STONE](g, r) { noiseFill(g, [150, 154, 164], 8, r); rect(g, 0, 0, 16, 1, 'rgba(255,255,255,0.35)'); rect(g, 0, 0, 1, 16, 'rgba(255,255,255,0.22)'); rect(g, 0, 15, 16, 1, 'rgba(0,0,0,0.25)'); rect(g, 15, 0, 1, 16, 'rgba(0,0,0,0.18)'); line(g, 3, 12, 8, 7, 'rgba(255,255,255,0.18)'); },
    [T.CHISELED_STONE](g, r) { noiseFill(g, [128, 132, 142], 10, r); rect(g, 1, 1, 14, 14, col([92, 96, 108])); rect(g, 2, 2, 12, 12, col([136, 140, 150])); rect(g, 4, 4, 8, 8, col([100, 104, 116])); rect(g, 5, 5, 6, 6, col([146, 150, 160])); rect(g, 7, 7, 2, 2, col([88, 92, 104])); },
    [T.SLATE_BRICK](g, r) { bricks(g, r, [74, 80, 100], [38, 42, 56], 4, 8, 14); },
    [T.SLATE_TILE](g, r) { tiles(g, r, [70, 76, 98], [34, 38, 52], 2, 12); rect(g, 2, 2, 5, 1, 'rgba(255,255,255,0.12)'); rect(g, 9, 9, 5, 1, 'rgba(255,255,255,0.12)'); },
    [T.GRAVEL](g, r) { noiseFill(g, [128, 124, 120], 16, r); for (let i = 0; i < 26; i++) { const x = (r() * 15) | 0, y = (r() * 15) | 0, t = r(); const c = t < 0.33 ? [168, 162, 156] : t < 0.66 ? [96, 92, 90] : [150, 120, 96]; rect(g, x, y, 2, 2, col(c, (r() - 0.5) * 20)); pixel(g, x, y, col(c, 28)); } },
    [T.COARSE_DIRT](g, r) { paintDirt(g, r); for (let i = 0; i < 12; i++) { const x = (r() * 15) | 0, y = (r() * 15) | 0; rect(g, x, y, 2, 2, col([140, 134, 126], (r() - 0.5) * 20)); } },
    [T.MOSS](g, r) { noiseFill(g, [62, 112, 44], 24, r); for (let i = 0; i < 30; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([110, 170, 70], (r() - 0.5) * 30)); for (let i = 0; i < 8; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([36, 76, 34])); rect(g, 0, 0, 16, 1, 'rgba(255,255,255,0.1)'); },
    [T.COPPER_BLOCK](g, r) { noiseFill(g, [196, 108, 58], 12, r); rect(g, 0, 0, 16, 2, col([232, 150, 96])); rect(g, 0, 0, 2, 16, col([222, 136, 82])); rect(g, 0, 14, 16, 2, col([140, 72, 38])); rect(g, 14, 0, 2, 16, col([150, 78, 40])); rect(g, 4, 4, 8, 8, col([208, 120, 66])); rect(g, 4, 4, 8, 1, col([240, 168, 112])); },
    [T.IRON_BLOCK](g, r) { noiseFill(g, [186, 192, 204], 10, r); rect(g, 0, 0, 16, 2, col([232, 236, 246])); rect(g, 0, 0, 2, 16, col([220, 224, 236])); rect(g, 0, 14, 16, 2, col([116, 122, 138])); rect(g, 14, 0, 2, 16, col([126, 132, 148])); rect(g, 4, 4, 8, 8, col([170, 176, 190])); rect(g, 4, 4, 8, 1, col([226, 230, 240])); },
    [T.GOLD_BLOCK](g, r) { noiseFill(g, [244, 200, 56], 12, r); rect(g, 0, 0, 16, 2, col([255, 238, 140])); rect(g, 0, 0, 2, 16, col([255, 224, 100])); rect(g, 0, 14, 16, 2, col([186, 138, 24])); rect(g, 14, 0, 2, 16, col([196, 148, 30])); rect(g, 4, 4, 8, 8, col([250, 212, 70])); pixel(g, 6, 6, '#fff7c0'); pixel(g, 7, 6, '#fff7c0'); },
    [T.IRON_PLATE](g, r) { noiseFill(g, [150, 156, 170], 8, r); rect(g, 0, 7, 16, 2, col([108, 114, 128])); rect(g, 7, 0, 2, 16, col([108, 114, 128])); for (const [x, y] of [[1, 1], [13, 1], [1, 13], [13, 13], [3, 5], [11, 5], [3, 10], [11, 10]]) { pixel(g, x, y, col([214, 220, 232])); pixel(g, x + 1, y + 1, col([80, 84, 98])); } rect(g, 0, 0, 16, 1, 'rgba(255,255,255,0.3)'); rect(g, 0, 15, 16, 1, 'rgba(0,0,0,0.3)'); },
    [T.VERDIGRIS](g, r) { noiseFill(g, [72, 170, 148], 14, r); for (let i = 0; i < 5; i++) blob(g, (r() * 16) | 0, (r() * 16) | 0, 1 + ((r() * 2) | 0), [196, 110, 66], r); for (let i = 0; i < 12; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([130, 220, 190])); rect(g, 0, 0, 16, 1, 'rgba(255,255,255,0.2)'); rect(g, 0, 15, 16, 1, 'rgba(0,0,0,0.25)'); for (let x = 0; x < 16; x += 4) rect(g, x, 0, 1, 16, 'rgba(0,0,0,0.12)'); },
    [T.IRON_GRATE](g) { g.clearRect(0, 0, 16, 16); rect(g, 0, 0, 16, 2, col([120, 126, 140])); rect(g, 0, 14, 16, 2, col([90, 96, 110])); rect(g, 0, 0, 2, 16, col([130, 136, 150])); rect(g, 14, 0, 2, 16, col([90, 96, 110])); for (const x of [5, 8, 11]) { rect(g, x, 2, 1, 12, col([170, 176, 190])); } rect(g, 2, 7, 12, 1, col([146, 152, 166])); },
    [T.CRYSTAL_BLOCK](g, r) { noiseFill(g, [96, 164, 230], 14, r); poly(g, [[8, 1], [14, 6], [11, 14], [5, 14], [2, 6]], col([150, 214, 255])); poly(g, [[8, 1], [14, 6], [8, 8]], col([210, 244, 255])); poly(g, [[8, 8], [11, 14], [5, 14]], col([80, 140, 220])); line(g, 8, 1, 8, 14, col([230, 250, 255, 0])); rect(g, 0, 0, 16, 1, 'rgba(255,255,255,0.4)'); rect(g, 0, 15, 16, 1, 'rgba(20,40,120,0.4)'); pixel(g, 6, 5, '#fff'); },
    [T.CRYSTAL_LAMP](g, r) { rect(g, 0, 0, 16, 16, col([70, 76, 96])); rect(g, 2, 2, 12, 12, col([150, 214, 255])); rect(g, 4, 4, 8, 8, col([226, 246, 255])); rect(g, 6, 6, 4, 4, '#fff'); rect(g, 7, 2, 2, 12, col([70, 76, 96])); rect(g, 2, 7, 12, 2, col([70, 76, 96])); rect(g, 0, 0, 16, 1, col([110, 118, 140])); },
    [T.CLAY](g, r) { noiseFill(g, [160, 166, 182], 12, r); for (let i = 0; i < 6; i++) blob(g, (r() * 16) | 0, (r() * 16) | 0, 1, [142, 148, 166], r); for (let i = 0; i < 8; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([190, 196, 210])); },
    [T.BRICK](g, r) { bricks(g, r, [172, 76, 58], [196, 190, 176], 4, 8, 22); },
    [T.TERRACOTTA](g, r) { noiseFill(g, [200, 112, 70], 14, r); for (let i = 0; i < 6; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([226, 140, 92])); rect(g, 0, 0, 16, 1, 'rgba(255,255,255,0.15)'); rect(g, 0, 15, 16, 1, 'rgba(0,0,0,0.18)'); },
    [T.TERRA_TILE](g, r) { tiles(g, r, [206, 122, 78], [128, 70, 44], 4, 18); for (let i = 0; i < 4; i++) { const x = (r() * 3 | 0) * 4 + 2, y = (r() * 3 | 0) * 4 + 2; pixel(g, x, y, col([240, 170, 120])); } },
    [T.ADOBE](g, r) { noiseFill(g, [214, 176, 124], 14, r); for (const y of [5, 10]) rect(g, 0, y, 16, 1, 'rgba(120,84,48,0.35)'); for (const [x, y] of [[4, 0], [11, 5], [3, 10]]) rect(g, x, y, 1, 5, 'rgba(120,84,48,0.3)'); for (let i = 0; i < 14; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([236, 204, 156])); },
    [T.MUD_BRICK](g, r) { bricks(g, r, [112, 84, 54], [64, 48, 32], 4, 8, 22); for (let i = 0; i < 12; i++) line(g, (r() * 14) | 0, (r() * 14) | 0, (r() * 14) | 0, (r() * 14) | 0, 'rgba(190,160,100,0.25)'); },
    [T.GLAZED_TILE](g, r) { tiles(g, r, [236, 240, 246], [90, 130, 190], 2, 4); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const cx = i * 8 + 4, cy = j * 8 + 4; pixel(g, cx, cy, col([60, 110, 200])); pixel(g, cx - 1, cy, col([90, 140, 220])); pixel(g, cx + 1, cy, col([90, 140, 220])); pixel(g, cx, cy - 1, col([90, 140, 220])); pixel(g, cx, cy + 1, col([90, 140, 220])); } },
    [T.ROOF_TILE](g, r) { scales(g, r, [196, 92, 60], [140, 58, 40], 4, 8); },
    [T.SLATE_ROOF](g, r) { scales(g, r, [88, 96, 124], [52, 58, 80], 4, 4); },
    [T.THATCH](g, r) { noiseFill(g, [214, 182, 84], 16, r); for (let i = 0; i < 16; i++) line(g, (r() * 16) | 0, 0, ((r() * 16) | 0), 15, col([168, 132, 56], (r() - 0.5) * 20)); for (let y = 3; y < 16; y += 5) rect(g, 0, y, 16, 1, 'rgba(110,80,30,0.35)'); for (let i = 0; i < 12; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([244, 224, 140])); },
    [T.SHINGLE](g, r) { for (let row = 0; row < 4; row++) for (let i = 0; i < 4; i++) { const x = i * 4 + (row % 2 ? 2 : 0) - (row % 2 ? 0 : 0), tone = (r() - 0.5) * 26; for (let y = 0; y < 4; y++) for (let xx = 0; xx < 4; xx++) { const px = (x + xx + 16) % 16; pixel(g, px, row * 4 + y, y === 3 ? col([84, 54, 28]) : xx === 0 ? col([100, 66, 34]) : col([152, 106, 58], tone + (y === 0 ? 8 : 0))); } } },
    [T.GLASS](g) { g.clearRect(0, 0, 16, 16); GL(g, [190, 232, 250], 0.2); rect(g, 0, 0, 16, 1, 'rgba(255,255,255,0.6)'); rect(g, 0, 0, 1, 16, 'rgba(255,255,255,0.5)'); rect(g, 15, 0, 1, 16, 'rgba(120,170,200,0.5)'); rect(g, 0, 15, 16, 1, 'rgba(120,170,200,0.5)'); line(g, 3, 6, 6, 3, 'rgba(255,255,255,0.8)'); line(g, 4, 9, 9, 4, 'rgba(255,255,255,0.45)'); },
    [T.FRAMED_GLASS](g) { g.clearRect(0, 0, 16, 16); GL(g, [190, 232, 250], 0.22); const w = col([150, 100, 52]), d = col([100, 64, 30]); rect(g, 0, 0, 16, 2, w); rect(g, 0, 14, 16, 2, d); rect(g, 0, 0, 2, 16, w); rect(g, 14, 0, 2, 16, d); rect(g, 7, 2, 2, 12, w); rect(g, 2, 7, 12, 2, w); line(g, 3, 6, 5, 4, 'rgba(255,255,255,0.8)'); line(g, 10, 12, 12, 10, 'rgba(255,255,255,0.7)'); },
    [T.STAINED_GLASS](g) { g.clearRect(0, 0, 16, 16); const cols = [[230, 70, 80, 0.55], [250, 200, 60, 0.55], [70, 150, 230, 0.55], [80, 200, 120, 0.55]]; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const c = cols[(i + j * 2 + (i > 1 ? 1 : 0)) % 4]; g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`; g.fillRect(i * 4, j * 4, 4, 4); } g.fillStyle = col([54, 50, 60]); for (let k = 0; k <= 16; k += 4) { g.fillRect(Math.min(15, k), 0, 1, 16); g.fillRect(0, Math.min(15, k), 16, 1); } rect(g, 1, 1, 1, 1, 'rgba(255,255,255,0.8)'); rect(g, 9, 5, 1, 1, 'rgba(255,255,255,0.7)'); },
    [T.TINTED_GLASS](g) { g.clearRect(0, 0, 16, 16); GL(g, [30, 40, 56], 0.62); rect(g, 0, 0, 16, 1, 'rgba(255,255,255,0.3)'); rect(g, 0, 0, 1, 16, 'rgba(255,255,255,0.2)'); line(g, 3, 7, 7, 3, 'rgba(255,255,255,0.35)'); rect(g, 15, 0, 1, 16, 'rgba(0,0,0,0.4)'); rect(g, 0, 15, 16, 1, 'rgba(0,0,0,0.4)'); },
    [T.SANDSTONE_BRICK](g, r) { bricks(g, r, [214, 182, 118], [160, 124, 72], 5, 8, 14); },
    [T.SMOOTH_SANDSTONE](g, r) { noiseFill(g, [226, 198, 138], 6, r); rect(g, 0, 0, 16, 1, 'rgba(255,255,255,0.3)'); rect(g, 0, 15, 16, 1, 'rgba(150,110,60,0.35)'); rect(g, 0, 7, 16, 1, 'rgba(180,140,84,0.25)'); },
    [T.CHISELED_SANDSTONE](g, r) { noiseFill(g, [212, 180, 116], 10, r); rect(g, 1, 1, 14, 14, col([166, 130, 78])); rect(g, 2, 2, 12, 12, col([222, 192, 132])); for (const [x, y] of [[7, 4], [6, 5], [8, 5], [5, 6], [9, 6], [7, 6], [6, 7], [8, 7], [7, 8], [7, 9], [6, 10], [8, 10]]) pixel(g, x, y, col([156, 118, 66])); rect(g, 4, 11, 8, 1, col([156, 118, 66])); },
    [T.SNOW_BRICK](g, r) { bricks(g, r, [244, 248, 255], [170, 196, 224], 4, 8, 8); },
    [T.ICE_BRICK](g, r) { bricks(g, r, [150, 214, 246], [96, 156, 206], 5, 8, 14); for (let i = 0; i < 3; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, '#fff'); },
    [T.PINE_LOG](g, r) { for (let x = 0; x < 16; x++) { const edge = x < 2 || x > 13, stripe = x % 5 === 2; for (let y = 0; y < 16; y++) pixel(g, x, y, col(edge ? [52, 34, 24] : stripe ? [78, 52, 36] : [104, 70, 46], (r() - 0.5) * 12)); } for (let i = 0; i < 4; i++) { const y = (r() * 14) | 0, x = 3 + ((r() * 9) | 0); rect(g, x, y, 2, 1, col([44, 28, 20])); } },
    [T.MAPLE_LOG](g, r) { for (let x = 0; x < 16; x++) { const edge = x < 2 || x > 13, stripe = x % 3 === 1; for (let y = 0; y < 16; y++) pixel(g, x, y, col(edge ? [92, 72, 62] : stripe ? [136, 108, 92] : [168, 138, 118], (r() - 0.5) * 12)); } for (let i = 0; i < 5; i++) { const y = (r() * 14) | 0, x = 3 + ((r() * 9) | 0); rect(g, x, y, 1, 3, col([60, 46, 38])); } },
    [T.WILLOW_LOG](g, r) { for (let x = 0; x < 16; x++) { const edge = x < 3 || x > 12; for (let y = 0; y < 16; y++) pixel(g, x, y, col(edge ? [52, 50, 38] : [86, 84, 60], (r() - 0.5) * 14 + ((x + ((y / 4) | 0)) % 3 === 0 ? -14 : 0))); } for (let i = 0; i < 10; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([80, 124, 56])); },
    [T.STRIPPED_OAK](g, r) { noiseFill(g, [190, 146, 86], 8, r); for (let x = 0; x < 16; x += 4) rect(g, x, 0, 1, 16, 'rgba(120,80,40,0.35)'); rect(g, 0, 0, 2, 16, col([150, 108, 58])); rect(g, 14, 0, 2, 16, col([150, 108, 58])); },
    [T.STRIPPED_PINE](g, r) { noiseFill(g, [170, 122, 84], 8, r); for (let x = 1; x < 16; x += 5) rect(g, x, 0, 1, 16, 'rgba(100,60,36,0.4)'); rect(g, 0, 0, 2, 16, col([130, 90, 60])); rect(g, 14, 0, 2, 16, col([130, 90, 60])); },
    [T.STRIPPED_MAPLE](g, r) { noiseFill(g, [222, 190, 160], 8, r); for (let x = 2; x < 16; x += 3) rect(g, x, 0, 1, 16, 'rgba(150,110,80,0.35)'); rect(g, 0, 0, 2, 16, col([188, 150, 120])); rect(g, 14, 0, 2, 16, col([188, 150, 120])); },
    [T.STRIPPED_WILLOW](g, r) { noiseFill(g, [150, 150, 106], 8, r); for (let x = 1; x < 16; x += 4) rect(g, x, 0, 1, 16, 'rgba(70,74,44,0.4)'); rect(g, 0, 0, 2, 16, col([112, 112, 76])); rect(g, 14, 0, 2, 16, col([112, 112, 76])); },
    [T.PINE_PLANKS](g, r) { for (let col2 = 0; col2 < 4; col2++) { const x0 = col2 * 4; for (let x = 0; x < 4; x++) for (let y = 0; y < 16; y++) pixel(g, x0 + x, y, x === 3 ? col([92, 60, 40]) : col([150, 108, 74], (r() - 0.5) * 14 + (x === 0 ? 6 : 0))); const jy = (col2 * 7 + 3) % 16; for (let x = 0; x < 3; x++) pixel(g, x0 + x, jy, col([104, 70, 46])); } },
    [T.MAPLE_PLANKS](g, r) { for (let row = 0; row < 2; row++) { const y0 = row * 8; for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) pixel(g, x, y0 + y, y === 7 ? col([150, 116, 88]) : col([226, 190, 150], (r() - 0.5) * 12 + (y === 0 ? 8 : 0))); const jx = row ? 4 : 11; for (let y = 0; y < 7; y++) pixel(g, jx, y0 + y, col([176, 140, 106])); for (let i = 0; i < 3; i++) pixel(g, (r() * 16) | 0, y0 + 2 + ((r() * 4) | 0), col([190, 150, 110])); } },
    [T.WILLOW_PLANKS](g, r) { for (let row = 0; row < 4; row++) { const y0 = row * 4; for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) pixel(g, x, y0 + y, y === 3 ? col([62, 64, 44]) : col([132, 134, 92], (r() - 0.5) * 16 + (y === 0 ? 6 : 0))); const jx = (row * 7 + 2) % 16; for (let y = 0; y < 3; y++) pixel(g, jx, y0 + y, col([82, 84, 56])); } for (let i = 0; i < 5; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([110, 150, 76])); },
    [T.PARQUET](g, r) { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const horiz = (i + j) % 2 === 0, tone = (r() - 0.5) * 12, base = (i + j) % 4 < 2 ? [186, 136, 74] : [152, 108, 62]; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const edge = horiz ? y === 3 : x === 3; pixel(g, i * 4 + x, j * 4 + y, edge ? col([84, 54, 28]) : col(base, tone + ((horiz ? y : x) === 1 ? 8 : 0))); } } },
    [T.BOOKSHELF](g, r) { rect(g, 0, 0, 16, 16, col([120, 80, 40])); rect(g, 1, 1, 14, 6, col([62, 40, 22])); rect(g, 1, 9, 14, 6, col([62, 40, 22])); const bc = [[200, 60, 60], [60, 120, 200], [230, 190, 70], [80, 170, 100], [160, 90, 200], [220, 130, 60]]; for (const y0 of [1, 9]) { let x = 1; while (x < 14) { const w = 2 + ((r() * 2) | 0), c = bc[(r() * 6) | 0], h = 5 - ((r() * 2) | 0); rect(g, x, y0 + 6 - h, w, h, col(c)); rect(g, x, y0 + 6 - h, 1, h, col(c, 30)); x += w; } } rect(g, 0, 7, 16, 2, col([150, 104, 54])); rect(g, 0, 0, 16, 1, col([170, 120, 62])); },
    [T.BEAM](g, r) { rect(g, 0, 0, 16, 16, col([92, 62, 34])); rect(g, 3, 0, 10, 16, col([128, 88, 48])); for (let x = 3; x < 13; x += 3) rect(g, x, 0, 1, 16, col([108, 72, 38])); rect(g, 3, 0, 1, 16, col([164, 118, 66])); rect(g, 0, 7, 16, 3, col([116, 78, 42])); rect(g, 0, 7, 16, 1, col([150, 106, 58])); pixel(g, 7, 8, col([60, 40, 22])); pixel(g, 9, 8, col([60, 40, 22])); },
    [T.HAY](g, r) { noiseFill(g, [222, 188, 80], 18, r); for (let i = 0; i < 22; i++) line(g, (r() * 16) | 0, (r() * 16) | 0, (r() * 16) | 0, (r() * 16) | 0, col([196, 152, 52], (r() - 0.5) * 30)); rect(g, 0, 4, 16, 2, col([140, 90, 40])); rect(g, 0, 10, 16, 2, col([140, 90, 40])); rect(g, 0, 4, 16, 1, col([170, 118, 56])); rect(g, 0, 10, 16, 1, col([170, 118, 56])); },
    [T.CHECKER](g) { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const dark = (i + j) % 2; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) pixel(g, i * 4 + x, j * 4 + y, dark ? col([46, 48, 58], y === 0 ? 10 : 0) : col([232, 234, 240], y === 0 ? 12 : -(x === 3 || y === 3 ? 18 : 0))); } },
    [T.MARBLE](g, r) { noiseFill(g, [236, 238, 244], 6, r); for (let k = 0; k < 3; k++) { let x = (r() * 16) | 0, y = 0; for (let s = 0; s < 16; s++) { pixel(g, x, y, col([150, 156, 176], (r() - 0.5) * 20)); if (r() < 0.4) pixel(g, Math.min(15, x + 1), y, col([196, 200, 214])); x = Math.max(0, Math.min(15, x + ((r() * 3) | 0) - 1)); y++; } } rect(g, 0, 0, 16, 1, 'rgba(255,255,255,0.5)'); rect(g, 0, 15, 16, 1, 'rgba(0,0,0,0.15)'); },
    [T.BASALT](g, r) { noiseFill(g, [58, 60, 70], 10, r); for (let x = 0; x < 16; x += 4) rect(g, x, 0, 1, 16, 'rgba(0,0,0,0.35)'); for (let i = 0; i < 8; i++) pixel(g, (r() * 16) | 0, (r() * 16) | 0, col([98, 100, 116])); rect(g, 0, 0, 16, 1, 'rgba(255,255,255,0.14)'); },
    [T.MASON](g) { rect(g, 1, 8, 3, 8, col([120, 78, 38])); rect(g, 12, 8, 3, 8, col([120, 78, 38])); rect(g, 0, 5, 16, 4, col([142, 146, 158])); rect(g, 0, 5, 16, 1, col([196, 200, 212])); rect(g, 0, 9, 16, 1, col([92, 96, 108])); rect(g, 3, 1, 5, 4, col([176, 180, 192])); rect(g, 3, 1, 5, 1, col([220, 224, 234])); rect(g, 9, 2, 4, 3, col([110, 114, 128])); rect(g, 10, 3, 1, 2, col([60, 62, 70])); rect(g, 4, 12, 8, 2, col([100, 64, 30])); },
    [T.BED](g, r) { rect(g, 0, 12, 16, 4, col([96, 60, 30])); rect(g, 0, 9, 2, 7, col([120, 78, 38])); rect(g, 1, 8, 15, 4, col([232, 232, 240])); rect(g, 1, 8, 15, 1, col([255, 255, 255])); rect(g, 2, 6, 6, 3, col([246, 246, 252])); rect(g, 2, 6, 6, 1, '#fff'); rect(g, 7, 8, 9, 4, col([196, 54, 62])); rect(g, 7, 8, 9, 1, col([226, 90, 96])); for (const x of [9, 12, 15]) rect(g, x, 9, 1, 3, col([160, 38, 46])); rect(g, 0, 15, 2, 1, col([60, 38, 20])); },
    [T.BED_R](g, r) { rect(g, 0, 12, 16, 4, col([96, 60, 30])); rect(g, 14, 10, 2, 6, col([120, 78, 38])); rect(g, 0, 8, 15, 4, col([196, 54, 62])); rect(g, 0, 8, 15, 1, col([226, 90, 96])); for (const x of [2, 5, 8, 11]) rect(g, x, 9, 1, 3, col([160, 38, 46])); rect(g, 14, 8, 1, 4, col([232, 232, 240])); rect(g, 14, 15, 2, 1, col([60, 38, 20])); },
    [T.WOOL_BLOCK](g, r) { noiseFill(g, [240, 238, 232], 6, r); for (let y = 1; y < 16; y += 3) for (let x = (y % 2) * 2; x < 16; x += 4) { pixel(g, x, y, col([255, 255, 255])); pixel(g, x + 1, y, col([255, 255, 255])); pixel(g, x + 2, y + 1, col([214, 212, 204])); } rect(g, 0, 15, 16, 1, 'rgba(0,0,0,0.12)'); rect(g, 15, 0, 1, 16, 'rgba(0,0,0,0.1)'); },
    [T.FISH_TANK](g, r) { g.clearRect(0, 0, 16, 16); GL(g, [70, 150, 230], 0.55); rect(g, 0, 0, 16, 4, 'rgba(160,210,255,0.28)'); rect(g, 0, 4, 16, 1, 'rgba(255,255,255,0.45)'); const fr = col([176, 130, 70]); rect(g, 0, 0, 16, 1, fr); rect(g, 0, 15, 16, 1, col([110, 76, 40])); rect(g, 0, 0, 1, 16, fr); rect(g, 15, 0, 1, 16, col([110, 76, 40]));
      rect(g, 3, 9, 4, 2, col([236, 140, 60])); rect(g, 2, 9, 1, 2, col([200, 100, 40])); pixel(g, 6, 9, '#101018'); rect(g, 9, 6, 3, 2, col([210, 90, 90])); rect(g, 12, 6, 1, 2, col([170, 60, 60])); pixel(g, 9, 6, '#101018'); for (const x of [2, 5, 12]) { line(g, x, 15, x, 12, col([60, 150, 70])); } pixel(g, 8, 14, col([230, 220, 190])); pixel(g, 10, 14, col([200, 190, 160])); rect(g, 2, 1, 5, 1, 'rgba(255,255,255,0.4)'); },
    [T.FENCE](g) { for (const x of [1, 11]) { rect(g, x, 2, 4, 14, col([160, 112, 62])); rect(g, x, 2, 1, 14, col([196, 146, 88])); rect(g, x + 3, 2, 1, 14, col([112, 76, 40])); rect(g, x, 1, 4, 1, col([196, 146, 88])); } for (const y of [5, 10]) { rect(g, 0, y, 16, 2, col([172, 122, 70])); rect(g, 0, y, 16, 1, col([204, 154, 96])); } },
    [T.LADDER](g) { for (const x of [2, 11]) { rect(g, x, 0, 3, 16, col([150, 102, 56])); rect(g, x, 0, 1, 16, col([186, 134, 78])); rect(g, x + 2, 0, 1, 16, col([104, 70, 38])); } for (const y of [1, 5, 9, 13]) { rect(g, 5, y, 6, 2, col([172, 120, 66])); rect(g, 5, y, 6, 1, col([200, 150, 90])); rect(g, 5, y + 2, 6, 1, 'rgba(0,0,0,0.22)'); } },
    [T.DOOR](g) { rect(g, 0, 0, 16, 16, col([112, 74, 38])); for (const x of [1, 8]) { rect(g, x, 1, 7, 14, col([150, 104, 56])); rect(g, x, 1, 7, 1, col([180, 134, 80])); rect(g, x, 14, 7, 1, col([100, 66, 34])); } rect(g, 6, 7, 2, 3, col([236, 204, 90])); rect(g, 6, 7, 1, 1, '#fff6c0'); rect(g, 0, 15, 16, 1, col([70, 46, 24])); },
    [T.DOOR_T](g) { rect(g, 0, 0, 16, 16, col([112, 74, 38])); rect(g, 1, 1, 14, 14, col([150, 104, 56])); rect(g, 1, 1, 14, 1, col([180, 134, 80])); for (const [x, y] of [[3, 3], [9, 3], [3, 8], [9, 8]]) { rect(g, x, y, 4, 4, col([120, 180, 220])); rect(g, x, y, 4, 1, col([200, 235, 255])); rect(g, x + 3, y + 1, 1, 3, 'rgba(0,0,0,0.2)'); } rect(g, 0, 0, 16, 1, col([70, 46, 24])); },
    [T.DOOR_BO](g) { rect(g, 0, 0, 3, 16, col([112, 74, 38])); rect(g, 0, 0, 1, 16, col([150, 104, 56])); rect(g, 2, 0, 1, 16, col([70, 46, 24])); rect(g, 0, 7, 3, 3, col([236, 204, 90])); rect(g, 3, 0, 2, 16, 'rgba(0,0,0,0.12)'); },
    [T.DOOR_TO](g) { rect(g, 0, 0, 3, 16, col([112, 74, 38])); rect(g, 0, 0, 1, 16, col([150, 104, 56])); rect(g, 2, 0, 1, 16, col([70, 46, 24])); rect(g, 0, 0, 3, 1, col([70, 46, 24])); rect(g, 3, 0, 2, 16, 'rgba(0,0,0,0.12)'); },
    [T.WALL_PLANKS](g, r) { rect(g, 0, 0, 16, 16, col([98, 66, 38])); for (let y = 0; y < 16; y += 4) { rect(g, 0, y, 16, 1, col([70, 46, 26])); rect(g, (y * 3 + 5) % 14, y + 1, 1, 3, col([70, 46, 26])); rect(g, 0, y + 1, 16, 1, col([116, 80, 46])); } rect(g, 0, 0, 16, 16, 'rgba(0,0,0,0.12)'); },
    [T.WALL_STONE](g, r) { rect(g, 0, 0, 16, 16, col([92, 94, 102])); for (let i = 0; i < 26; i++) rect(g, (r() * 16) | 0, (r() * 16) | 0, 2, 1, col([78, 80, 88])); for (let i = 0; i < 14; i++) rect(g, (r() * 16) | 0, (r() * 16) | 0, 1, 1, col([108, 110, 118])); rect(g, 0, 15, 16, 1, col([66, 68, 76])); rect(g, 15, 0, 1, 16, col([72, 74, 82])); rect(g, 0, 0, 16, 16, 'rgba(0,0,0,0.12)'); },
    [T.WALL_BRICK](g) { rect(g, 0, 0, 16, 16, col([112, 50, 42])); for (let y = 0; y < 16; y += 4) { rect(g, 0, y + 3, 16, 1, col([70, 62, 60])); const o = (y / 4) % 2 ? 4 : 0; for (let x = o; x < 16 + 8; x += 8) rect(g, x % 16, y, 1, 3, col([70, 62, 60])); rect(g, 0, y, 16, 1, col([132, 62, 52])); } rect(g, 0, 0, 16, 16, 'rgba(0,0,0,0.14)'); },
    [T.WALL_DARK](g, r) { rect(g, 0, 0, 16, 16, col([54, 52, 66])); for (let i = 0; i < 20; i++) rect(g, (r() * 16) | 0, (r() * 16) | 0, 2, 2, col([62, 60, 76])); for (let x = 0; x < 16; x += 8) rect(g, x, 0, 1, 16, col([40, 38, 50])); rect(g, 0, 8, 16, 1, col([40, 38, 50])); rect(g, 0, 0, 16, 16, 'rgba(0,0,0,0.1)'); },
    [T.FARMLAND](g, r) { noiseFill(g, [92, 60, 36], 7, r); for (let y = 3; y < 16; y += 5) { rect(g, 0, y, 16, 2, col([62, 40, 24])); rect(g, 0, y - 1, 16, 1, col([112, 76, 46])); } rect(g, 0, 0, 16, 2, col([116, 78, 48])); },
    [T.WHEAT1](g) { for (const x of [3, 7, 11]) { rect(g, x, 11, 1, 5, col([96, 170, 70])); rect(g, x - 1, 10, 1, 2, col([120, 190, 86])); rect(g, x + 1, 9, 1, 2, col([120, 190, 86])); } },
    [T.WHEAT2](g) { for (const x of [2, 5, 8, 11, 14]) { rect(g, x, 6, 1, 10, col([110, 178, 66])); rect(g, x - 1, 5, 1, 3, col([140, 200, 84])); rect(g, x + 1, 7, 1, 3, col([140, 200, 84])); } },
    [T.WHEAT3](g) { for (const x of [2, 5, 8, 11, 14]) { rect(g, x, 3, 1, 13, col([204, 170, 66])); rect(g, x - 1, 1, 3, 5, col([238, 204, 96])); rect(g, x, 0, 1, 2, col([250, 224, 130])); rect(g, x + 1, 5, 1, 1, col([226, 190, 84])); rect(g, x - 1, 7, 1, 1, col([226, 190, 84])); } },
    [T.CARROT1](g) { for (const x of [4, 8, 12]) { rect(g, x, 12, 1, 4, col([88, 164, 66])); rect(g, x - 1, 11, 3, 2, col([118, 190, 84])); } },
    [T.CARROT2](g) { for (const x of [3, 7, 11]) { for (let i = 0; i < 3; i++) { rect(g, x - 1 + i, 7 + (i === 1 ? -1 : 0), 1, 7, col([88, 168, 64])); } rect(g, x, 5, 1, 2, col([128, 198, 90])); } },
    [T.CARROT3](g) { for (const x of [3, 7, 11]) { for (let i = 0; i < 3; i++) rect(g, x - 1 + i, 4 + (i === 1 ? -1 : 0), 1, 8, col([80, 160, 60])); rect(g, x - 1, 13, 3, 3, col([240, 128, 36])); rect(g, x, 12, 1, 1, col([255, 170, 80])); rect(g, x, 15, 1, 1, col([200, 96, 24])); } },
    [T.LANTERN](g) { rect(g, 7, 0, 2, 3, col([60, 62, 72])); rect(g, 4, 3, 8, 2, col([70, 72, 84])); rect(g, 4, 5, 8, 8, col([40, 44, 56])); rect(g, 5, 6, 6, 6, col([255, 200, 90])); rect(g, 6, 7, 4, 4, col([255, 240, 170])); rect(g, 7, 8, 2, 2, '#fff'); rect(g, 7, 5, 2, 8, col([40, 44, 56])); rect(g, 4, 13, 8, 2, col([70, 72, 84])); rect(g, 5, 15, 6, 1, col([50, 52, 62])); },
  });

  function buildAtlas() {
    atlas = mk(256 * TS, VARS * TS); atlasCtx = atlas.getContext('2d');
    for (const id of Object.keys(painters)) for (let v = 0; v < VARS; v++) {
      const c = mk(TS, TS), g = c.getContext('2d'); painters[id](g, rng(+id * 977 + v * 131 + 7), v);
      atlasCtx.drawImage(c, id * TS, v * TS);
      if (v === 0) { const d = g.getImageData(0, 0, TS, TS).data; let rr = 0, gg = 0, bb = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { rr += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++; } avg[id] = n ? [rr / n | 0, gg / n | 0, bb / n | 0] : [128, 128, 128]; }
    }
    for (const k in DEFS.SHAPE) avg[k] = avg[DEFS.SHAPE[k].base] || [128, 128, 128];
    cracks = mk(TS * 5, TS); const cg = cracks.getContext('2d'); const r = rng(99);
    for (let s = 0; s < 5; s++) { cg.save(); cg.translate(s * TS, 0); const n = 3 + s * 3; for (let k = 0; k < n; k++) { let x = 8 + ((r() - 0.5) * 6 | 0), y = 8 + ((r() - 0.5) * 6 | 0), a = r() * 6.28; for (let j = 0; j < 3 + s; j++) { pixel(cg, Math.max(0, Math.min(15, x | 0)), Math.max(0, Math.min(15, y | 0)), 'rgba(0,0,0,0.75)'); x += Math.cos(a); y += Math.sin(a); a += (r() - 0.5); } } cg.restore(); }
  }


  /** draw a slab / stair / wall tile (id) from the base block's atlas art. dx,dy = top-left px, sz = tile px, v = texture variant. armL/armR = wall connects to neighbours */
  function drawShape(g, id, dx, dy, sz, v, armL, armR) {
    const sh = DEFS.SHAPE[id], k = sz / 16, sx = sh.base * TS, sy = v * TS, A = atlas;
    const part = (x0, y0, w, h) => g.drawImage(A, sx + x0, sy + y0, w, h, dx + x0 * k, dy + y0 * k, w * k, h * k);
    if (sh.kind === 'slab') part(0, 8, 16, 8);
    else if (sh.kind === 'stairR') { part(0, 8, 16, 8); part(8, 0, 8, 8); }
    else if (sh.kind === 'stairL') { part(0, 8, 16, 8); part(0, 0, 8, 8); }
    else { part(4, 0, 8, 16); if (armL) part(0, 3, 4, 8); if (armR) part(12, 3, 4, 8); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(dx + 11 * k, dy, k, sz); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(dx + 4 * k, dy, k, sz); }
  }

  // ---- item icons
  const TIER = { 1: [[150, 100, 52], [206, 156, 86]], 2: [[134, 136, 146], [190, 192, 204]], 3: [[196, 100, 50], [244, 164, 96]], 4: [[176, 184, 198], [236, 240, 250]], 5: [[96, 210, 250], [220, 250, 255]] };
  const iconCache = {}, iconURLs = {};
  function paintIcon(g, id) {
    const it = ITEMS[id], r = rng(id * 31 + 5);
    if (it.block !== undefined) { if (DEFS.SHAPE[it.block]) drawShape(g, it.block, 0, 0, TS, 0, true, true); else g.drawImage(atlas, it.block * TS, 0, TS, TS, 0, 0, TS, TS); return; }
    const hand = [128, 86, 44];
    if (it.kind && it.kind !== 'rod') {
      const [c, hl] = id === I.WARDEN_BLADE ? [[128, 70, 190], [255, 150, 90]] : TIER[it.tier];
      if (it.kind === 'sword') {
        line(g, 3, 13, 6, 10, col(hand)); line(g, 2, 14, 3, 13, col([90, 58, 28]));
        for (let i = 0; i < 9; i++) { const x = 6 + i, y = 10 - i; pixel(g, x, y, col(c)); pixel(g, x + 1, y, col(hl)); pixel(g, x, y + 1, col(c, -30)); }
        pixel(g, 14, 2, col(hl)); pixel(g, 15, 1, col(hl));
        line(g, 4, 8, 8, 12, col([210, 170, 60])); line(g, 5, 8, 8, 11, col([160, 120, 40]));
        if (it.tier === 5) for (let i = 0; i < 4; i++) pixel(g, 7 + i * 2, 9 - i * 2 - 1, '#fff');
      } else if (it.kind === 'hoe') {
        line(g, 2, 14, 11, 4, col(hand)); line(g, 3, 14, 12, 4, col(hand, -34)); poly(g, [[10, 2], [15, 4], [14, 7], [11, 5]], col(c)); line(g, 11, 3, 14, 5, col(hl));
      } else if (it.kind === 'shovel') {
        line(g, 3, 14, 10, 7, col(hand)); line(g, 4, 14, 11, 7, col(hand, -34));
        poly(g, [[9, 3], [14, 4], [14, 9], [11, 10], [8, 7]], col(c)); line(g, 10, 4, 13, 5, col(hl)); line(g, 13, 6, 12, 9, col(c, -30)); pixel(g, 9, 6, col(c, -30));
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
      case I.WHEAT_SEEDS: for (const [x, y] of [[4, 6], [8, 4], [11, 7], [6, 10], [10, 11], [3, 12]]) { pixel(g, x, y, col([214, 180, 90])); pixel(g, x + 1, y, col([160, 124, 52])); pixel(g, x, y + 1, col([160, 124, 52])); } break;
      case I.WHEAT: for (const x of [4, 8, 12]) { line(g, x, 15, x, 5, col([200, 170, 70])); for (let i = 0; i < 4; i++) { pixel(g, x - 1, 5 + i * 2 - 1, col([232, 200, 90])); pixel(g, x + 1, 5 + i * 2, col([232, 200, 90])); } pixel(g, x, 3, col([240, 210, 100])); pixel(g, x, 4, col([240, 210, 100])); } break;
      case I.BREAD: poly(g, [[2, 11], [3, 7], [7, 5], [12, 6], [14, 9], [13, 12], [4, 13]], col([200, 140, 70])); poly(g, [[3, 8], [7, 5], [12, 6], [13, 8], [8, 7]], col([228, 170, 92])); line(g, 5, 9, 6, 11, col([150, 96, 44])); line(g, 8, 8, 9, 11, col([150, 96, 44])); line(g, 11, 8, 12, 10, col([150, 96, 44])); break;
      case I.CARROT: poly(g, [[4, 5], [10, 4], [14, 13], [12, 14]], col([240, 128, 36])); line(g, 5, 6, 9, 6, col([255, 170, 90])); line(g, 7, 9, 10, 10, col([196, 96, 24])); line(g, 5, 5, 3, 2, col([70, 170, 60])); line(g, 6, 4, 6, 1, col([90, 190, 70])); line(g, 8, 4, 10, 1, col([70, 170, 60])); break;
      case I.APPLE: blob(g, 8, 9, 5, [214, 38, 44], r); pixel(g, 6, 7, '#ff9a9a'); pixel(g, 6, 8, '#ff9a9a'); line(g, 8, 4, 9, 2, col([100, 64, 30])); poly(g, [[9, 3], [12, 2], [11, 5]], col([70, 170, 60])); break;
      case I.RAW_MEAT: case I.COOKED_MEAT: { const c = id === I.RAW_MEAT ? [226, 98, 110] : [150, 84, 44]; blob(g, 7, 9, 5, c, r); blob(g, 6, 8, 2, col(c, 40).match(/\d+/g).map(Number), r); line(g, 11, 5, 14, 2, '#f4efe2'); pixel(g, 14, 1, '#f4efe2'); pixel(g, 15, 2, '#f4efe2'); break; }
      case I.POTION: case I.SWIFT_POTION: case I.HASTE_POTION: case I.IRON_POTION: case I.REGEN_POTION: poly(g, [[6, 6], [10, 6], [13, 12], [11, 14], [5, 14], [3, 12]], col({ [I.SWIFT_POTION]: [70, 190, 240], [I.HASTE_POTION]: [240, 190, 50], [I.IRON_POTION]: [150, 160, 175], [I.REGEN_POTION]: [90, 210, 110] }[id] || [226, 60, 110])); poly(g, [[6, 6], [10, 6], [10, 8], [6, 8]], col([216, 232, 240])); g.fillStyle = col([160, 110, 60]); g.fillRect(6, 3, 4, 3); pixel(g, 5, 11, '#ffc0d8'); pixel(g, 5, 10, '#ffc0d8'); pixel(g, 9, 11, '#fff'); break;
      case I.COPPER_HELM: case I.IRON_HELM: case I.GOLD_HELM: {
        const c = id === I.COPPER_HELM ? [210, 116, 60] : id === I.IRON_HELM ? [186, 194, 208] : [250, 208, 60];
        poly(g, [[3, 12], [3, 7], [5, 4], [11, 4], [13, 7], [13, 12], [11, 12], [11, 9], [5, 9], [5, 12]], col(c)); line(g, 5, 5, 10, 5, col(c, 50)); g.fillStyle = col(c, -50); g.fillRect(3, 11, 2, 2); g.fillRect(11, 11, 2, 2);
        if (id === I.GOLD_HELM) { pixel(g, 4, 3, col(c)); pixel(g, 8, 2, col(c)); pixel(g, 12, 3, col(c)); pixel(g, 8, 3, '#ff4060'); }
        break; }
      case I.COPPER_MAIL: case I.IRON_MAIL: case I.CRYSTAL_MAIL: case I.WARDEN_MAIL: {
        const c = id === I.WARDEN_MAIL ? [112, 84, 170] : id === I.COPPER_MAIL ? [210, 116, 60] : id === I.IRON_MAIL ? [186, 194, 208] : [110, 214, 250];
        poly(g, [[1, 5], [5, 3], [7, 5], [9, 5], [11, 3], [15, 5], [14, 9], [12, 8], [12, 14], [4, 14], [4, 8], [2, 9]], col(c)); line(g, 5, 6, 11, 6, col(c, 50)); line(g, 8, 6, 8, 13, col(c, -40)); for (let y = 8; y < 14; y += 2) line(g, 5, y, 11, y, col(c, -25));
        if (id === I.CRYSTAL_MAIL) pixel(g, 8, 9, '#fff');
        if (id === I.WARDEN_MAIL) { rectI(g, 7, 8, 2, 3, [120, 240, 255]); pixel(g, 7, 8, '#fff'); }
        break; }
      case I.WARDEN_SIGIL: { blob(g, 8, 8, 6, [60, 52, 90], r); blob(g, 8, 8, 4.4, [96, 84, 150], r); for (const [x0, y0, x1, y1] of [[8, 3, 8, 13], [3, 8, 13, 8], [4, 4, 12, 12], [12, 4, 4, 12]]) line(g, x0, y0, x1, y1, col([140, 240, 255])); pixel(g, 8, 8, '#fff'); pixel(g, 7, 8, '#bff'); pixel(g, 9, 8, '#bff'); break; }
      case I.WARDEN_CORE: { poly(g, [[8, 1], [13, 6], [11, 14], [5, 14], [3, 6]], col([40, 150, 190])); poly(g, [[8, 1], [13, 6], [8, 8]], col([150, 240, 255])); poly(g, [[8, 8], [13, 6], [11, 14]], col([30, 110, 160])); poly(g, [[8, 8], [3, 6], [5, 14]], col([70, 190, 230])); pixel(g, 7, 5, '#fff'); pixel(g, 8, 4, '#e8ffff'); break; }
      case I.FIBER: for (const [x0, x1] of [[3, 5], [6, 8], [9, 11], [12, 10]]) line(g, x0, 14, x1, 3 + ((r() * 3) | 0), col([164, 190, 80], (r() - 0.5) * 30)); line(g, 2, 9, 14, 9, col([120, 84, 40])); line(g, 2, 10, 14, 10, col([86, 60, 28])); break;
      case I.CLAY_BRICK: poly(g, [[2, 7], [4, 4], [14, 4], [12, 7]], col([226, 120, 90])); poly(g, [[2, 7], [12, 7], [12, 12], [2, 12]], col([176, 74, 52])); poly(g, [[12, 7], [14, 4], [14, 9], [12, 12]], col([130, 52, 38])); pixel(g, 5, 9, col([206, 100, 72])); pixel(g, 8, 10, col([150, 60, 44])); break;
      case I.LEATHER: poly(g, [[3, 4], [13, 3], [14, 11], [9, 14], [3, 12]], col([160, 96, 56])); poly(g, [[3, 4], [13, 3], [11, 6], [5, 7]], col([188, 120, 70])); line(g, 5, 10, 11, 10, col([110, 62, 34])); pixel(g, 6, 12, col([110, 62, 34])); break;
      case I.WOOL: blob(g, 8, 8, 5, [244, 242, 236], r); blob(g, 6, 6, 2, [255, 255, 255], r); blob(g, 11, 10, 2, [222, 220, 212], r); line(g, 4, 11, 12, 6, col([210, 208, 200])); break;
      case I.FEATHER: poly(g, [[3, 14], [10, 2], [14, 3], [12, 9], [5, 13]], col([232, 236, 246])); line(g, 3, 14, 13, 3, col([140, 150, 176])); for (let i = 0; i < 4; i++) line(g, 5 + i * 2, 11 - i * 2, 9 + i * 1.4, 11 - i * 2, col([196, 204, 224])); break;
      case I.RAW_FISH: case I.COOKED_FISH: case I.GOLDEN_CARP: { const c = id === I.RAW_FISH ? [150, 176, 206] : id === I.COOKED_FISH ? [196, 126, 66] : [252, 200, 50], dk = [(c[0] * 0.65) | 0, (c[1] * 0.65) | 0, (c[2] * 0.65) | 0];
        poly(g, [[2, 8], [6, 4], [11, 5], [13, 8], [11, 11], [6, 12]], col(c)); poly(g, [[12, 8], [15, 4], [15, 12]], col(dk)); line(g, 5, 5, 10, 5, col(c, 40)); line(g, 5, 11, 10, 11, col(dk)); pixel(g, 4, 7, '#101018'); if (id === I.COOKED_FISH) { line(g, 6, 7, 6, 9, col([120, 70, 30])); line(g, 8, 7, 8, 9, col([120, 70, 30])); } if (id === I.GOLDEN_CARP) { pixel(g, 7, 6, '#fff7c0'); pixel(g, 9, 9, '#fff7c0'); pixel(g, 14, 2, '#fff7c0'); } else { pixel(g, 7, 6, col(c, 50)); } break; }
      case I.FISHING_ROD: line(g, 2, 14, 12, 2, col([140, 96, 52])); line(g, 3, 14, 13, 2, col([176, 126, 70])); line(g, 12, 2, 14, 6, col([220, 224, 232])); line(g, 14, 6, 14, 10, col([220, 224, 232])); pixel(g, 14, 11, col([230, 60, 60])); pixel(g, 14, 12, col([250, 250, 250])); rectI(g, 5, 10, 3, 3, [120, 128, 140]); break;
      case I.LURE: line(g, 3, 13, 10, 5, col([232, 236, 246])); poly(g, [[8, 4], [12, 3], [11, 7]], col([214, 60, 56])); line(g, 4, 13, 4, 15, col([190, 196, 206])); pixel(g, 3, 15, col([190, 196, 206])); pixel(g, 5, 15, col([190, 196, 206])); blob(g, 7, 10, 2, [250, 190, 50], r); break;
      case I.LEATHER_CAP: poly(g, [[3, 12], [3, 7], [5, 4], [11, 4], [13, 7], [13, 12], [11, 12], [11, 9], [5, 9], [5, 12]], col([160, 96, 56])); line(g, 5, 5, 10, 5, col([196, 128, 76])); line(g, 3, 12, 13, 12, col([110, 62, 34])); break;
      case I.LEATHER_TUNIC: poly(g, [[1, 5], [5, 3], [7, 5], [9, 5], [11, 3], [15, 5], [14, 9], [12, 8], [12, 14], [4, 14], [4, 8], [2, 9]], col([160, 96, 56])); line(g, 5, 6, 11, 6, col([196, 128, 76])); line(g, 8, 6, 8, 13, col([110, 62, 34])); for (const y of [8, 11]) pixel(g, 7, y, col([240, 220, 160])); break;
      case I.MUSHROOM: g.fillStyle = col([230, 226, 210]); g.fillRect(7, 8, 3, 6); g.fillStyle = col([90, 210, 255]); g.fillRect(3, 5, 11, 3); g.fillRect(5, 3, 7, 2); pixel(g, 5, 6, '#fff'); pixel(g, 10, 4, '#fff'); pixel(g, 11, 6, col([40, 120, 190])); break;
      case I.AMULET: line(g, 3, 2, 8, 9, col([200, 200, 212])); line(g, 13, 2, 8, 9, col([200, 200, 212])); poly(g, [[8, 8], [11, 11], [8, 15], [5, 11]], col([140, 120, 255])); poly(g, [[8, 8], [11, 11], [8, 11]], col([200, 240, 255])); pixel(g, 7, 10, '#fff'); break;
      default: blob(g, 8, 8, 5, [180, 180, 180], r);
    }
  }
  const rectI = (g, x, y, w, h, c) => { g.fillStyle = col(c); g.fillRect(x, y, w, h); };
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
    if (o.dead || o.sleep) { g.rotate(-1.5); g.translate(-u * 2, 0); }
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
    const shirt = o.body ? (o.body === I.WARDEN_MAIL ? [112, 84, 170] : o.body === I.LEATHER_TUNIC ? [160, 96, 56] : o.body === I.COPPER_MAIL ? [210, 116, 60] : o.body === I.IRON_MAIL ? [186, 194, 208] : [110, 214, 250]) : look.shirt;
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
      const c = o.head === I.LEATHER_CAP ? [160, 96, 56] : o.head === I.COPPER_HELM ? [210, 116, 60] : o.head === I.IRON_HELM ? [186, 194, 208] : [250, 208, 60];
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

  function drawFist(g, cx, cy, u) {
    g.save(); g.translate(Math.round(cx), Math.round(cy)); g.fillStyle = 'rgba(255,170,60,0.18)'; g.beginPath(); g.arc(0, 0, 15 * u, 0, 7); g.fill();
    const R = (x, y, w, h, c) => { g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.fillRect(x * u, y * u, w * u, h * u); };
    R(-9, -9, 18, 18, [88, 92, 108]); R(-9, -9, 18, 3, [118, 122, 140]); R(-9, 6, 18, 3, [58, 60, 74]); R(-6, -5, 4, 10, [62, 64, 78]); R(2, -5, 4, 10, [62, 64, 78]); R(-3, -12, 6, 4, [170, 120, 240]); R(-1, -3, 3, 3, [255, 190, 90]);
    g.restore();
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
      case 'husky': { const ls = o.moving ? Math.sin(t * 13) : 0, sit = o.sit, fur = [150, 154, 164], dk = [104, 108, 120], lt = [206, 210, 218];
        if (sit) { R(-6, -10, 8, 10, fur); R(-6, -10, 8, 2, lt); R(2, -14, 7, 6, fur); R(8, -12, 3, 3, lt); R(2, -17, 2, 4, dk); R(6, -17, 2, 4, dk); R(7.5, -12.5, 1.4, 1.2, [20, 20, 28]); R(-9, -3, 5, 3, dk); R(3, -3, 3, 3, dk); R(4, -6, 3, 6, fur); }
        else { for (const [x, d] of [[-7, 1], [-4, -1], [2, -1], [5, 1]]) R(x, -4, 2, 4 + (d * ls > 0.6 ? -1.2 : 0), dk);
          R(-8, -9, 15, 6, fur); R(-8, -9, 15, 2, lt); R(-5, -8, 5, 2, dk); R(6, -12, 6, 6, fur); R(10, -10, 4, 3, lt); R(6.5, -15, 2, 3, dk); R(9.5, -15, 2, 3, dk); R(11, -9.6, 1.4, 1.2, [20, 20, 28]); R(9.4, -11, 1.4, 1.2, [20, 20, 28]);
          const sw = Math.sin(t * 6) * 1.2; R(-13, -10 + sw, 6, 3, fur); R(-15, -9 + sw, 3, 3, dk); }
        if (o.tamed) R(sit ? 2 : 6, sit ? -9 : -7, sit ? 7 : 6, 1.6, [220, 50, 60]); break; }
      case 'warden': { const ph = o.ph || 1, pulse = 0.6 + Math.sin(t * (ph === 3 ? 7 : 4)) * 0.4, sl = hurt ? [255, 255, 255] : [88, 92, 108], sd = [62, 64, 78], sh = [112, 116, 134];
        const cc = ph === 1 ? [90, 230, 255] : ph === 2 ? [255, 170, 60] : [255, 70, 80], stp = o.moving ? Math.sin(t * 5) * 2 : 0;
        R(-17, -26 + (stp > 0 ? 0 : -1), 12, 26 + (stp > 0 ? 0 : 1), sl); R(5, -26 + (stp < 0 ? 0 : -1), 12, 26 + (stp < 0 ? 0 : 1), sl); R(-19, -4, 16, 4, sd); R(3, -4, 16, 4, sd); R(-17, -26, 3, 24, sh);
        R(-25, -66, 50, 44, sl); R(-25, -66, 50, 4, sh); R(-25, -26, 50, 4, sd); R(-22, -62, 4, 36, sd); R(18, -62, 4, 36, sd);
        for (const [x, y, w, h] of [[-14, -58, 6, 2], [8, -52, 8, 2], [-16, -42, 10, 2], [10, -38, 6, 2], [-4, -30, 8, 2]]) R(x, y, w, h, [48, 50, 62]);
        g.fillStyle = `rgba(${cc[0]},${cc[1]},${cc[2]},${0.18 + pulse * 0.25})`; g.beginPath(); g.arc(0, -46 * u, (13 + pulse * 3) * u, 0, 7); g.fill();
        R(-8, -54, 16, 16, [40, 42, 54]); R(-6, -52, 12, 12, cc.map((q) => Math.round(q * (0.6 + pulse * 0.4)))); R(-3, -50, 4, 4, [255, 255, 255]);
        R(-36, -70, 16, 12, sd); R(20, -70, 16, 12, sd); R(-34, -80, 5, 12, [160, 110, 230]); R(-28, -76, 4, 8, [190, 140, 250]); R(29, -80, 5, 12, [160, 110, 230]); R(24, -76, 4, 8, [190, 140, 250]);
        if (ph !== 2) { R(-36, -60, 10, 32, sl); R(26, -60, 10, 32, sl); R(-38, -30, 14, 12, sh); R(24, -30, 14, 12, sh); R(-38, -20, 14, 2, sd); R(24, -20, 14, 2, sd); }
        else { R(-30, -60, 6, 10, sd); R(24, -60, 6, 10, sd); }
        R(-13, -86, 26, 20, sl); R(-13, -86, 26, 3, sh); R(-10, -69, 20, 4, sd);
        for (const [x, y, w, h] of [[-11, -95, 4, 9], [-3, -101, 5, 15], [6, -95, 4, 9]]) R(x, y, w, h, [170, 120, 240]);
        R(-9, -80, 6, 4, cc); R(3, -80, 6, 4, cc); R(-8, -79, 2, 2, [255, 255, 255]); R(4, -79, 2, 2, [255, 255, 255]);
        if (o.sh) { g.strokeStyle = 'rgba(120,200,255,0.8)'; g.lineWidth = 2 * u; g.beginPath(); g.ellipse(0, -50 * u, 42 * u, 56 * u, 0, 0, 7); g.stroke(); g.fillStyle = 'rgba(120,200,255,0.12)'; g.fill(); }
        if (o.st) for (let i = 0; i < 4; i++) { const a = t * 4 + i * 1.57; R(Math.cos(a) * 14 - 1.5, -104 + Math.sin(a) * 4, 3, 3, [255, 230, 90]); }
        break; }
      case 'skeleton': { const ls = o.moving ? Math.sin(t * 9) : 0, B = [226, 226, 214], D2 = [160, 160, 148]; R(-2.5, -8, 2, 8 + (ls > 0.6 ? -1 : 0), B); R(0.5, -8, 2, 8 + (ls < -0.6 ? -1 : 0), B);
        R(-3, -10, 6, 1.5, D2); R(-2.5, -15, 5, 6, B); R(-1.5, -14, 0.8, 4.5, [40, 40, 44]); R(0.7, -14, 0.8, 4.5, [40, 40, 44]); R(-0.4, -12.5, 0.8, 3, [40, 40, 44]);
        R(-3.5, -23, 7, 7, B); R(-2.5, -21.5, 1.8, 1.8, [24, 24, 30]); R(0.8, -21.5, 1.8, 1.8, [24, 24, 30]); R(-1.5, -18.5, 3, 1.2, [60, 60, 66]);
        R(3.5, -15, 1.5, 6, B); R(4, -22, 1.2, 13, [150, 100, 56]); R(5, -21, 0.8, 11, [210, 210, 220]); R(4.6, -22, 2, 1, [150, 100, 56]); R(4.6, -9, 2, 1, [150, 100, 56]); break; }
      case 'boomer': { const sw = o.fuse ? 1 + Math.min(0.45, o.fuse * 0.3) : 1, fl = o.fuse && Math.sin(t * 22) > 0; const bc = fl ? [255, 240, 200] : [196, 74, 46], dk = fl ? [255, 200, 150] : [140, 46, 34], ls = o.moving ? Math.sin(t * 10) : 0;
        g.save(); g.translate(0, 0); g.scale(sw, sw);
        R(-4, -2, 3, 2 + (ls > 0.5 ? -1 : 0), [60, 40, 36]); R(1, -2, 3, 2 + (ls < -0.5 ? -1 : 0), [60, 40, 36]);
        g.fillStyle = hurt ? '#fff' : col(bc); g.beginPath(); g.ellipse(0, -7 * u, 6.5 * u, 6 * u, 0, 0, 6.3); g.fill(); g.fillStyle = hurt ? '#fff' : col(dk); g.beginPath(); g.ellipse(1.5 * u, -5 * u, 5 * u, 4.4 * u, 0, 0, 6.3); g.fill();
        R(-4, -11, 3, 1.3, [255, 190, 150]); R(-4.5, -9, 3, 2.6, [255, 255, 240]); R(1.5, -9, 3, 2.6, [255, 255, 240]); R(-3.2, -8.4, 1.4, 1.6, [20, 10, 10]); R(2.6, -8.4, 1.4, 1.6, [20, 10, 10]); R(-4.8, -10.6, 4, 1, [60, 20, 16]); R(1.2, -10.6, 4, 1, [60, 20, 16]); R(-2, -4.5, 4, 1.4, [40, 16, 12]);
        R(-0.5, -15, 1.2, 3, [110, 90, 60]); const sp = Math.sin(t * 30); R(-1.5, -17.5, 3, 2.5, sp > 0 ? [255, 210, 60] : [255, 120, 40]); R(-0.5, -18.5, 1, 1.5, [255, 255, 200]); g.restore(); break; }
      case 'spider': { const lg = o.moving ? Math.sin(t * 16) : Math.sin(t * 2) * 0.3; for (let i = 0; i < 4; i++) { const k = i * 1.8 - 2.7, sw = Math.sin(t * 16 + i) * (o.moving ? 1 : 0.2); R(k - 1 - 1, -5 + sw * 0.5, 1.2, 5, [54, 40, 40]); R(k + 1, -5 - sw * 0.5, 1.2, 5, [54, 40, 40]); R(k - 3.5, -6, 3, 1.2, [54, 40, 40]); R(k + 3, -6, 3, 1.2, [54, 40, 40]); }
        R(-6, -8, 7, 5.5, [70, 52, 60]); R(-5, -8.5, 5, 1.5, [100, 70, 86]); R(1, -7, 5, 4.5, [60, 44, 52]); R(4, -6.5, 1.3, 1.3, [255, 50, 50]); R(5.2, -5.4, 1.1, 1.1, [255, 50, 50]); R(-5, -6, 1.4, 1.4, [180, 60, 90]); R(-3, -5.5, 1.4, 1.4, [180, 60, 90]); break; }
      case 'cow': { const ls = o.moving ? Math.sin(t * 8) * 1.2 : 0, v = o.id % 2; const body = v ? [120, 78, 48] : [244, 240, 234], spot = v ? [226, 214, 196] : [52, 48, 52];
        for (const [x, d] of [[-8, 1], [-3, -1], [2, 1], [6, -1]]) R(x, -6, 3, 6 + (d * ls > 0.6 ? -1 : 0), [(body[0] * 0.7) | 0, (body[1] * 0.7) | 0, (body[2] * 0.7) | 0]);
        R(-10, -15, 19, 9, body); R(-10, -15, 19, 2, [255, 255, 255, 0].slice(0, 3).map((q, i) => Math.min(255, body[i] + 14))); R(-6, -14, 5, 4, spot); R(1, -11, 6, 4, spot); R(-9, -10, 3, 3, spot);
        R(8, -19, 8, 8, body); R(13, -14, 3, 4, [236, 170, 170]); R(9, -21, 1.6, 2.5, [230, 226, 214]); R(13.5, -21, 1.6, 2.5, [230, 226, 214]); R(8, -18, 2, 3, spot); R(12.5, -17, 1.4, 1.4, [30, 24, 24]);
        R(-12, -14, 2, 7, [90, 70, 60]); R(-12, -8, 2.5, 2, [50, 40, 36]); R(-4, -7, 4, 2, [236, 170, 170]); break; }
      case 'pig': { const ls = o.moving ? Math.sin(t * 10) * 1 : 0; for (const x of [-6, -2, 2, 5]) R(x, -3, 2.4, 3 + (Math.sin(t * 10 + x) * ls > 0.5 ? -1 : 0), [214, 120, 130]);
        R(-8, -10, 15, 8, [244, 160, 170]); R(-8, -10, 15, 2, [255, 190, 196]); R(6, -11, 6, 7, [244, 160, 170]); R(10, -9, 3, 3.5, [224, 124, 140]); R(11, -8.5, 0.9, 1.2, [120, 50, 70]); R(12, -8.5, 0.9, 1.2, [120, 50, 70]); R(8, -9.5, 1.3, 1.3, [40, 20, 30]); R(6.5, -13, 2.5, 2.5, [226, 128, 142]);
        R(-10, -9, 2, 1.5, [226, 128, 142]); R(-11, -8, 1.5, 1.5, [226, 128, 142]); break; }
      case 'sheep': { const ls = o.moving ? Math.sin(t * 9) : 0; for (const x of [-6, -2.5, 2, 5]) R(x, -4, 2, 4 + (ls * (x > 0 ? 1 : -1) > 0.6 ? -1 : 0), [70, 64, 60]);
        for (const [x, y, w, h] of [[-9, -13, 8, 8], [-4, -14, 9, 9], [1, -13, 8, 8], [-8, -9, 15, 5]]) R(x, y, w, h, [244, 242, 236]); for (const [x, y] of [[-6, -12], [0, -13], [5, -11], [-3, -8], [3, -8]]) R(x, y, 2, 2, [255, 255, 255]); for (const [x, y] of [[-8, -7], [4, -6]]) R(x, y, 2, 1.5, [216, 214, 206]);
        R(7, -13, 6, 6, [70, 64, 60]); R(7, -14, 5, 2, [244, 242, 236]); R(11, -11.5, 1.4, 1.4, [255, 255, 255]); R(6, -12, 2, 2.5, [52, 46, 44]); break; }
      case 'chicken': { const pk = o.moving ? Math.sin(t * 14) * 0.8 : Math.sin(t * 3) * 0.4; R(-1, -2.5, 1, 2.5, [236, 168, 50]); R(2, -2.5, 1, 2.5, [236, 168, 50]); R(-1.5, -1, 2.5, 1, [236, 168, 50]); R(1.5, -1, 2.5, 1, [236, 168, 50]);
        R(-4, -8, 8, 6, [250, 248, 244]); R(-6, -9, 3, 4, [232, 226, 214]); R(-5, -10 + pk, 2, 2, [244, 240, 232]); R(-3, -6, 5, 3, [236, 232, 222]); R(2, -12, 4, 5, [250, 248, 244]); R(5, -10.5, 2.5, 1.6, [244, 170, 40]); R(3, -13.2, 2.4, 1.8, [214, 52, 60]); R(5, -9, 1.2, 1.6, [214, 52, 60]); R(4, -11, 1, 1, [20, 20, 20]); break; }
      case 'deer': { const ls = o.moving ? Math.sin(t * 11) : 0; for (const [x, d] of [[-8, 1], [-5, -1], [3, -1], [6, 1]]) R(x, -8, 1.8, 8 + (d * ls > 0.6 ? -1.5 : 0), [120, 82, 52]);
        R(-9, -15, 17, 8, [176, 124, 76]); R(-9, -15, 17, 2, [196, 144, 92]); R(-4, -9, 10, 2, [232, 210, 176]); for (const [x, y] of [[-6, -13], [-2, -14], [2, -12], [-4, -11]]) R(x, -y > 0 ? y : y, 1.3, 1.3, [240, 224, 196]); R(5, -22, 4, 9, [176, 124, 76]); R(6, -25, 7, 5, [188, 134, 84]); R(11, -24, 2.5, 2.5, [60, 40, 30]); R(8, -24, 1.4, 1.4, [20, 16, 16]);
        R(6, -27, 2, 3, [150, 100, 64]); R(-11, -15, 3, 3, [244, 238, 226]); g.fillStyle = hurt ? '#fff' : col([96, 68, 46]); for (const [x0, h] of [[8, 6], [11, 5]]) { g.fillRect(x0 * u, (-25 - h) * u, 1.2 * u, h * u); g.fillRect((x0 + (x0 > 9 ? 1.5 : -1.5)) * u, (-25 - h + 1.5) * u, 1.2 * u, 2 * u); } break; }
      case 'fox': { const ls = o.moving ? Math.sin(t * 13) : 0; for (const [x, d] of [[-6, 1], [-3, -1], [2, -1], [5, 1]]) R(x, -3.5, 1.8, 3.5 + (d * ls > 0.6 ? -1 : 0), [56, 40, 34]);
        R(-7, -9, 12, 6, [226, 120, 40]); R(-7, -9, 12, 1.6, [244, 150, 66]); R(-3, -5, 8, 2, [250, 240, 224]); R(4, -11.5, 6, 5.5, [226, 120, 40]); R(9, -8.5, 3, 2.5, [250, 240, 224]); R(11, -8.5, 1.4, 1.4, [30, 20, 20]); R(4.5, -14, 2, 3, [226, 120, 40]); R(8, -14, 2, 3, [226, 120, 40]); R(4.8, -14, 1.2, 1.4, [40, 28, 26]); R(8.4, -14, 1.2, 1.4, [40, 28, 26]); R(7, -10.5, 1.2, 1.2, [24, 20, 20]);
        const sw = Math.sin(t * 4) * 1; R(-13, -10 + sw, 7, 4.5, [226, 120, 40]); R(-15, -9.5 + sw, 3, 3.5, [250, 245, 235]); break; }
      case 'camel': { const ls = o.moving ? Math.sin(t * 6) : 0; for (const [x, d] of [[-10, 1], [-7, -1], [4, -1], [7, 1]]) R(x, -9, 2.4, 9 + (d * ls > 0.6 ? -1.5 : 0), [190, 150, 98]);
        R(-12, -19, 22, 11, [214, 176, 118]); R(-12, -19, 22, 2, [232, 198, 140]); R(-7, -24, 5, 5, [206, 166, 108]); R(1, -24, 5, 5, [206, 166, 108]); R(-7, -24, 5, 1.2, [226, 190, 132]); R(1, -24, 5, 1.2, [226, 190, 132]);
        R(8, -27, 4, 11, [206, 166, 108]); R(9, -30, 8, 5, [214, 176, 118]); R(15, -28.5, 2.5, 3.5, [168, 124, 80]); R(11, -29, 1.4, 1.4, [24, 20, 20]); R(9.5, -32, 2, 2.5, [190, 150, 98]); R(-14, -18, 2, 8, [190, 150, 98]); R(-6, -10, 10, 2, [150, 90, 70]); break; }
      case 'penguin': { const w = o.moving ? Math.sin(t * 9) * 0.1 : 0; g.save(); g.rotate(w); R(-3.5, -12, 8, 11, [36, 40, 52]); R(-2, -10, 5, 8, [248, 248, 252]); R(-2.5, -15.5, 7, 5, [36, 40, 52]); R(2, -13, 3.2, 1.6, [244, 150, 40]); R(0.6, -14.2, 1.2, 1.2, [255, 255, 255]); R(1, -14, 0.8, 0.8, [10, 10, 10]); R(-4.5, -9, 1.5, 4, [24, 28, 38]); R(4, -9, 1.5, 4, [24, 28, 38]); R(-2.5, -1, 3, 1.6, [244, 150, 40]); R(1.5, -1, 3, 1.6, [244, 150, 40]); g.restore(); break; }
      case 'turtle': { const hd = o.moving ? Math.sin(t * 4) * 0.6 : 0; for (const x of [-5, 3]) R(x, -2, 2.4, 2, [104, 150, 72]); g.fillStyle = hurt ? '#fff' : col([70, 120, 60]); g.beginPath(); g.ellipse(0, -4.5 * u, 8 * u, 5 * u, 0, Math.PI, 0); g.fill(); R(-8, -4.5, 16, 2, [56, 98, 50]); R(-5, -8, 3, 2.5, [96, 150, 80]); R(0, -8.5, 3, 2.5, [96, 150, 80]); R(-2, -5.5, 3, 2, [96, 150, 80]); R(7, -5 + hd, 4.5, 3.2, [128, 178, 92]); R(10, -4.5 + hd, 1, 1, [20, 20, 20]); R(-10, -3, 2.5, 1.2, [104, 150, 72]); break; }
      case 'bear': { const ls = o.moving ? Math.sin(t * 7) : 0; for (const [x, d] of [[-9, 1], [-5, -1], [3, -1], [7, 1]]) { R(x, -8, 3.4, 8 + (d * ls > 0.6 ? -1 : 0), [78, 50, 30]); R(x, -1.2, 3.4, 1.2, [30, 22, 18]); }
        R(-11, -17, 21, 11, [104, 68, 40]); R(-11, -17, 21, 2.4, [126, 86, 52]); R(8, -21, 9, 9, [112, 74, 44]); R(14, -16.5, 4.5, 4.5, [168, 126, 84]); R(16.5, -16, 1.6, 1.6, [20, 14, 12]); R(8.5, -23, 2.6, 2.6, [88, 58, 34]); R(13.5, -23, 2.6, 2.6, [88, 58, 34]); R(11.5, -19, 1.4, 1.4, o.angry ? [255, 60, 40] : [20, 14, 12]); R(-13, -15, 3, 3, [88, 58, 34]); break; }
      case 'fish': { const w = Math.sin(t * 10) * 1.2, v = o.id % 3, c = v === 0 ? [236, 140, 60] : v === 1 ? [140, 170, 204] : [210, 90, 90], dk = [(c[0] * 0.65) | 0, (c[1] * 0.65) | 0, (c[2] * 0.65) | 0];
        R(-5, -6, 9, 4, c); R(-3, -7, 5, 1.5, dk); R(-3, -3, 5, 1.5, [Math.min(255, c[0] + 30), Math.min(255, c[1] + 30), Math.min(255, c[2] + 30)]); R(2, -5.5, 1.3, 1.3, [20, 20, 20]); g.fillStyle = hurt ? '#fff' : col(dk); g.beginPath(); g.moveTo(-5 * u, -4 * u); g.lineTo(-9 * u, (-7 + w) * u); g.lineTo(-9 * u, (-1 + w) * u); g.fill(); break; }
      case 'bird': { const fl = Math.sin(t * 24) * 3, v = o.id % 3, c = v === 0 ? [214, 60, 56] : v === 1 ? [70, 130, 214] : [150, 110, 76]; R(-3, -4, 6, 4, c); R(2, -6, 3.5, 3.5, c); R(5, -5, 2, 1.2, [250, 190, 50]); R(3.6, -5.4, 1, 1, [20, 20, 20]); R(-5, -3, 3, 1.6, [(c[0] * 0.7) | 0, (c[1] * 0.7) | 0, (c[2] * 0.7) | 0]); g.fillStyle = hurt ? '#fff' : col([(c[0] * 0.8) | 0, (c[1] * 0.8) | 0, (c[2] * 0.8) | 0]); g.beginPath(); g.moveTo(-1 * u, -4 * u); g.lineTo(-3 * u, (-4 - 4 + fl * 0.4) * u); g.lineTo(2 * u, (-4 - 3 + fl * 0.4) * u); g.fill(); break; }
      default: R(-4, -8, 8, 8, [200, 60, 200]);
    }
    g.restore();
  }

  function init() { buildAtlas(); }
  return { init, drawShape, TS, VARS, BG, get atlas() { return atlas; }, get cracks() { return cracks; }, avg: (id) => avg[id] || [128, 128, 128], icon, iconURL, drawPlayer, drawMob, drawFist, playerLook, PAL, rng, hash };
})();
