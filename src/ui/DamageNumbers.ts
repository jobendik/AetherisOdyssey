import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { wH, rnd, w2s } from '../core/Helpers';
import { ui } from './UIRefs';

export function spawnDmg(
  pos: THREE.Vector3,
  amt: number,
  color = '#fff',
  crit = false,
  label = '',
): void {
  const s = w2s(pos);
  if (s.behind) return;
  const e = document.createElement('div');
  e.className = 'dmgNumber' + (crit ? ' crit' : '') + (label ? ' reaction' : '');
  e.textContent = label || String(Math.round(amt));
  e.style.cssText = `left:${s.x + rnd(-30, 30)}px;top:${s.y + rnd(-20, 10)}px;color:${color};font-size:${crit ? '38px' : 14 + Math.min(amt, 100) * 0.2 + 'px'}`;
  ui.uiRoot.appendChild(e);
  setTimeout(() => e.remove(), label ? 1300 : crit ? 1100 : 1000);
}
