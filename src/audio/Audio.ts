import { G } from '../core/GameState';

let actx: AudioContext | null = null;
let mGain: GainNode | null = null;
let dNode: DelayNode | null = null;
let ambTO: ReturnType<typeof setTimeout> | null = null;

/* ─── Background Music ─── */
let bgMusic: HTMLAudioElement | null = null;
let fgMusic: HTMLAudioElement | null = null;
let bgMusicPlaying = false;
let musicVolMult = 1.0;
let sfxVolMult = 1.0;

export function setMusicVolume(v: number): void {
  musicVolMult = v;
  // Actual bgMusic/fgMusic volumes are scaled in updateMusic
}
export function setSfxVolume(v: number): void {
  sfxVolMult = v;
  if (mGain) mGain.gain.value = 0.35 * sfxVolMult;
}

export function ensureAudio(): void {
  if (actx) {
    if (actx.state === 'suspended') actx.resume();
    startBGMusic();
    startAmbientEnv();
    return;
  }
  actx = new (window.AudioContext || (window as any).webkitAudioContext)();
  mGain = actx.createGain();
  mGain.gain.value = 0.35;
  mGain.connect(actx.destination);
  dNode = actx.createDelay();
  dNode.delayTime.value = 0.28;
  const fb = actx.createGain();
  fb.gain.value = 0.22;
  dNode.connect(fb);
  fb.connect(dNode);
  dNode.connect(mGain);

  startBGMusic();
}

function startBGMusic(): void {
  if (bgMusicPlaying) return;
  if (!bgMusic) {
    bgMusic = new Audio('/audio/music/Beyond_the_Winding_Ridge.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.18;
    
    fgMusic = new Audio('/audio/music/Siege_at_the_Gates.mp3');
    fgMusic.loop = true;
    fgMusic.volume = 0;
  }
  
  Promise.all([bgMusic.play(), fgMusic!.play()]).then(() => {
    bgMusicPlaying = true;
  }).catch(() => {
    /* Autoplay blocked — will retry on next user interaction */
  });
}

export function updateMusic(dt: number): void {
  if (!bgMusicPlaying || !bgMusic || !fgMusic) return;
  
  if (G.combatTimer > 0) {
    bgMusic.volume = Math.max(0, bgMusic.volume - 0.2 * dt);
    fgMusic.volume = Math.min(0.25 * musicVolMult, fgMusic.volume + 0.25 * dt);
  } else {
    bgMusic.volume = Math.min(0.18 * musicVolMult, bgMusic.volume + 0.15 * dt);
    fgMusic.volume = Math.max(0, fgMusic.volume - 0.2 * dt);
  }

  updateMusicLayers(dt);
}

/* ─── Dynamic Music Layers ─── */
let layerPad: OscillatorNode | null = null;
let layerPad2: OscillatorNode | null = null;
let layerGain: GainNode | null = null;
let layerFilter: BiquadFilterNode | null = null;
let layerTarget = 0;

const LANDMARK_POS: [number, number][] = [
  [45, -30],   // Bridge
  [-50, 40],   // Tower
  [30, 60],    // Shrine
  [-40, -45],  // Ruins
];

function ensureMusicLayers(): void {
  if (!actx || layerPad) return;
  /* Warm pad: two detuned sine oscillators through a low-pass filter */
  const g = actx.createGain();
  g.gain.setValueAtTime(0, actx.currentTime);
  const lp = actx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(400, actx.currentTime);
  lp.Q.setValueAtTime(1, actx.currentTime);

  const o1 = actx.createOscillator();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(110, actx.currentTime); // A2
  o1.detune.setValueAtTime(-8, actx.currentTime);

  const o2 = actx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(165, actx.currentTime); // E3 (fifth)
  o2.detune.setValueAtTime(6, actx.currentTime);

  o1.connect(lp);
  o2.connect(lp);
  lp.connect(g);
  g.connect(mGain!);
  o1.start();
  o2.start();

  layerPad = o1;
  layerPad2 = o2;
  layerGain = g;
  layerFilter = lp;
}

function updateMusicLayers(dt: number): void {
  if (!actx) return;
  ensureMusicLayers();
  if (!layerGain || !layerFilter || !layerPad || !layerPad2) return;

  const p = G.player?.position;
  if (!p) return;

  /* Determine target intensity (0-1) from context */
  let intensity = 0;

  /* Near landmarks → gentle pad swell */
  let minDist = Infinity;
  for (const [lx, lz] of LANDMARK_POS) {
    const dx = p.x - lx, dz = p.z - lz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < minDist) minDist = d;
  }
  if (minDist < 30) intensity = Math.max(intensity, 1 - minDist / 30);

  /* Night time → eerie layer */
  const isNight = G.dayTime > 0.35 && G.dayTime < 0.85;
  if (isNight) intensity = Math.max(intensity, 0.5);

  /* Boss fight → dramatic layer boost */
  if (G.bossActive) intensity = 1;

  /* In combat but not boss → slight intensity */
  if (G.combatTimer > 0 && !G.bossActive) intensity = Math.max(intensity, 0.35);

  layerTarget = intensity;

  /* Smooth volume ramp */
  const cur = layerGain.gain.value;
  const maxVol = 0.018;
  const goal = layerTarget * maxVol;
  const speed = layerTarget > cur / maxVol ? 0.8 : 0.5; // fade in faster than out
  const next = cur + (goal - cur) * Math.min(1, speed * dt);
  layerGain.gain.setTargetAtTime(next, actx.currentTime, 0.1);

  /* Shift pitch and filter based on context */
  if (G.bossActive) {
    layerPad.frequency.setTargetAtTime(82.4, actx.currentTime, 0.3);  // E2 — darker
    layerPad2.frequency.setTargetAtTime(123.5, actx.currentTime, 0.3); // B2
    layerFilter.frequency.setTargetAtTime(600, actx.currentTime, 0.3);
  } else if (isNight) {
    layerPad.frequency.setTargetAtTime(98, actx.currentTime, 0.5);    // G2
    layerPad2.frequency.setTargetAtTime(146.8, actx.currentTime, 0.5); // D3
    layerFilter.frequency.setTargetAtTime(350, actx.currentTime, 0.5);
  } else {
    layerPad.frequency.setTargetAtTime(110, actx.currentTime, 0.5);   // A2
    layerPad2.frequency.setTargetAtTime(165, actx.currentTime, 0.5);  // E3
    layerFilter.frequency.setTargetAtTime(400, actx.currentTime, 0.5);
  }
}

