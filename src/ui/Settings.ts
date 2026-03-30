import { G } from '../core/GameState';
import { SFX, setMusicVolume, setSfxVolume } from '../audio/Audio';

/* ═══════════════════════════════════════
   Settings Menu
   ═══════════════════════════════════════ */

export interface GameSettings {
  musicVol: number;   // 0-1
  sfxVol: number;     // 0-1
  shadows: boolean;
  bloom: boolean;
  ssao: boolean;
  mouseSens: number;  // 0.5-3
}

const STORAGE_KEY = 'genshinClone_settings';

const defaults: GameSettings = {
  musicVol: 0.7,
  sfxVol: 0.8,
  shadows: true,
  bloom: true,
  ssao: true,
  mouseSens: 1.0,
};

export let settings: GameSettings = { ...defaults };

export function loadSettings(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      settings = { ...defaults, ...parsed };
    }
  } catch { /* ignore corrupt data */ }
  applySettings();
}

function saveSettings(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function applySettings(): void {
  /* Audio */
  setMusicVolume(settings.musicVol);
  setSfxVolume(settings.sfxVol);

  /* Shadows */
  if (G.rend) {
    G.rend.shadowMap.enabled = settings.shadows;
  }
  if (G.sunLight) {
    G.sunLight.castShadow = settings.shadows;
  }

  /* Post-processing passes */
  if (G.composer) {
    for (const pass of (G.composer as any).passes) {
      if (pass?.userData?.passType === 'ssao') pass.enabled = settings.ssao;
      if (pass?.userData?.passType === 'bloom') pass.enabled = settings.bloom;
    }
  }

  /* Mouse sensitivity is read from settings.mouseSens in Camera.ts */
}

/* ─── UI ─── */
let settingsEl: HTMLElement | null = null;

export function isSettingsOpen(): boolean {
  return !!settingsEl;
}

export function closeSettings(): void {
  if (!settingsEl) return;
  SFX.menuClose();
  settingsEl.remove();
  settingsEl = null;
}

export function openSettings(): void {
  if (settingsEl) { closeSettings(); return; }
  SFX.menuOpen();

  const overlay = document.createElement('div');
  overlay.id = 'settingsOverlay';

  const s = settings;

  overlay.innerHTML = `
    <div class="setPanel">
      <div class="setHeader">
        <span class="setTitle">Settings</span>
        <button class="setClose" id="setClose">\u2715</button>
      </div>
      <div class="setBody">
        <div class="setGroup">Audio</div>
        <label class="setRow">
          <span>Music Volume</span>
          <input type="range" class="setSlider" id="setMusic" min="0" max="100" value="${Math.round(s.musicVol * 100)}">
          <span class="setVal" id="setMusicVal">${Math.round(s.musicVol * 100)}%</span>
        </label>
        <label class="setRow">
          <span>SFX Volume</span>
          <input type="range" class="setSlider" id="setSfx" min="0" max="100" value="${Math.round(s.sfxVol * 100)}">
          <span class="setVal" id="setSfxVal">${Math.round(s.sfxVol * 100)}%</span>
        </label>

        <div class="setGroup">Graphics</div>
        <label class="setRow">
          <span>Shadows</span>
          <input type="checkbox" id="setShadows" ${s.shadows ? 'checked' : ''}>
        </label>
        <label class="setRow">
          <span>Bloom</span>
          <input type="checkbox" id="setBloom" ${s.bloom ? 'checked' : ''}>
        </label>
        <label class="setRow">
          <span>Ambient Occlusion</span>
          <input type="checkbox" id="setSsao" ${s.ssao ? 'checked' : ''}>
        </label>

        <div class="setGroup">Controls</div>
        <label class="setRow">
          <span>Mouse Sensitivity</span>
          <input type="range" class="setSlider" id="setSens" min="10" max="300" value="${Math.round(s.mouseSens * 100)}">
          <span class="setVal" id="setSensVal">${s.mouseSens.toFixed(1)}</span>
        </label>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  settingsEl = overlay;

  /* Event listeners */
  overlay.querySelector('#setClose')!.addEventListener('click', closeSettings);

  const musicSlider = overlay.querySelector('#setMusic') as HTMLInputElement;
  musicSlider.addEventListener('input', () => {
    s.musicVol = parseInt(musicSlider.value) / 100;
    overlay.querySelector('#setMusicVal')!.textContent = musicSlider.value + '%';
    applySettings(); saveSettings();
  });

  const sfxSlider = overlay.querySelector('#setSfx') as HTMLInputElement;
  sfxSlider.addEventListener('input', () => {
    s.sfxVol = parseInt(sfxSlider.value) / 100;
    overlay.querySelector('#setSfxVal')!.textContent = sfxSlider.value + '%';
    applySettings(); saveSettings();
  });

  const sensSlider = overlay.querySelector('#setSens') as HTMLInputElement;
  sensSlider.addEventListener('input', () => {
    s.mouseSens = parseInt(sensSlider.value) / 100;
    overlay.querySelector('#setSensVal')!.textContent = s.mouseSens.toFixed(1);
    applySettings(); saveSettings();
  });

  (overlay.querySelector('#setShadows') as HTMLInputElement).addEventListener('change', (e) => {
    s.shadows = (e.target as HTMLInputElement).checked;
    applySettings(); saveSettings();
  });

  (overlay.querySelector('#setBloom') as HTMLInputElement).addEventListener('change', (e) => {
    s.bloom = (e.target as HTMLInputElement).checked;
    applySettings(); saveSettings();
  });

  (overlay.querySelector('#setSsao') as HTMLInputElement).addEventListener('change', (e) => {
    s.ssao = (e.target as HTMLInputElement).checked;
    applySettings(); saveSettings();
  });
}
