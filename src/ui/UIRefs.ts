import type { UIElements } from '../types';

const $ = (id: string): HTMLElement => document.getElementById(id)!;

export const ui: UIElements = {} as UIElements;

export function initUI(): void {
  const ids = [
    'startScreen', 'deathScreen', 'startBtn', 'respawnBtn', 'damageOverlay',
    'burstFlash', 'lowHealthVignette', 'switchFlash',
    'objectiveText', 'objectiveSubtext',
    'targetInfo', 'targetName', 'targetLevel', 'targetBarFill',
    'bossBar', 'bossName', 'bossPhaseLabel', 'bossHpFill',
    'centerPrompt', 'promptText', 'dialogueBox', 'dialogueText', 'dialogueName',
    'partyColumn',
    'playerAvatar', 'playerName', 'playerLevel', 'hpNumbers', 'hpFill', 'shieldFill',
    'staminaMiniFill', 'staminaValue', 'xpBarFill', 'moraValue',
    'skillBtn', 'burstBtn', 'skillCdText', 'burstCdText', 'skillArc', 'burstArc',
    'skillGlyph', 'burstGlyph',
    'skillDescText', 'burstDescText', 'minimapCanvas', 'fpsValue', 'pingValue',
    'comboDisplay', 'comboCount', 'comboMultiplier', 'levelUpOverlay', 'levelUpSub',
    'reactionBanner', 'uiRoot', 'inventoryOverlay', 'invEquipSlots', 'invWeapons',
    'invArtifacts', 'invFood', 'invStats',
    'bagBtn', 'invClose', 'crosshair',
    'questDistance',
  ];
  ids.forEach((id) => {
    ui[id] = $(id);
  });
}