function syn(
  f: number,
  t: OscillatorType = 'sine',
  d = 0.2,
  v = 0.05,
  s = 0,
): void {
  if (!actx) return;
  const o = actx.createOscillator();
  const g = actx.createGain();
  const now = actx.currentTime;
  o.type = t;
  o.frequency.setValueAtTime(Math.max(20, f), now);
  if (s) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + s), now + d);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), now + d * 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  o.connect(g);
  g.connect(mGain!);
  if (t === 'sine' || t === 'triangle') g.connect(dNode!);
  o.start(now);
  o.stop(now + d + 0.02);
}

export const SFX = {
  jump() { syn(180, 'sine', 0.28, 0.09, 160); },
  glide() { syn(220, 'triangle', 0.6, 0.04, -70); },
  swing(c?: number) { syn([840, 920, 780, 1000, 1100][(c || 0) % 5], 'sawtooth', 0.13, 0.06, -520); },
  hit() { syn(120, 'square', 0.2, 0.08, -40); },
  /* Element-specific hit sounds */
  hitPyro()    { syn(180, 'sawtooth', 0.18, 0.07, -60); syn(400, 'sine', 0.1, 0.03, 100); },
  hitCryo()    { syn(800, 'sine', 0.22, 0.05, -400); syn(1200, 'triangle', 0.12, 0.03, -200); },
  hitElectro() { syn(600, 'square', 0.08, 0.06, 500); syn(1400, 'sawtooth', 0.06, 0.04, -800); },
  hitHydro()   { syn(200, 'sine', 0.25, 0.06, -80); syn(100, 'triangle', 0.15, 0.03, 40); },
  hitAnemo()   { syn(300, 'triangle', 0.3, 0.05, 120); },
  crit() { syn(200, 'square', 0.25, 0.12, -60); syn(800, 'sine', 0.15, 0.06, 200); },
  skill() { syn(330, 'triangle', 0.6, 0.08, 140); },
  burst() { syn(140, 'triangle', 1.2, 0.12, 500); syn(420, 'sine', 1, 0.08, 120); },
  collect() { [523, 660, 784, 1046].forEach((f, i) => setTimeout(() => syn(f, 'sine', 0.9, 0.08), i * 80)); },
  chest() { [392, 523, 660, 784, 1046].forEach((f, i) => setTimeout(() => syn(f, 'triangle', 0.6, 0.07), i * 100)); },
  talk() { syn(560 + Math.random() * 140, 'sine', 0.09, 0.04); },
  damage() { syn(160, 'sawtooth', 0.35, 0.16, -110); },
  swap() { syn(450, 'triangle', 0.18, 0.06, 60); },
  reaction() { syn(600, 'triangle', 0.5, 0.1, 300); syn(300, 'sine', 0.8, 0.06, 100); },
  lvlUp() { [523, 660, 784, 1046, 1318].forEach((f, i) => setTimeout(() => syn(f, 'sine', 1.2, 0.09), i * 120)); },
  dash() { syn(400, 'sine', 0.15, 0.05, -200); },
  heal() { syn(440, 'sine', 0.5, 0.06, 220); },
  shield() { syn(280, 'triangle', 0.4, 0.07, 100); syn(560, 'sine', 0.3, 0.05, 80); },
  bossRoar() { syn(80, 'sawtooth', 0.8, 0.15, -30); syn(60, 'square', 1, 0.1, -20); },
  arrow() { syn(900, 'sine', 0.12, 0.04, -600); },
  /* Footsteps — different synthesis per surface */
  footGrass() { syn(60 + Math.random() * 30, 'sine', 0.08, 0.02, -20); },
  footStone() { syn(200 + Math.random() * 60, 'square', 0.06, 0.03, -80); },
  footWater() { syn(90 + Math.random() * 40, 'triangle', 0.12, 0.025, 30); syn(250, 'sine', 0.08, 0.01, -60); },
  /* UI sounds */
  menuOpen()  { syn(660, 'sine', 0.12, 0.04, 120); syn(880, 'triangle', 0.08, 0.02, 60); },
  menuClose() { syn(880, 'sine', 0.1, 0.03, -200); },
  pickup()    { syn(1046, 'sine', 0.15, 0.05, 100); syn(1318, 'sine', 0.1, 0.03, 80); },
  questComplete() { [523, 660, 784, 1046, 1318, 1568].forEach((f, i) => setTimeout(() => syn(f, 'triangle', 0.8, 0.07), i * 90)); },
  error()     { syn(200, 'square', 0.15, 0.05, -80); syn(160, 'square', 0.15, 0.04, -60); },

  /* ── Character voice barks (synthesized vowel approximations) ── */
  /** Short attack grunt — "ha!" */
  barkAttack() {
    syn(280 + Math.random() * 60, 'sine', 0.08, 0.04, 80);
    syn(340 + Math.random() * 40, 'triangle', 0.06, 0.02, -60);
  },
  /** Skill shout — "hiyaa!" rising */
  barkSkill() {
    syn(320, 'sine', 0.12, 0.05, 200);
    syn(440, 'triangle', 0.1, 0.03, 150);
    setTimeout(() => syn(550, 'sine', 0.08, 0.03, 60), 60);
  },
  /** Burst yell — "rraaah!" dramatic */
  barkBurst() {
    syn(200, 'sawtooth', 0.15, 0.06, -40);
    syn(260, 'sine', 0.2, 0.05, 180);
    setTimeout(() => syn(400, 'triangle', 0.12, 0.04, 100), 80);
    setTimeout(() => syn(500, 'sine', 0.08, 0.03, 60), 160);
  },
  /** Hurt gasp — "ugh!" */
  barkHurt() {
    syn(200, 'sine', 0.1, 0.05, -80);
    syn(160, 'triangle', 0.08, 0.03, -40);
  },
  /** Jump effort — "hup!" */
  barkJump() {
    syn(350 + Math.random() * 50, 'sine', 0.07, 0.03, 100);
  },
  /** Dash — short breath */
  barkDash() {
    syn(400, 'sine', 0.05, 0.02, -120);
  },
};

