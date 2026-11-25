/* WILDERLAND audio: fully synthesized SFX, generative background music and ambience (WebAudio, no asset files). */
const Sound = (() => {
  let ctx = null, master, sfxG, musG, ambG, noiseBuf, started = false;
  const vol = { master: 0.8, sfx: 0.8, music: 0.5 };
  let ctxState = { day: 1, depth: 0, biome: 0 };

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); sfxG = ctx.createGain(); musG = ctx.createGain(); ambG = ctx.createGain();
    const comp = ctx.createDynamicsCompressor(); sfxG.connect(master); musG.connect(master); ambG.connect(master); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVol(); return ctx;
  }
  function applyVol() { if (!ctx) return; master.gain.value = vol.master; sfxG.gain.value = vol.sfx; musG.gain.value = vol.music * 0.7; ambG.gain.value = vol.sfx * 0.5; }
  function setVolumes(v) { Object.assign(vol, v); applyVol(); }

  function tone(freq, dur, type = 'sine', gain = 0.2, opt = {}) {
    if (!ctx) return; const t0 = ctx.currentTime + (opt.delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opt.slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + (opt.attack || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(opt.dest || sfxG); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, gain, f0, f1, type = 'lowpass', opt = {}) {
    if (!ctx) return; const t0 = ctx.currentTime + (opt.delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = opt.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur); f.Q.value = opt.q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(opt.dest || sfxG); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  const mats = { soft: [900, 0.5], stone: [2400, 0.9], wood: [1300, 0.7], ore: [3200, 1.0], metal: [3600, 1.0], glass: [5200, 0.6], leaf: [4000, 0.3] };
  function matOf(id) { const b = DEFS.BLOCKS[id]; if (!b) return 'stone'; if (id === DEFS.T.LEAVES || id === DEFS.T.PLANT) return 'leaf'; return b.mat === 'none' ? 'stone' : (mats[b.mat] ? b.mat : 'stone'); }

  const sfx = {
    hit(id) { const [f, g] = mats[matOf(id)]; noise(0.07, 0.35 * g, f, f * 0.3, 'lowpass', { rate: 0.8 + Math.random() * 0.5 }); tone(120 + Math.random() * 40, 0.06, 'square', 0.05 * g, { slide: 0.6 }); },
    break(id) { const [f, g] = mats[matOf(id)]; noise(0.22, 0.55 * g, f * 1.4, f * 0.2, 'lowpass'); tone(160, 0.16, 'triangle', 0.14, { slide: 0.5 }); if (id === DEFS.T.CRYSTAL) { tone(1320, 0.5, 'sine', 0.1); tone(1760, 0.6, 'sine', 0.08, { delay: 0.06 }); } },
    place(id) { const m = matOf(id); noise(0.08, 0.3, m === 'wood' ? 1500 : m === 'glass' ? 3000 : 900, 300); tone(m === 'stone' || m === 'metal' ? 180 : 130, 0.1, 'triangle', 0.18, { slide: 0.7 }); },
    jump() { tone(280, 0.14, 'square', 0.05, { slide: 1.8 }); noise(0.05, 0.08, 2000, 800, 'highpass'); },
    land() { noise(0.09, 0.22, 500, 120); },
    step() { noise(0.04, 0.05, 900 + Math.random() * 400, 300); },
    hurt() { tone(220, 0.25, 'sawtooth', 0.16, { slide: 0.45 }); noise(0.12, 0.2, 1500, 300); },
    die() { tone(330, 0.9, 'sawtooth', 0.15, { slide: 0.2 }); tone(165, 1.0, 'triangle', 0.15, { slide: 0.3 }); },
    swing() { noise(0.14, 0.2, 800, 3000, 'bandpass', { q: 2 }); },
    mobhit() { tone(180, 0.12, 'square', 0.1, { slide: 0.5 }); noise(0.1, 0.25, 1800, 400); },
    mobdie() { tone(400, 0.25, 'square', 0.09, { slide: 0.25 }); noise(0.2, 0.25, 1200, 150); },
    pickup() { tone(880, 0.07, 'sine', 0.09); tone(1320, 0.1, 'sine', 0.08, { delay: 0.05 }); },
    craft() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.1, { delay: i * 0.07 })); },
    heal() { [440, 554, 659].forEach((f, i) => tone(f, 0.25, 'sine', 0.1, { delay: i * 0.08 })); },
    click() { tone(660, 0.04, 'square', 0.04); },
    open() { tone(300, 0.09, 'triangle', 0.1, { slide: 1.5 }); },
    close() { tone(400, 0.09, 'triangle', 0.1, { slide: 0.6 }); },
    chat() { tone(988, 0.08, 'sine', 0.08); tone(1318, 0.1, 'sine', 0.07, { delay: 0.07 }); },
    join() { [392, 523, 659].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, { delay: i * 0.08 })); },
    leave() { [659, 523, 392].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, { delay: i * 0.08 })); },
    toolbreak() { noise(0.3, 0.4, 3000, 300, 'bandpass'); tone(200, 0.3, 'square', 0.08, { slide: 0.3 }); },
    treefall() { noise(0.9, 0.3, 700, 150, 'bandpass', { q: 3 }); tone(90, 0.9, 'sawtooth', 0.06, { slide: 0.5 }); },
    thud() { noise(0.25, 0.7, 400, 60); tone(70, 0.3, 'sine', 0.3, { slide: 0.4 }); },
    clink() { tone(2400, 0.07, 'square', 0.05, { slide: 0.7 }); noise(0.05, 0.2, 4000, 2000, 'highpass'); },
    thunder() { noise(2.2, 0.8, 500, 40); },
    smoke() { noise(0.2, 0.06, 2500, 800, 'highpass'); },
    splash() { noise(0.25, 0.25, 2500, 400, 'bandpass', { q: 0.8 }); },
    dawn() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.7, 'sine', 0.06, { delay: i * 0.12 })); },
    dusk() { [392, 330, 262].forEach((f, i) => tone(f, 0.9, 'sine', 0.06, { delay: i * 0.18 })); },
  };
  function play(name, a) { if (!ctx || ctx.state !== 'running') return; try { (sfx[name] || (() => {}))(a); } catch (e) { /* ignore */ } }

  // ---------- music: slow generative pads + sparse pentatonic melody that changes with time/depth/biome
  const SCALES = { day: [0, 2, 4, 7, 9], night: [0, 3, 5, 7, 10], cave: [0, 2, 3, 7, 8], snow: [0, 2, 4, 7, 11], desert: [0, 1, 4, 5, 7, 8] };
  const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let nextNote = 0, chordIdx = 0, lastChordT = 0;
  const PROG = [0, 5, 3, 7, 0, 5, 7, 2];
  function musicTick() {
    if (!ctx || ctx.state !== 'running' || vol.music <= 0.01) return;
    const now = ctx.currentTime; if (now < nextNote) return;
    const s = ctxState; let key = 'day', root = 57;
    if (s.depth > 8) { key = 'cave'; root = 45; } else if (s.day < 0.5) { key = 'night'; root = 50; } else if (s.biome === 2) { key = 'snow'; root = 62; } else if (s.biome === 1) { key = 'desert'; root = 55; }
    const scale = SCALES[key];
    const beat = key === 'cave' ? 2.4 : key === 'night' ? 1.8 : 1.3;
    if (now - lastChordT > beat * 4) { lastChordT = now; chordIdx = (chordIdx + 1) % PROG.length; const base = root + PROG[chordIdx] - (PROG[chordIdx] > 6 ? 12 : 0); [0, 7, 12].forEach((iv, i) => tone(mf(base + iv - 12), beat * 4.2, key === 'cave' ? 'sine' : 'triangle', 0.05, { dest: musG, attack: 1.2, delay: i * 0.05 })); }
    if (Math.random() < (key === 'cave' ? 0.5 : 0.75)) {
      const deg = scale[(Math.random() * scale.length) | 0], oct = [12, 12, 24][(Math.random() * 3) | 0];
      const n = root + PROG[chordIdx] + deg + oct; tone(mf(n), beat * 1.6, key === 'night' ? 'sine' : 'triangle', 0.07, { dest: musG, attack: 0.02 });
      if (Math.random() < 0.3) tone(mf(n + 12), beat, 'sine', 0.03, { dest: musG, delay: beat * 0.5, attack: 0.02 });
    }
    nextNote = now + beat * (0.5 + Math.random() * 0.8);
  }
  // ---------- ambience
  let windNode = null, windGain, nextAmb = 0, rainGain = null;
  function ambTick() {
    if (!ctx || ctx.state !== 'running') return;
    if (!windNode) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6; windGain = ctx.createGain(); windGain.gain.value = 0; s.connect(f); f.connect(windGain); windGain.connect(ambG); s.start(); windNode = { f }; }
    if (!rainGain) { const rs = ctx.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true; const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1800; rainGain = ctx.createGain(); rainGain.gain.value = 0; rs.connect(rf); rf.connect(rainGain); rainGain.connect(ambG); rs.start(); }
    const s = ctxState, t = ctx.currentTime;
    rainGain.gain.setTargetAtTime((s.depth < 4 ? 1 : 0.15) * (s.rain || 0) * 0.22, t, 0.8);
    const surface = s.depth < 4 ? 1 : 0; windGain.gain.setTargetAtTime(surface * (s.biome === 2 ? 0.18 : 0.07) + (s.depth > 8 ? 0.015 : 0), t, 1.5); windNode.f.frequency.setTargetAtTime(300 + Math.sin(t / 5) * 120 + (s.biome === 2 ? 200 : 0), t, 1);
    if (t < nextAmb) return; nextAmb = t + 0.8 + Math.random() * 2.2;
    if (s.depth > 8) { if (Math.random() < 0.5) tone(1800 + Math.random() * 600, 0.25, 'sine', 0.05, { slide: 0.6, dest: ambG }); }
    else if (s.day < 0.5 && s.biome === 0) { for (let i = 0; i < 3; i++) tone(3200, 0.05, 'sine', 0.025, { delay: i * 0.09, dest: ambG }); }
    else if (s.biome === 0 && Math.random() < 0.5) { const f = 2200 + Math.random() * 1500; tone(f, 0.09, 'sine', 0.04, { slide: 1.3, dest: ambG }); tone(f * 1.2, 0.08, 'sine', 0.03, { delay: 0.12, slide: 1.2, dest: ambG }); }
  }
  setInterval(() => { musicTick(); ambTick(); }, 250);
  document.addEventListener('pointerdown', () => ensure(), { once: false, passive: true });
  document.addEventListener('keydown', () => ensure(), { passive: true });
  return { ensure, play, setVolumes, vol, setContext(c) { Object.assign(ctxState, c); } };
})();
