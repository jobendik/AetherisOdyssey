import * as THREE from 'three';
import { G } from '../core/GameState';

/* ──── Reflection render target ──── */
const REFL_SIZE = 512;
const REFL_UPDATE_INTERVAL = 1 / 20;
let reflTarget: THREE.WebGLRenderTarget | null = null;
const reflCamera = new THREE.PerspectiveCamera();
const reflPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 3); // y = -3 → normal up, constant 3
const clipPlane = new THREE.Vector4(0, 1, 0, 3);
let lastReflectionTime = -Infinity;

const waterVertexShader = /* glsl */ `
  uniform float uTime;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec4 vReflUv;

  void main() {
    vec3 pos = position;

    /* Animated waves */
    float w1 = sin(pos.x * 0.12 + uTime * 1.2) * cos(pos.y * 0.1 + uTime * 0.8) * 0.6;
    float w2 = sin(pos.x * 0.25 - uTime * 0.9 + pos.y * 0.18) * 0.3;
    float w3 = cos(pos.x * 0.06 + pos.y * 0.08 + uTime * 0.5) * 0.8;
    pos.z += w1 + w2 + w3;

    /* Compute analytical normal from wave derivatives */
    float dx1 = cos(pos.x * 0.12 + uTime * 1.2) * 0.12 * cos(pos.y * 0.1 + uTime * 0.8) * 0.6;
    float dx2 = cos(pos.x * 0.25 - uTime * 0.9 + pos.y * 0.18) * 0.25 * 0.3;
    float dx3 = -sin(pos.x * 0.06 + pos.y * 0.08 + uTime * 0.5) * 0.06 * 0.8;
    float dy1 = sin(pos.x * 0.12 + uTime * 1.2) * (-sin(pos.y * 0.1 + uTime * 0.8)) * 0.1 * 0.6;
    float dy2 = cos(pos.x * 0.25 - uTime * 0.9 + pos.y * 0.18) * 0.18 * 0.3;
    float dy3 = -sin(pos.x * 0.06 + pos.y * 0.08 + uTime * 0.5) * 0.08 * 0.8;

    vec3 waveNormal = normalize(vec3(-(dx1+dx2+dx3), -(dy1+dy2+dy3), 1.0));

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize((modelMatrix * vec4(waveNormal, 0.0)).xyz);
    vViewDir = normalize(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;

    /* Reflection UV — project via clip space, then remap to 0..1 */
    vReflUv = gl_Position;
  }
`;

const waterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFoamColor;
  uniform vec3 uPlayerPos;
  uniform vec3 uLightDir;
  uniform sampler2D uReflection;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec4 vReflUv;

  void main() {
    /* Fresnel: more reflective at grazing angles */
    float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);

    /* Depth-based gradient */
    float dist = length(vWorldPos.xz) / 140.0;
    float shoreNoise = sin(vWorldPos.x * 0.04 + vWorldPos.z * 0.03) * 0.1
                     + cos(vWorldPos.x * 0.07 - vWorldPos.z * 0.05) * 0.08;
    float depth = smoothstep(0.0, 0.45, dist + shoreNoise);
    float playerDist = length(vWorldPos.xz - uPlayerPos.xz) / 15.0;
    depth = mix(depth * 0.6, depth, smoothstep(0.0, 1.0, playerDist));

    vec3 waterCol = mix(uShallowColor, uDeepColor, depth);
    float baseAlpha = mix(0.45, 0.88, depth);

    /* Specular highlight */
    vec3 lightDir = normalize(uLightDir);
    vec3 halfDir = normalize(lightDir + vViewDir);
    float spec = pow(max(dot(vNormal, halfDir), 0.0), 80.0) * 1.2;

    /* Foam */
    float foam1 = sin(vWorldPos.x * 0.3 + uTime * 1.5) * cos(vWorldPos.z * 0.25 + uTime);
    float foam2 = sin(vWorldPos.x * 0.15 - uTime * 0.8 + vWorldPos.z * 0.2);
    float foamBase = smoothstep(0.75, 0.95, foam1 * 0.5 + foam2 * 0.5 + 0.5);
    float foamShore = (1.0 - smoothstep(0.0, 0.2, dist)) * 0.6;
    float foam = (foamBase * 0.5 + foamShore) * (1.0 - depth * 0.5);

    /* Cel-shade the water */
    float NdotL = dot(vNormal, lightDir);
    float shade = smoothstep(-0.1, 0.1, NdotL) * 0.3 + 0.7;
    shade = floor(shade * 3.0) / 3.0;

    /* Sample planar reflection texture */
    vec2 rUv = vReflUv.xy / vReflUv.w * 0.5 + 0.5;
    /* Distort reflection UVs by wave normals for ripple effect */
    rUv += vNormal.xz * 0.02;
    rUv = clamp(rUv, 0.0, 1.0);
    vec3 reflCol = texture2D(uReflection, vec2(rUv.x, 1.0 - rUv.y)).rgb;

    vec3 col = mix(waterCol * shade, reflCol, fresnel * 0.55);
    col += spec * vec3(1.0, 0.95, 0.9);
    col = mix(col, uFoamColor, foam);

    /* Cel-shade quantization */
    col = floor(col * 8.0) / 8.0;

    gl_FragColor = vec4(col, baseAlpha - fresnel * 0.1);
  }
