import { G, keys } from '../core/GameState';
import { ui } from './UIRefs';
import { SFX } from '../audio/Audio';

export function startDialogue(l: string[]): void {
  G.inDialogue = true;
  G.dialogueLines = l.slice();
  G.dialogueIdx = 0;
  ui.dialogueBox.style.display = 'block';
  ui.centerPrompt.style.display = 'none';
  keys.w = keys.a = keys.s = keys.d = 0;
  advanceDialogue();
}

export function advanceDialogue(): void {
  if (G.dialogueIdx >= G.dialogueLines.length) {
    G.inDialogue = false;
    ui.dialogueBox.style.display = 'none';
    if (G.questPhase === 0) {
      G.questPhase = 1;
      ui.objectiveText.textContent = 'Gather 5 crystals';
      ui.objectiveSubtext.textContent = 'Switch characters for reactions!';
    }
    return;
  }
  ui.dialogueText.textContent = G.dialogueLines[G.dialogueIdx];
  G.dialogueIdx++;
  SFX.talk();
}
