import { G } from '../core/GameState';

let actx: AudioContext | null = null;
let mGain: GainNode | null = null;
let dNode: DelayNode | null = null;
let ambTO: ReturnType<typeof setTimeout> | null = null;

/* ─── Background Music ─── */
let bgMusic: HTMLAudioElement | null = null;
let bgMusicPlaying = false;

export function ensureAudio(): void {
  if (actx) {
    if (actx.state === 'suspended') actx.resume();
    startBGMusic();
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
  }
  bgMusic.play().then(() => {
    bgMusicPlaying = true;
  }).catch(() => {
    /* Autoplay blocked — will retry on next user interaction */
  });
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
};

export function scheduleAmbient(): void {
  /* Background music replaces the generative ambient —
     keep this function as a no-op to avoid breaking callers */
  if (ambTO !== null) clearTimeout(ambTO);
  G.needsAmbient = false;
}