`;

export function buildWater(): void {
  const geo = new THREE.PlaneGeometry(900, 900, 128, 128);

  reflTarget = new THREE.WebGLRenderTarget(REFL_SIZE, REFL_SIZE, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  });

  const mat = new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color(0x0a4a7a) },
      uShallowColor: { value: new THREE.Color(0x2d88d1) },
      uFoamColor: { value: new THREE.Color(0xddeeff) },
      uPlayerPos: { value: new THREE.Vector3() },
      uLightDir: { value: new THREE.Vector3(1, 1.5, 0.5).normalize() },
      uReflection: { value: reflTarget.texture },
    },
    transparent: true,
    side: THREE.DoubleSide,
  });

  G.water = new THREE.Mesh(geo, mat);
  G.water.rotation.x = -Math.PI / 2;
  G.water.position.y = -3;
  G.scene!.add(G.water);
}

/* Cached vector for water reflection to avoid per-frame allocations */
const _waterCamDir = new THREE.Vector3();

/** Render the reflection pass — call before the main render each frame */
export function renderWaterReflection(): void {
  if (!reflTarget || !G.water || !G.cam || !G.rend || !G.scene) return;
  if (G.worldTime - lastReflectionTime < REFL_UPDATE_INTERVAL) return;
  lastReflectionTime = G.worldTime;

  /* Copy camera */
  reflCamera.copy(G.cam);
  reflCamera.position.copy(G.cam.position);
  reflCamera.quaternion.copy(G.cam.quaternion);

  /* Mirror camera across water plane (y = -3) */
  const waterY = -3;
  reflCamera.position.y = 2 * waterY - reflCamera.position.y;
  reflCamera.up.set(0, -1, 0);
  G.cam.getWorldDirection(_waterCamDir);
  reflCamera.lookAt(
    reflCamera.position.x + _waterCamDir.x,
    reflCamera.position.y - _waterCamDir.y,
    reflCamera.position.z + _waterCamDir.z,
  );
  reflCamera.updateProjectionMatrix();
  reflCamera.updateMatrixWorld();

  /* Hide water mesh during reflection render to avoid recursion */
  G.water.visible = false;

  /* Clip above water */
  G.rend.clippingPlanes = [reflPlane];

  const origTarget = G.rend.getRenderTarget();
  G.rend.setRenderTarget(reflTarget);
  G.rend.clear();
  G.rend.render(G.scene, reflCamera);
  G.rend.setRenderTarget(origTarget);

  G.rend.clippingPlanes = [];
  G.water.visible = true;
}

export function updateWater(): void {
  if (!G.water) return;
  const mat = G.water.material as THREE.ShaderMaterial;
  if (mat.uniforms) {
    mat.uniforms.uTime.value = G.worldTime;
    if (G.player) mat.uniforms.uPlayerPos.value.copy(G.player.position);
    if (G.sunLight) mat.uniforms.uLightDir.value.copy(G.sunLight.position).normalize();
  }
}
