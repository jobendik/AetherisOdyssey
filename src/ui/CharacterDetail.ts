import { G, mem } from '../core/GameState';
import { PARTY } from '../data/PartyData';
import { calcStats, getW, getA } from '../systems/Inventory';
import { SFX } from '../audio/Audio';

let panel: HTMLElement | null = null;

export function toggleCharacterDetail(): void {
  if (panel) { closeCharacterDetail(); return; }
  openCharacterDetail();
}

function openCharacterDetail(): void {
  SFX.menuOpen();
  G.isActive = false;
  if (!G.mobile && document.pointerLockElement) document.exitPointerLock();

  panel = document.createElement('div');
  panel.id = 'charDetailOverlay';
  panel.innerHTML = buildContent(G.activeIdx);
  document.body.appendChild(panel);

  panel.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest('.cdTab') as HTMLElement | null;
    if (tab) {
      const idx = parseInt(tab.dataset.idx!, 10);
      panel!.innerHTML = buildContent(idx);
    }
    if ((e.target as HTMLElement).id === 'cdClose') closeCharacterDetail();
  });
}

function closeCharacterDetail(): void {
  if (!panel) return;
  SFX.menuClose();
  panel.remove();
  panel = null;
  if (G.hasStarted && G.health > 0) {
    if (G.mobile) G.isActive = true;
    else document.body.requestPointerLock();
  }
}

function buildContent(idx: number): string {
  const m = PARTY[idx];
  const stats = calcStats({
    memberIdx: idx,
    weaponId: m.equippedWeapon,
    artifactId: m.equippedArtifact,
    artifactIds: m.equippedArtifacts,
  });
  const w = getW(m.equippedWeapon || '');
  const a = getA(m.equippedArtifact || '');

  const rarityStars = (r: number) => '★'.repeat(r) + '☆'.repeat(5 - r);

  const tabs = PARTY.map((p, i) =>
    `<button class="cdTab ${i === idx ? 'cdTabActive' : ''}" data-idx="${i}" style="--accent:${p.accent}">
      <span class="cdTabPortrait">${p.portrait}</span>
      <span class="cdTabName">${p.name}</span>
    </button>`
  ).join('');

  return `
    <div class="cdHeader">
      <div class="cdTitle">CHARACTER</div>
      <button id="cdClose">✕ Close</button>
    </div>
    <div class="cdTabs">${tabs}</div>
    <div class="cdBody">
      <div class="cdLeft">
        <div class="cdPortraitBig" style="background:radial-gradient(circle at 35% 30%,${m.accent},rgba(8,14,26,0.92))">${m.portrait}</div>
        <div class="cdName">${m.name}</div>
        <div class="cdMeta">${m.element} · ${m.role}</div>
        <div class="cdLevel">Lv. ${G.lv}</div>
        <div class="cdXpBar"><div class="cdXpFill" style="width:${(G.xp / G.xpNext) * 100}%"></div></div>
        <div class="cdXpText">${G.xp} / ${G.xpNext} XP</div>
      </div>
      <div class="cdRight">
        <div class="cdSection">
          <div class="cdSectionTitle">STATS</div>
          <div class="cdStatGrid">
            <div class="cdStat"><span class="cdStatLabel">HP</span><span class="cdStatVal">${Math.ceil(m.hp)} / ${m.maxHp + stats.bonusHp}</span></div>
            <div class="cdStat"><span class="cdStatLabel">ATK</span><span class="cdStatVal">${stats.atk}</span></div>
            <div class="cdStat"><span class="cdStatLabel">Base DMG</span><span class="cdStatVal">${m.baseDmg}</span></div>
            <div class="cdStat"><span class="cdStatLabel">Elem DMG</span><span class="cdStatVal">${Math.round(stats.elemDmg * 100)}%</span></div>
            <div class="cdStat"><span class="cdStatLabel">Burst DMG</span><span class="cdStatVal">${Math.round(stats.burstDmg * 100)}%</span></div>
            <div class="cdStat"><span class="cdStatLabel">Crit Bonus</span><span class="cdStatVal">${stats.critBonus > 0 ? '+' + Math.round(stats.critBonus * 100) + '%' : '—'}</span></div>
          </div>
        </div>
        <div class="cdSection">
          <div class="cdSectionTitle">EQUIPMENT</div>
          <div class="cdEquipRow">
            <div class="cdEquipSlot">
              <div class="cdEquipIcon">${w ? w.icon : '—'}</div>
              <div class="cdEquipInfo">
                <div class="cdEquipLabel">Weapon</div>
                <div class="cdEquipName">${w ? w.name : 'None'}</div>
                <div class="cdEquipRarity">${w ? rarityStars(w.rarity) : ''}</div>
                <div class="cdEquipDesc">${w ? w.desc : ''}</div>
              </div>
            </div>
            <div class="cdEquipSlot">
              <div class="cdEquipIcon">${a ? a.icon : '—'}</div>
              <div class="cdEquipInfo">
                <div class="cdEquipLabel">Artifact</div>
                <div class="cdEquipName">${a ? a.name : 'None'}</div>
                <div class="cdEquipRarity">${a ? rarityStars(a.rarity) : ''}</div>
                <div class="cdEquipDesc">${a ? a.desc : ''}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="cdSection">
          <div class="cdSectionTitle">TALENTS</div>
          <div class="cdTalentRow">
            <div class="cdTalent">
              <div class="cdTalentName">Normal Attack</div>
              <div class="cdTalentDesc">${m.normalHits}-hit combo · Speed ${m.normalSpeed} · Range ${m.normalRange}</div>
            </div>
            <div class="cdTalent">
              <div class="cdTalentName">Skill: ${m.skillDesc}</div>
              <div class="cdTalentDesc">CD ${m.skillCdMax}s · ${m.skillRadius > 0 ? 'Radius ' + m.skillRadius : 'Self'} · ×${m.skillDmgMult} DMG</div>
            </div>
            <div class="cdTalent">
              <div class="cdTalentName">Burst: ${m.burstDesc}</div>
              <div class="cdTalentDesc">CD ${m.burstCdMax}s · Radius ${m.burstRadius} · ×${m.burstDmgMult} DMG${m.burstDur ? ' · ' + m.burstDur + 's' : ''}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function isCharDetailOpen(): boolean {
  return panel !== null;
}
