import * as THREE from 'three';
import { G } from './GameState';

/* ──────── Utility functions ──────── */

export const clamp = (v: number, a: number, b: number): number =>
  Math.max(a, Math.min(b, v));

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const distXZ = (a: THREE.Vector3, b: THREE.Vector3): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
};

export const normAng = (a: number): number => {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
};

export const rnd = (a: number, b: number): number =>
  a + Math.random() * (b - a);



/* ──────── Cel-shaded material helpers ──────── */

const celVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const celFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform float uMoss;
  uniform vec3 uLightDir;

  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    float NdotL = dot(vNormal, normalize(uLightDir));

    /* 3-step cel shading */
    float shade;
    if (NdotL > 0.4) shade = 1.0;
    else if (NdotL > -0.1) shade = 0.78;
    else shade = 0.58;

    /* Base color with subtle noise variation */
    float n = sin(vWorldPos.x * 2.3 + vWorldPos.y * 1.7) *
              cos(vWorldPos.z * 1.9 + vWorldPos.y * 2.1) * 0.5 + 0.5;
    vec3 col = mix(uColor, uColor2, n * 0.35);

    /* Optional moss on upward-facing surfaces */
    float up = dot(vNormal, vec3(0.0, 1.0, 0.0));
    vec3 mossCol = vec3(0.32, 0.50, 0.22);
    col = mix(col, mossCol, smoothstep(0.5, 0.9, up) * uMoss);

    col *= shade;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const celLitMats: THREE.ShaderMaterial[] = [];

/** Create a cel-shaded material matching the game's stylized look */
export function mkCelMat(
  color: number,
  color2?: number,
  moss = 0,
): THREE.ShaderMaterial {
  const c1 = new THREE.Color(color);
  const c2 = new THREE.Color(color2 ?? color);
  const m = new THREE.ShaderMaterial({
    vertexShader: celVertexShader,
    fragmentShader: celFragmentShader,
    uniforms: {
      uColor: { value: c1 },
      uColor2: { value: c2 },
      uMoss: { value: moss },
      uLightDir: { value: new THREE.Vector3(1, 1.5, 0.5).normalize() },
    },
  });
  celLitMats.push(m);
  return m;
}



/* ──────── Emissive cel material for glowing surfaces ──────── */

const celEmissiveFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEmissive;
  uniform float uPulse;
  uniform float uTime;
  uniform vec3 uLightDir;

  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    float NdotL = dot(vNormal, normalize(uLightDir));
    float shade = NdotL > 0.3 ? 1.0 : 0.8;

    float pulse = 1.0 + sin(uTime * 2.0) * uPulse * 0.15;
    vec3 col = uColor * shade + uEmissive * pulse;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const celEmissiveTimeMats: THREE.ShaderMaterial[] = [];

export function mkCelEmissiveMat(
  color: number,
  emissive: number,
  pulse = 0,
): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    vertexShader: celVertexShader,
    fragmentShader: celEmissiveFragment,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uEmissive: { value: new THREE.Color(emissive) },
      uPulse: { value: pulse },
      uTime: { value: 0 },
      uLightDir: { value: new THREE.Vector3(1, 1.5, 0.5).normalize() },
    },
  });
  celLitMats.push(m);
  if (pulse > 0) celEmissiveTimeMats.push(m);
  return m;
}

export function updateCelLightDir(lightDir: THREE.Vector3): void {
  for (const m of celLitMats) {
    m.uniforms.uLightDir.value.copy(lightDir);
  }
}

export function updateCelEmissiveMats(time: number): void {
  for (const m of celEmissiveTimeMats) {
    m.uniforms.uTime.value = time;
  }
}

/* ──────── Mesh factory helpers ──────── */

export function mkMesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x?: number,
  y?: number,
  z?: number,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  return m;
}

export function mkLight(
  color: number,
  intensity: number,
  dist: number,
  x: number,
  y: number,
  z: number,
): THREE.Sprite {
  const l = mkPointLight(color, intensity, dist);
  l.position.set(x, y, z);
  return l;
}

export function mkPointLight(
  color: number,
  intensity: number,
  dist: number,
): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    color,
    transparent: true,
    opacity: Math.min(intensity * 0.4, 1.0),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(dist * 0.5);
  return sprite;
}

export function mkAmbientLight(
  color: number,
  intensity: number,
): THREE.AmbientLight {
  return new THREE.AmbientLight(color, intensity);
}

export function mkDirectionalLight(
  color: number,
  intensity: number,
): THREE.DirectionalLight {
  return new THREE.DirectionalLight(color, intensity);
}

export function mkHemisphereLight(
  skyColor: number,
  groundColor: number,
  intensity: number,
): THREE.HemisphereLight {
  return new THREE.HemisphereLight(
    skyColor,
    groundColor,
    intensity,
  );
}

/* ──────── World coordinate helpers ──────── */

/** Terrain height at world (x, z) */
export function wH(x: number, z: number): number {
  const W = 140;
  const d = Math.sqrt(x * x + z * z);
  if (d > W) return -10;

  /* Flatten terrain inside the spawn ruin (r=8.5) with a smooth blend zone */
  const RUIN_R = 8.5;
  const BLEND_R = 14;
  let ruinFade = 1;
  if (d < RUIN_R) ruinFade = 0;
  else if (d < BLEND_R) ruinFade = (d - RUIN_R) / (BLEND_R - RUIN_R);

  const f = Math.min(1, d / 18);
  const h =
    Math.sin(x * 0.03) * 8 +
    Math.cos(z * 0.03) * 8 +
    Math.sin(x * 0.08 + z * 0.05) * 4 +
    Math.cos(x * 0.14 - z * 0.11) * 2;
  return h * f * Math.max(0, 1 - (d - 100) / 40) * ruinFade;
}

/** Random world position at valid terrain height */
export function rwp(
  minD = 24,
  maxD = 112,
  minH = -0.6,
): { x: number; y: number; z: number } {
  for (let i = 0; i < 800; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = minD + Math.random() * (maxD - minD);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = wH(x, z);
    if (y >= minH) return { x, y, z };
  }
  return { x: 28, y: wH(28, 0), z: 0 };
}

/** World position to screen coordinates */
export function w2s(pos: THREE.Vector3): { x: number; y: number; behind: boolean } {
  const v = pos.clone().project(G.cam!);
  return {
    x: (v.x * 0.5 + 0.5) * innerWidth,
    y: (-v.y * 0.5 + 0.5) * innerHeight,
    behind: v.z > 1,
  };
}

/** Get current objective target position */
export function objTarget(): THREE.Vector3 {
  if (G.questPhase === 0 || G.questPhase >= 2) {
    return G.npc ? G.npc.position : new THREE.Vector3();
  }
  let b: THREE.Vector3 | null = null;
  let bd = Infinity;
  for (const c of G.entities.collectibles) {
    if (c.collected) continue;
    const d = G.player!.position.distanceTo(c.mesh.position);
    if (d < bd) {
      bd = d;
      b = c.mesh.position;
    }
  }
  return b || (G.npc ? G.npc.position : new THREE.Vector3());
}


