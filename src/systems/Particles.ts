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

export function spawnElementalHit(pos: THREE.Vector3, element: ElementType): void {
  const col = ELEM_COLORS[element] || ELEM_COLORS.Anemo;
  const count = 16;
  for (let i = 0; i < count; i++) {
    const isSecondary = Math.random() > 0.5;
    const size = 0.12 + Math.random() * 0.18;
    const geo = element === 'Cryo'
      ? new THREE.OctahedronGeometry(size)
      : element === 'Pyro'
      ? new THREE.TetrahedronGeometry(size)
      : new THREE.SphereGeometry(size, 6, 6);
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: isSecondary ? col.secondary : col.primary,
        transparent: true,
        opacity: 0.9,
      }),
    );
    m.position.copy(pos);
    G.scene!.add(m);
    const speed = 6 + Math.random() * 10;
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.5 + 0.5,
      (Math.random() - 0.5) * 2,
    ).normalize();
    G.entities.particles.push({
      mesh: m,
      life: 0.4 + Math.random() * 0.35,
      vel: dir.multiplyScalar(speed),
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
    });
  }
}

export function spawnRing(
  pos: THREE.Vector3,
  color: string,
  radius: number,
): void {
  const r = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.55, radius, 32),
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
    vel: new THREE.Vector3(),
    ring: true,
    ss: 0.3,
    es: 1.4,
  });
}

export function updateParticles(dt: number): void {
  for (let i = G.entities.particles.length - 1; i >= 0; i--) {
    const p = G.entities.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      releaseParticleMesh(p.mesh);
      G.entities.particles.splice(i, 1);
      continue;
    }
    if (p.ring) {
      const pr = 1 - p.life / 0.45;
      p.mesh.scale.setScalar(lerp(p.ss!, p.es!, pr));
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - pr);
    } else if ((p as any).afterimage) {
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