export function scheduleAmbient(): void {
  /* Background music replaces the generative ambient —
     keep this function as a no-op to avoid breaking callers */
  if (ambTO !== null) clearTimeout(ambTO);
  G.needsAmbient = false;
}

/* ─── Ambient Environmental Audio ─── */
let ambWind: OscillatorNode | null = null;
let ambWindGain: GainNode | null = null;
let ambCricketTO: ReturnType<typeof setInterval> | null = null;
let ambBirdTO: ReturnType<typeof setInterval> | null = null;

function chirp(freq: number, dur: number, vol: number): void {
  if (!actx) return;
  const o = actx.createOscillator();
  const g = actx.createGain();
  const now = actx.currentTime;
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, now);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 1.3), now + dur * 0.3);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.8), now + dur);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), now + dur * 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g);
  g.connect(mGain!);
  o.start(now);
  o.stop(now + dur + 0.02);
}

export function startAmbientEnv(): void {
  if (!actx || ambWind) return;

  /* Constant low wind hiss via filtered noise approximation */
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(40, actx.currentTime);
  g.gain.setValueAtTime(0.008, actx.currentTime);
  const lp = actx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(200, actx.currentTime);
  o.connect(lp);
  lp.connect(g);
  g.connect(mGain!);
  o.start();
  ambWind = o;
  ambWindGain = g;

  /* Bird chirps — daytime only, random interval */
  ambBirdTO = setInterval(() => {
    if (!actx || G.dayTime > 0.35) return; // only during day
    if (Math.random() < 0.3) {
      const base = 2000 + Math.random() * 1500;
      chirp(base, 0.08, 0.015);
      setTimeout(() => chirp(base * 1.1, 0.06, 0.012), 100);
      if (Math.random() < 0.5) setTimeout(() => chirp(base * 0.9, 0.07, 0.01), 220);
    }
  }, 1800);

  /* Cricket sounds — nighttime only */
  ambCricketTO = setInterval(() => {
    if (!actx || G.dayTime < 0.35 || G.dayTime > 0.85) return; // only at night
    if (Math.random() < 0.4) {
      const f = 4000 + Math.random() * 1000;
      for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
        setTimeout(() => chirp(f, 0.03, 0.008), i * 60);
      }
    }
  }, 2200);
}

export function updateAmbientEnv(): void {
  if (!ambWindGain || !actx) return;
  /* Modulate wind volume slightly over time */
  const wv = 0.006 + Math.sin(G.worldTime * 0.3) * 0.003;
  ambWindGain.gain.setTargetAtTime(wv, actx.currentTime, 0.5);
}
