import * as THREE from 'three';
import { G } from '../core/GameState';
import { lerp } from '../core/Helpers';
import type { ElementType } from '../types';
import { acquireParticleMesh, releaseParticleMesh } from './ObjectPool';

/* ──── Element color maps ──── */
const ELEM_COLORS: Record<ElementType, { primary: number; secondary: number }> = {
  Pyro:   { primary: 0xff4422, secondary: 0xffaa33 },
  Cryo:   { primary: 0x99ddff, secondary: 0xeeffff },
  Electro:{ primary: 0xcc66ff, secondary: 0xeeccff },
  Anemo:  { primary: 0x66ffcc, secondary: 0xccffee },
  Hydro:  { primary: 0x4488ff, secondary: 0x88ccff },
};

const HIT_GEOMETRIES = {
  sphere: new THREE.SphereGeometry(1, 6, 6),
  tetra: new THREE.TetrahedronGeometry(1),
  octa: new THREE.OctahedronGeometry(1),
};

/* Reusable temp vector to avoid per-frame allocations */
const _tempDir = new THREE.Vector3();

/* Cached ring geometries keyed by radius to avoid GC pressure */
const _ringGeoCache = new Map<number, THREE.RingGeometry>();

function getCachedRingGeo(radius: number): THREE.RingGeometry {
  let geo = _ringGeoCache.get(radius);
  if (!geo) {
    geo = new THREE.RingGeometry(radius * 0.55, radius, 32);
    _ringGeoCache.set(radius, geo);
  }
  return geo;
}

const hitMaterialCache = new Map<number, THREE.MeshBasicMaterial>();

function getHitGeometry(element: ElementType): THREE.BufferGeometry {
  if (element === 'Cryo') return HIT_GEOMETRIES.octa;
  if (element === 'Pyro') return HIT_GEOMETRIES.tetra;
  return HIT_GEOMETRIES.sphere;
}

function getHitMaterial(color: number): THREE.MeshBasicMaterial {
  let material = hitMaterialCache.get(color);
  if (!material) {
    material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    });
    hitMaterialCache.set(color, material);
  }
  return material;
}

export function spawnElementalHit(pos: THREE.Vector3, element: ElementType): void {
  const col = ELEM_COLORS[element] || ELEM_COLORS.Anemo;
  const count = 16;
  const geometry = getHitGeometry(element);
  for (let i = 0; i < count; i++) {
    const isSecondary = Math.random() > 0.5;
    const size = 0.12 + Math.random() * 0.18;
    const m = new THREE.Mesh(
      geometry,
      getHitMaterial(isSecondary ? col.secondary : col.primary),
    );
    m.position.copy(pos);
    m.scale.setScalar(size);
    G.scene!.add(m);
    const speed = 6 + Math.random() * 10;
    _tempDir.set(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.5 + 0.5,
      (Math.random() - 0.5) * 2,
    ).normalize();
    G.entities.particles.push({
      mesh: m,
      life: 0.4 + Math.random() * 0.35,
      vel: _tempDir.clone().multiplyScalar(speed),
      cleanup: 'shared',
    });
  }
}

export function spawnParts(
  pos: THREE.Vector3,
  color: string,
  count = 10,
  spread = 12,
): void {
  const pc = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    const m = acquireParticleMesh(pc);
    m.position.copy(pos);
    G.entities.particles.push({
      mesh: m,
      life: 0.8 + Math.random() * 0.4,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        Math.random() * spread,
        (Math.random() - 0.5) * spread,
      ),
      cleanup: 'pool',
    });
  }
}

export function spawnRing(
  pos: THREE.Vector3,
  color: string,
  radius: number,
): void {
  const r = new THREE.Mesh(
    getCachedRingGeo(radius),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    }),
  );
  r.rotation.x = -Math.PI / 2;
  r.position.copy(pos);
  G.scene!.add(r);
  G.entities.particles.push({
    mesh: r,
    life: 0.45,
    vel: _tempDir.set(0, 0, 0).clone(),
    ring: true,
    ss: 0.3,
    es: 1.4,
    cleanup: 'dispose',
  });
}

function disposeObjectMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material.dispose());
  });
}

function disposeObjectGeometryAndMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material.dispose());
  });
}

function cleanupParticle(p: (typeof G.entities.particles)[number]): void {
  if (p.cleanup === 'pool') {
    releaseParticleMesh(p.mesh as THREE.Mesh);
    return;
  }

  G.scene!.remove(p.mesh);

  if (p.cleanup === 'afterimage') {
    disposeObjectMaterials(p.mesh);
    return;
  }

  if (p.cleanup === 'shared') {
    return;
  }

  /* For 'dispose': only dispose material, geometry may be cached */
  disposeObjectMaterials(p.mesh);
}

