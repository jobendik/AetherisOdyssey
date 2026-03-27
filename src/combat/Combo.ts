import { ui } from '../ui/UIRefs';
import { G } from '../core/GameState';

export function addCombo(): void {
  G.comboHits++;
  G.comboTimer = 3;
  G.comboMult = Math.min(3, 1 + Math.floor(G.comboHits / 5) * 0.2);
  ui.comboDisplay.classList.add('active');
  ui.comboCount.textContent = String(G.comboHits);
  ui.comboMultiplier.textContent = '×' + G.comboMult.toFixed(1);
}

export function resetCombo(): void {
  G.comboHits = 0;
  G.comboTimer = 0;
  G.comboMult = 1;
  ui.comboDisplay.classList.remove('active');
}
