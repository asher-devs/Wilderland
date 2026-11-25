/* Animated main-menu backdrop: parallax hills, drifting clouds, pixel trees, fireflies. */
(() => {
  const cv = document.getElementById('bg'), g = cv.getContext('2d'); let w, h, t = 0;
  const rs = () => { w = cv.width = innerWidth >> 1; h = cv.height = innerHeight >> 1; }; rs(); addEventListener('resize', rs);
  const flies = Array.from({ length: 30 }, () => ({ x: Math.random(), y: 0.55 + Math.random() * 0.4, p: Math.random() * 9 }));
  function hills(base, amp, f, col, sp, trees) {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 3) g.lineTo(x, Math.round(base + Math.sin((x + t * sp) * f) * amp + Math.sin((x + t * sp) * f * 2.7) * amp * 0.4)); g.lineTo(w, h); g.fill();
    if (trees) for (let x = -20; x < w + 20; x += 26) { const wx = x - ((t * sp) % 26), y = base + Math.sin((wx + t * sp) * f) * amp + Math.sin((wx + t * sp) * f * 2.7) * amp * 0.4; g.fillStyle = '#4a2f16'; g.fillRect(wx, y - 12, 3, 12); g.fillStyle = trees; g.fillRect(wx - 6, y - 24, 15, 9); g.fillRect(wx - 3, y - 29, 9, 6); g.fillStyle = col; }
  }
  function draw() {
    requestAnimationFrame(draw); if (document.body.classList.contains('playing')) return; t += 0.4;
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a6fc8'); gr.addColorStop(0.6, '#f5b98a'); gr.addColorStop(1, '#ffd89a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff2b0'; g.fillRect(w * 0.72, h * 0.22, 26, 26); g.fillStyle = 'rgba(255,240,160,.25)'; g.fillRect(w * 0.72 - 10, h * 0.22 - 10, 46, 46);
    g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 5; i++) { const x = ((i * 190 + t * (0.2 + i * 0.05)) % (w + 120)) - 60, y = 30 + i * 22; g.fillRect(x, y, 60, 8); g.fillRect(x + 12, y - 6, 34, 8); }
    hills(h * 0.62, 18, 0.011, '#7a8fc0', 0.15); hills(h * 0.72, 14, 0.016, '#4f8a6a', 0.4); hills(h * 0.82, 10, 0.022, '#2f6a42', 0.9, '#3a8a46'); hills(h * 0.93, 6, 0.03, '#1d4a2c', 1.6);
    for (const f of flies) { const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.05 + f.p)); g.fillStyle = `rgba(240,255,140,${a})`; g.fillRect((f.x * w + Math.sin(t * 0.02 + f.p) * 20 + w) % w, f.y * h + Math.cos(t * 0.03 + f.p) * 10, 2, 2); }
  }
  draw();
})();
