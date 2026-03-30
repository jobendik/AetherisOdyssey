import { G } from '../core/GameState';
import { ui } from '../ui/UIRefs';
import { SFX } from '../audio/Audio';
import { gainXp } from './Progression';

/* ═══════════════════════════════════════
   Achievement System
   ═══════════════════════════════════════ */

interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  check: () => boolean;
  rewardXp: number;
  rewardMora: number;
  unlocked: boolean;
}

const achievements: Achievement[] = [
  /* Combat milestones */
  { id: 'first_blood', title: 'First Blood', desc: 'Defeat your first enemy', icon: '⚔️',
    check: () => G.enemiesKilled >= 1, rewardXp: 10, rewardMora: 50, unlocked: false },
  { id: 'slayer_10', title: 'Monster Slayer', desc: 'Defeat 10 enemies', icon: '💀',
    check: () => G.enemiesKilled >= 10, rewardXp: 25, rewardMora: 100, unlocked: false },
  { id: 'slayer_50', title: 'Apex Predator', desc: 'Defeat 50 enemies', icon: '🏆',
    check: () => G.enemiesKilled >= 50, rewardXp: 60, rewardMora: 300, unlocked: false },
  { id: 'boss_slain', title: 'Regicide', desc: 'Defeat the King Slime', icon: '👑',
    check: () => G.bossEntity !== null && G.bossEntity.dead, rewardXp: 80, rewardMora: 500, unlocked: false },

  /* Exploration milestones */
  { id: 'lv5', title: 'Seasoned Traveler', desc: 'Reach level 5', icon: '⭐',
    check: () => G.lv >= 5, rewardXp: 20, rewardMora: 100, unlocked: false },
  { id: 'lv10', title: 'Veteran', desc: 'Reach level 10', icon: '🌟',
    check: () => G.lv >= 10, rewardXp: 50, rewardMora: 250, unlocked: false },
  { id: 'mora_500', title: 'Moneybags', desc: 'Accumulate 500 Mora', icon: '💰',
    check: () => G.mora >= 500, rewardXp: 15, rewardMora: 0, unlocked: false },
  { id: 'crystals_done', title: 'Crystal Collector', desc: 'Collect all 5 crystals', icon: '💎',
    check: () => G.questPhase >= 2, rewardXp: 40, rewardMora: 200, unlocked: false },

  /* Quest milestones */
  { id: 'quest_start', title: 'A Journey Begins', desc: 'Talk to the guide NPC', icon: '📜',
    check: () => G.questPhase >= 1, rewardXp: 10, rewardMora: 30, unlocked: false },
  { id: 'quest_end', title: 'Hero of the Realm', desc: 'Complete the main story', icon: '🎖️',
    check: () => G.questPhase >= 5, rewardXp: 100, rewardMora: 500, unlocked: false },

  /* Combat technique */
  { id: 'combo_10', title: 'Combo Master', desc: 'Reach a 10-hit combo', icon: '🔥',
    check: () => G.comboHits >= 10, rewardXp: 30, rewardMora: 150, unlocked: false },
  { id: 'combo_25', title: 'Untouchable', desc: 'Reach a 25-hit combo', icon: '⚡',
    check: () => G.comboHits >= 25, rewardXp: 50, rewardMora: 300, unlocked: false },
];

function showAchievementPopup(ach: Achievement): void {
  const popup = document.createElement('div');
  popup.className = 'achPopup';
  popup.innerHTML = `
    <span class="achPopupIcon">${ach.icon}</span>
    <span class="achPopupInfo">
      <strong>Achievement Unlocked!</strong><br>
      ${ach.title}
    </span>
  `;
  ui.uiRoot.appendChild(popup);
  setTimeout(() => popup.remove(), 4000);
}

export function initAchievements(): void {
  /* No-op at init; checked each frame */
}

export function updateAchievements(): void {
  for (const ach of achievements) {
    if (ach.unlocked) continue;
    if (ach.check()) {
      ach.unlocked = true;
      gainXp(ach.rewardXp);
      G.mora += ach.rewardMora;
      SFX.questComplete();
      showAchievementPopup(ach);
    }
  }
}

export function getAchievements() {
  return achievements;
}
