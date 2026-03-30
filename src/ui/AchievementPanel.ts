import { ui } from './UIRefs';
import { getAchievements } from '../systems/Achievements';

let panel: HTMLElement | null = null;

export function toggleAchievementPanel(): void {
  if (panel) {
    panel.remove();
    panel = null;
    return;
  }

  panel = document.createElement('div');
  panel.id = 'achPanel';

  const achievements = getAchievements();
  const title = document.createElement('div');
  title.className = 'achPanelTitle';
  const done = achievements.filter((achievement) => achievement.unlocked).length;
  title.textContent = `Achievements (${done}/${achievements.length})`;
  panel.appendChild(title);

  for (const achievement of achievements) {
    const row = document.createElement('div');
    row.className = 'achRow' + (achievement.unlocked ? ' achUnlocked' : '');
    row.innerHTML = `
      <span class="achIcon">${achievement.icon}</span>
      <span class="achInfo">
        <strong>${achievement.title}</strong><br>
        <small>${achievement.desc}</small>
      </span>
      <span class="achStatus">${achievement.unlocked ? '✓' : '—'}</span>
    `;
    panel.appendChild(row);
  }

  ui.uiRoot.appendChild(panel);
}