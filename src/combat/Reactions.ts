import { ui } from '../ui/UIRefs';
import { G } from '../core/GameState';
import type { EnemyEntity, ElementType } from '../types';
import { REACTIONS } from '../data/ReactionData';
import { SFX } from '../audio/Audio';

export function tryReaction(el: ElementType, e: EnemyEntity) {
  if (!e.appliedEl || e.appliedEl === el) {
    if (el !== 'Anemo') {
      e.appliedEl = el;
      e.elTimer = 6;
    }
    return null;
  }
  const r = REACTIONS[el + '+' + e.appliedEl];
  if (r) {
    e.appliedEl = null;
    e.elTimer = 0;
    showReaction(r.n, r.c);
    SFX.reaction();
    return r;
  }
  e.appliedEl = el;
  e.elTimer = 6;
  return null;
}

export function showReaction(n: string, c: string): void {
  const b = ui.reactionBanner;
  b.textContent = n;
  b.style.color = c;
  b.style.setProperty('--rcolor', c);
  b.style.animation = 'none';
  b.offsetHeight; // force reflow
  b.style.animation = 'reactionPop 1.2s ease-out forwards';
}
