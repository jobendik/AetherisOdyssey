import { G } from '../core/GameState';
import {
  getLightingDebugSettings,
  resetLightingDebugSettings,
  updateLightingDebugSettings,
} from '../core/Scene';

let panelEl: HTMLElement | null = null;

function syncPanel(): void {
  if (!panelEl) return;
  const s = getLightingDebugSettings();
  const setValue = (id: string, text: string) => {
    const el = panelEl!.querySelector(id);
    if (el) el.textContent = text;
  };
  (panelEl.querySelector('#ldTime') as HTMLInputElement).value = String(Math.round(s.timeOfDay * 100));
  (panelEl.querySelector('#ldFreeze') as HTMLInputElement).checked = s.freezeTime;
  (panelEl.querySelector('#ldExposure') as HTMLInputElement).value = String(Math.round(s.exposure * 100));
  (panelEl.querySelector('#ldSun') as HTMLInputElement).value = String(Math.round(s.sunScale * 100));
  (panelEl.querySelector('#ldAmbient') as HTMLInputElement).value = String(Math.round(s.ambientScale * 100));
  (panelEl.querySelector('#ldHemi') as HTMLInputElement).value = String(Math.round(s.hemiScale * 100));
  (panelEl.querySelector('#ldFog') as HTMLInputElement).value = String(Math.round(s.fogScale * 100));
  setValue('#ldTimeVal', s.timeOfDay.toFixed(2));
  setValue('#ldExposureVal', s.exposure.toFixed(2));
  setValue('#ldSunVal', s.sunScale.toFixed(2));
  setValue('#ldAmbientVal', s.ambientScale.toFixed(2));
  setValue('#ldHemiVal', s.hemiScale.toFixed(2));
  setValue('#ldFogVal', s.fogScale.toFixed(2));
}

function bindRange(id: string, key: 'timeOfDay' | 'exposure' | 'sunScale' | 'ambientScale' | 'hemiScale' | 'fogScale'): void {
  const input = panelEl!.querySelector(id) as HTMLInputElement;
  input.addEventListener('input', () => {
    updateLightingDebugSettings({ [key]: parseInt(input.value, 10) / 100 } as never);
    syncPanel();
  });
}

export function isLightingDebugOpen(): boolean {
  return !!panelEl;
}

export function closeLightingDebug(): void {
  if (!panelEl) return;
  panelEl.remove();
  panelEl = null;
  if (G.hasStarted && G.health > 0) {
    if (G.mobile) G.isActive = true;
    else document.body.requestPointerLock();
  }
}

export function toggleLightingDebug(): void {
  if (panelEl) {
    closeLightingDebug();
    return;
  }

  G.isActive = false;
  if (!G.mobile && document.pointerLockElement) document.exitPointerLock();

  panelEl = document.createElement('div');
  panelEl.id = 'lightingDebugOverlay';
  panelEl.innerHTML = `
    <div class="ldPanel">
      <div class="ldHeader">
        <div class="ldTitle">Lighting Debug</div>
        <button id="ldClose" class="ldClose">Close</button>
      </div>
      <div class="ldBody">
        <label class="ldRow"><span>Freeze Time</span><input id="ldFreeze" type="checkbox"></label>
        <label class="ldRow"><span>Time Of Day</span><input id="ldTime" type="range" min="0" max="100"><span id="ldTimeVal" class="ldVal"></span></label>
        <label class="ldRow"><span>Exposure</span><input id="ldExposure" type="range" min="40" max="220"><span id="ldExposureVal" class="ldVal"></span></label>
        <label class="ldRow"><span>Sun</span><input id="ldSun" type="range" min="0" max="220"><span id="ldSunVal" class="ldVal"></span></label>
        <label class="ldRow"><span>Ambient</span><input id="ldAmbient" type="range" min="0" max="220"><span id="ldAmbientVal" class="ldVal"></span></label>
        <label class="ldRow"><span>Hemisphere</span><input id="ldHemi" type="range" min="0" max="220"><span id="ldHemiVal" class="ldVal"></span></label>
        <label class="ldRow"><span>Fog Density</span><input id="ldFog" type="range" min="25" max="200"><span id="ldFogVal" class="ldVal"></span></label>
      </div>
      <div class="ldFooter">
        <button id="ldReset" class="ldBtn">Reset</button>
        <div class="ldHint">F4 toggles this panel</div>
      </div>
    </div>
  `;
  document.body.appendChild(panelEl);

  panelEl.querySelector('#ldClose')!.addEventListener('click', closeLightingDebug);
  panelEl.querySelector('#ldReset')!.addEventListener('click', () => {
    resetLightingDebugSettings();
    syncPanel();
  });
  (panelEl.querySelector('#ldFreeze') as HTMLInputElement).addEventListener('change', (e) => {
    updateLightingDebugSettings({ freezeTime: (e.target as HTMLInputElement).checked });
    syncPanel();
  });
  bindRange('#ldTime', 'timeOfDay');
  bindRange('#ldExposure', 'exposure');
  bindRange('#ldSun', 'sunScale');
  bindRange('#ldAmbient', 'ambientScale');
  bindRange('#ldHemi', 'hemiScale');
  bindRange('#ldFog', 'fogScale');
  syncPanel();
}