export function updateParticles(dt: number): void {
  const particles = G.entities.particles;
  let len = particles.length;
  for (let i = len - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      cleanupParticle(p);
      /* Swap-and-pop: O(1) removal instead of O(n) splice */
      len--;
      if (i < len) particles[i] = particles[len];
      particles.length = len;
      continue;
    }
    if (p.ring) {
      const pr = 1 - p.life / 0.45;
      p.mesh.scale.setScalar(lerp(p.ss!, p.es!, pr));
      ((p.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - pr);
    } else if (p.afterimage) {
      /* Afterimage ghost fade-out */
      const alpha = p.life / 0.35;
      p.mesh.traverse((c: THREE.Object3D) => {
        if ((c as THREE.Mesh).isMesh) {
          ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 * alpha;
        }
      });
    } else {
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 18 * dt;
      p.mesh.scale.setScalar(Math.max(0.1, p.life));
    }
  }
}

export function updateWindParts(dt: number): void {
  for (const p of G.entities.windParticles) {
    p.position.y += p.userData.speed * dt;
    p.position.x =
      p.userData.baseX + Math.sin(G.worldTime * 4 + p.position.y * 0.35) * p.userData.sway;
    p.position.z =
      p.userData.baseZ + Math.cos(G.worldTime * 4 + p.position.y * 0.35) * p.userData.sway;
    if (p.position.y > p.userData.top) p.position.y = p.userData.baseY;
    p.lookAt(G.cam!.position);
  }
}

/* ──── Ambient world particles (dust motes, fireflies, leaves) ──── */

const AMB_COUNT = 600;
const AMB_RANGE = 60;

export function spawnAmbientParticles(): void {
  const positions = new Float32Array(AMB_COUNT * 3);
  const colors = new Float32Array(AMB_COUNT * 3);
  const sizes = new Float32Array(AMB_COUNT);
  const seeds = new Float32Array(AMB_COUNT);

  for (let i = 0; i < AMB_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * AMB_RANGE * 2;
    positions[i * 3 + 1] = Math.random() * 15 + 1;
    positions[i * 3 + 2] = (Math.random() - 0.5) * AMB_RANGE * 2;

    // Mix of golden dust and green leaf-like particles
    const isFirefly = Math.random() > 0.7;
    if (isFirefly) {
      colors[i * 3] = 0.9;
      colors[i * 3 + 1] = 0.95;
      colors[i * 3 + 2] = 0.5;
      sizes[i] = 2.5 + Math.random() * 2;
    } else {
      colors[i * 3] = 0.8 + Math.random() * 0.2;
      colors[i * 3 + 1] = 0.85 + Math.random() * 0.15;
      colors[i * 3 + 2] = 0.7 + Math.random() * 0.15;
      sizes[i] = 1.5 + Math.random() * 1.5;
    }
    seeds[i] = Math.random() * 100;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float seed;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      void main() {
        vColor = color;
        vec3 pos = position;
        pos.x += sin(uTime * 0.7 + seed * 6.28) * 2.0;
        pos.y += sin(uTime * 0.5 + seed * 3.14) * 0.5;
        pos.z += cos(uTime * 0.6 + seed * 4.71) * 2.0;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (200.0 / -mvPos.z);
        vAlpha = 0.3 + sin(uTime * 2.0 + seed * 10.0) * 0.15;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float a = (1.0 - d * d) * vAlpha;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    uniforms: {
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  });

  G.ambientParticles = new THREE.Points(geo, mat);
  G.scene!.add(G.ambientParticles);
}

export function updateAmbientParticles(dt: number): void {
  if (!G.ambientParticles || !G.player) return;
  const mat = G.ambientParticles.material as THREE.ShaderMaterial;
  mat.uniforms.uTime.value = G.worldTime;

  // Follow player so particles are always around them
  G.ambientParticles.position.set(
    G.player.position.x,
    0,
    G.player.position.z,
  );

  // Increase brightness at night (fireflies!)
  const isNight = G.dayTime > 0.4 && G.dayTime < 0.8;
  mat.uniforms.uTime.value = G.worldTime;
  if (isNight) {
    mat.blending = THREE.AdditiveBlending;
  } else {
    mat.blending = THREE.NormalBlending;
  }
}
