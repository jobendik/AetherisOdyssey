import * as THREE from 'three';
import { G } from '../core/GameState';

/* ═══════════════════════════════════════
   Object Pools — reuse meshes and DOM
   elements to reduce GC pressure
   ═══════════════════════════════════════ */

/* ── Particle mesh pool ── */
const meshPool: THREE.Mesh[] = [];
const POOL_MAX = 200;

const _boxGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);

export function acquireParticleMesh(color: THREE.Color): THREE.Mesh {
  let m = meshPool.pop();
  if (m) {
    (m.material as THREE.MeshBasicMaterial).color.copy(color);
    (m.material as THREE.MeshBasicMaterial).opacity = 1;
    m.scale.setScalar(1);
    m.visible = true;
  } else {
    m = new THREE.Mesh(
      _boxGeo,
      new THREE.MeshBasicMaterial({ color }),
    );
  }
  G.scene!.add(m);
  return m;
}

export function releaseParticleMesh(m: THREE.Mesh): void {
  G.scene!.remove(m);
  m.visible = false;
  if (meshPool.length < POOL_MAX) {
    meshPool.push(m);
  } else {
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }
}

/** Pre-populate the particle pool so the first chest-open (or combat)
 *  doesn't stall while creating dozens of meshes & compiling shaders. */
export function warmParticlePool(count = 60): void {
  const white = new THREE.Color(0xffffff);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      _boxGeo,
      new THREE.MeshBasicMaterial({ color: white }),
    );
    m.visible = false;
    meshPool.push(m);
  }
}

/* ── Damage number DOM pool ── */
const domPool: HTMLDivElement[] = [];
const DOM_POOL_MAX = 60;

export function acquireDmgElement(): HTMLDivElement {
  let el = domPool.pop();
  if (el) {
    el.className = '';
    el.textContent = '';
    el.style.cssText = '';
    el.style.display = '';
  } else {
    el = document.createElement('div');
  }
  return el;
}

export function releaseDmgElement(el: HTMLDivElement): void {
  el.style.display = 'none';
  if (el.parentNode) el.parentNode.removeChild(el);
  if (domPool.length < DOM_POOL_MAX) {
    domPool.push(el);
  }
}
