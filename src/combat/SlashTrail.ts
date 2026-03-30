import * as THREE from 'three';
import { G, mem } from '../core/GameState';

const TRAIL_LENGTH = 12;
const TRAIL_LIFETIME = 0.25;

const trailVertexShader = /* glsl */ `
  attribute float alpha;
  varying float vAlpha;
  void main() {
    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const trailFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha * 0.7);
  }
`;

let trailGeo: THREE.BufferGeometry | null = null;
let trailMat: THREE.ShaderMaterial | null = null;

export function initSlashTrail(): void {
  const positions = new Float32Array(TRAIL_LENGTH * 2 * 3);
  const alphas = new Float32Array(TRAIL_LENGTH * 2);
  const indices: number[] = [];

  for (let i = 0; i < TRAIL_LENGTH - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  trailGeo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
  trailGeo.setIndex(indices);

  trailMat = new THREE.ShaderMaterial({
    vertexShader: trailVertexShader,
    fragmentShader: trailFragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(mem().accent) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  G.slashTrail = new THREE.Mesh(trailGeo, trailMat);
  G.slashTrail.frustumCulled = false;
  G.slashTrail.visible = false;
  G.scene!.add(G.slashTrail);
}

export function triggerSlashTrail(): void {
  G.slashTrailTimer = TRAIL_LIFETIME;
  G.slashTrailPts = [];
  if (G.slashTrail) {
    G.slashTrail.visible = true;
    if (trailMat) {
      trailMat.uniforms.uColor.value.set(mem().accent);
    }
  }
}

export function updateSlashTrail(dt: number): void {
  if (!G.slashTrail || !trailGeo) return;

  if (G.slashTrailTimer > 0) {
    G.slashTrailTimer -= dt;

    if (G.playerModel && G.player) {
      const fwd = new THREE.Vector3(0, 0, -1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), G.playerModel.rotation.y);
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      const playerPos = G.player.position;

      // Sword tip and base positions in world space
      const comboPhase = (G.worldTime * 8) % 1;
      const swingAngle = Math.sin(comboPhase * Math.PI) * 2.5;
      const tipOffset = right.clone().multiplyScalar(Math.cos(swingAngle) * 2.2)
        .add(new THREE.Vector3(0, 2.5 + Math.sin(swingAngle) * 1.5, 0))
        .add(fwd.clone().multiplyScalar(-0.5));
      const baseOffset = new THREE.Vector3(0, 1.5, 0)
        .add(right.clone().multiplyScalar(0.3));

      const tip = playerPos.clone().add(tipOffset);
      const base = playerPos.clone().add(baseOffset);

      G.slashTrailPts.push(tip.clone(), base.clone());
      if (G.slashTrailPts.length > TRAIL_LENGTH * 2) {
        G.slashTrailPts.splice(0, 2);
      }
    }
  } else if (G.slashTrailPts.length > 0) {
    G.slashTrailPts.splice(0, 2);
  }

  if (G.slashTrailPts.length < 4) {
    G.slashTrail.visible = false;
    return;
  }

  G.slashTrail.visible = true;

  const posArr = (trailGeo.attributes.position as THREE.BufferAttribute).array as Float32Array;
  const alphaArr = (trailGeo.attributes.alpha as THREE.BufferAttribute).array as Float32Array;
  const ptCount = Math.floor(G.slashTrailPts.length / 2);

  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const pi = Math.min(i, ptCount - 1);
    const tip = G.slashTrailPts[pi * 2] || new THREE.Vector3();
    const base = G.slashTrailPts[pi * 2 + 1] || new THREE.Vector3();

    posArr[i * 6] = tip.x;
    posArr[i * 6 + 1] = tip.y;
    posArr[i * 6 + 2] = tip.z;
    posArr[i * 6 + 3] = base.x;
    posArr[i * 6 + 4] = base.y;
    posArr[i * 6 + 5] = base.z;

    const a = i < ptCount ? (i / ptCount) : 0;
    alphaArr[i * 2] = a;
    alphaArr[i * 2 + 1] = a;
  }

  trailGeo.attributes.position.needsUpdate = true;
  trailGeo.attributes.alpha.needsUpdate = true;
}
