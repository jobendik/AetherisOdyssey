import * as THREE from 'three';
import { G } from '../core/GameState';
import { wH } from '../core/Helpers';

const BLADE_COUNT = 18000;
const PATCH_RADIUS = 110;

let grassMesh: THREE.Mesh | null = null;

const grassVertexShader = /* glsl */ `
  attribute vec3 offset;
  attribute float scale;
  attribute float phase;
  attribute vec3 tint;

  uniform float uTime;
  uniform float uWindStrength;
  uniform vec3 uPlayerPos;

  varying vec3 vColor;
  varying float vY;

  void main() {
    /* Blade local space: position.y goes 0..1 */
    vY = position.y;

    /* Wind displacement — stronger at the top of the blade */
    float windAngle = uTime * 1.8 + offset.x * 0.15 + offset.z * 0.1 + phase;
    float windX = sin(windAngle) * uWindStrength * vY * vY * 0.35;
    float windZ = cos(windAngle * 0.7 + 1.3) * uWindStrength * 0.5 * vY * vY * 0.35;

    /* Player interaction: push blades away from player */
    vec3 worldPos = offset;
    vec2 toPlayer = worldPos.xz - uPlayerPos.xz;
    float playerDist = length(toPlayer);
    float pushRadius = 2.5;
    float pushStrength = smoothstep(pushRadius, 0.0, playerDist) * vY * vY;
    vec2 pushDir = playerDist > 0.01 ? normalize(toPlayer) : vec2(0.0);
    windX += pushDir.x * pushStrength * 1.8;
    windZ += pushDir.y * pushStrength * 1.8;

    /* Scale the blade */
    vec3 pos = position;
    pos.xz *= scale * 0.18;
    pos.y *= scale * 0.5;

    /* Apply wind */
    pos.x += windX;
    pos.z += windZ;

    /* Move to world position */
    pos += offset;

    vColor = tint;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const grassFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vY;

  void main() {
    /* Darken at the base, lighter at tips — creates depth */
    float shade = 0.55 + 0.45 * vY;
    vec3 col = vColor * shade;

    /* Subtle cel-shade band */
    col = floor(col * 6.0) / 6.0;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function buildGrass(): void {
  /* Blade geometry: a simple tapered triangle strip (3 quads) */
  const baseGeo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    // x, y, z  — blade in local space, y = 0..1
    -0.5, 0, 0,   0.5, 0, 0,
    -0.35, 0.33, 0,   0.35, 0.33, 0,
    -0.15, 0.66, 0,   0.15, 0.66, 0,
    0, 1, 0,
  ]);
  const indices = [0,1,2, 1,3,2, 2,3,4, 3,5,4, 4,5,6];
  baseGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  baseGeo.setIndex(indices);
  baseGeo.computeVertexNormals();

  /* Instance attributes */
  const offsets = new Float32Array(BLADE_COUNT * 3);
  const scales = new Float32Array(BLADE_COUNT);
  const phases = new Float32Array(BLADE_COUNT);
  const tints = new Float32Array(BLADE_COUNT * 3);

  const baseColors = [
    [0.32, 0.58, 0.24],
    [0.38, 0.65, 0.30],
    [0.42, 0.70, 0.28],
    [0.30, 0.52, 0.20],
    [0.45, 0.68, 0.35],
  ];

  let placed = 0;
  for (let i = 0; i < BLADE_COUNT * 4 && placed < BLADE_COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * (PATCH_RADIUS - 8);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = wH(x, z);
    if (y < -1) continue; // skip underwater

    const idx = placed * 3;
    offsets[idx] = x;
    offsets[idx + 1] = y;
    offsets[idx + 2] = z;

    scales[placed] = 0.6 + Math.random() * 1.0;
    phases[placed] = Math.random() * Math.PI * 2;

    const c = baseColors[Math.floor(Math.random() * baseColors.length)];
    tints[idx] = c[0] + (Math.random() - 0.5) * 0.06;
    tints[idx + 1] = c[1] + (Math.random() - 0.5) * 0.08;
    tints[idx + 2] = c[2] + (Math.random() - 0.5) * 0.04;

    placed++;
  }

  /* Build InstancedBufferGeometry from the base blade */
  const finalCount = placed;
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = baseGeo.index;
  geo.setAttribute('position', baseGeo.getAttribute('position'));
  geo.setAttribute('normal', baseGeo.getAttribute('normal'));
  geo.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets.subarray(0, finalCount * 3), 3));
  geo.setAttribute('scale', new THREE.InstancedBufferAttribute(scales.subarray(0, finalCount), 1));
  geo.setAttribute('phase', new THREE.InstancedBufferAttribute(phases.subarray(0, finalCount), 1));
  geo.setAttribute('tint', new THREE.InstancedBufferAttribute(tints.subarray(0, finalCount * 3), 3));
  geo.instanceCount = finalCount;

  const mat = new THREE.ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uWindStrength: { value: 0.8 },
      uPlayerPos: { value: new THREE.Vector3() },
    },
    side: THREE.DoubleSide,
  });

  grassMesh = new THREE.Mesh(geo, mat);
  grassMesh.frustumCulled = false;
  G.scene!.add(grassMesh);
}

export function updateGrass(): void {
  if (!grassMesh) return;
  const mat = grassMesh.material as THREE.ShaderMaterial;
  mat.uniforms.uTime.value = G.worldTime;
  if (G.player) mat.uniforms.uPlayerPos.value.copy(G.player.position);
}
