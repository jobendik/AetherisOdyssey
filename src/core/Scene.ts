import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { G } from './GameState';
import { legacyLightIntensity, updateCelLightDir } from './Helpers';

export function setupLighting(): void {
  G.scene!.add(new THREE.AmbientLight(0xffffff, legacyLightIntensity(0.42)));

  const sun = new THREE.DirectionalLight(0xfff4e1, legacyLightIntensity(1.25));
  sun.position.set(110, 150, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 200;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  const d = 60;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  G.scene!.add(sun);
  G.sunLight = sun;

  G.scene!.add(new THREE.HemisphereLight(0x8dd9ff, 0x3e6842, legacyLightIntensity(0.45)));
}

/** Keep shadow camera centered on the player for sharper nearby shadows */
export function updateShadowCamera(): void {
  if (!G.sunLight || !G.player) return;
  const px = G.player.position.x;
  const pz = G.player.position.z;
  G.sunLight.target.position.set(px, 0, pz);
  G.sunLight.target.updateMatrixWorld();
}

/* ──── Post-processing ──── */

/* God-ray (radial light-shaft) shader */
const GodRayShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSunScreen: { value: new THREE.Vector2(0.5, 0.5) },
    uIntensity: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uSunScreen;
    uniform float uIntensity;
    varying vec2 vUv;
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      if (uIntensity < 0.01) { gl_FragColor = col; return; }
      vec2 delta = (vUv - uSunScreen) * 0.006;
      float illum = 1.0;
      vec2 tc = vUv;
      float totalWeight = 0.0;
      vec3 rays = vec3(0.0);
      for (int i = 0; i < 40; i++) {
        tc -= delta;
        vec4 s = texture2D(tDiffuse, tc);
        float lum = dot(s.rgb, vec3(0.299, 0.587, 0.114));
        float w = illum * max(0.0, lum - 0.4);
        rays += s.rgb * w;
        totalWeight += w;
        illum *= 0.97;
      }
      if (totalWeight > 0.0) rays /= totalWeight;
      col.rgb += rays * uIntensity * 0.35;
      gl_FragColor = col;
    }
  `,
};

let godRayPass: ShaderPass | null = null;

export function setupPostProcessing(): void {
  G.rend!.toneMapping = THREE.ACESFilmicToneMapping;
  G.rend!.toneMappingExposure = 1.1;

  const composer = new EffectComposer(G.rend!);
  composer.addPass(new RenderPass(G.scene!, G.cam!));

  /* SSAO — subtle ambient occlusion for ground-contact darkening */
  const ssao = new SSAOPass(G.scene!, G.cam!, innerWidth, innerHeight);
  ssao.kernelRadius = 12;
  ssao.minDistance = 0.002;
  ssao.maxDistance = 0.15;
  (ssao as any).output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssao);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    0.35,  // strength
    0.6,   // radius
    0.7,   // threshold
  );
  composer.addPass(bloom);

  /* God rays pass */
  godRayPass = new ShaderPass(GodRayShader);
  composer.addPass(godRayPass);

  G.composer = composer;
}

/** Call each frame to update god-ray sun screen position and intensity */
export function updateGodRays(): void {
  if (!godRayPass || !G.cam || !G.sunLight) return;
  const sunWorld = G.sunLight.position.clone().normalize().multiplyScalar(200);
  if (G.cam) sunWorld.add(G.cam.position); // keep relative to camera
  const sunNdc = sunWorld.project(G.cam);
  const sx = sunNdc.x * 0.5 + 0.5;
  const sy = sunNdc.y * 0.5 + 0.5;
  godRayPass.uniforms.uSunScreen.value.set(sx, sy);

  /* Intensity based on time of day — strongest at dawn/dusk */
  const t = G.dayTime;
  let intensity = 0;
  if (t > 0.18 && t < 0.35) intensity = 1 - Math.abs((t - 0.265) / 0.085); // dawn
  if (t > 0.75 && t < 0.92) intensity = 1 - Math.abs((t - 0.835) / 0.085); // dusk
  /* Only show when sun is above horizon */
  if (sunNdc.z > 1) intensity = 0;
  godRayPass.uniforms.uIntensity.value = Math.max(0, intensity) * 0.8;
}

export function resizePostProcessing(): void {
  if (G.composer) {
    G.composer.setSize(innerWidth, innerHeight);
  }
}

/* ──── Skybox dome ──── */

const skyVertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;

  varying vec3 vWorldPos;

  void main() {
    vec3 dir = normalize(vWorldPos - cameraPosition);
    float y = dir.y;

    /* Gradient: ground -> horizon -> zenith */
    vec3 col;
    if (y < 0.0) {
      col = mix(uHorizon, uGround, clamp(-y * 4.0, 0.0, 1.0));
    } else {
      col = mix(uHorizon, uZenith, clamp(pow(y, 0.6), 0.0, 1.0));
    }

    /* Sun glow */
    float sunDot = max(0.0, dot(dir, uSunDir));
    col += uSunColor * pow(sunDot, 128.0) * 2.0;         /* Hard sun disc */
    col += uSunColor * pow(sunDot, 8.0) * 0.25;           /* Wide glow */

    /* Stars at night (visible when zenith is dark) */
    float darkness = 1.0 - clamp(length(uZenith) * 2.0, 0.0, 1.0);
    if (darkness > 0.2 && y > 0.0) {
      float star = fract(sin(dot(floor(dir.xz * 400.0), vec2(12.9898, 78.233))) * 43758.5453);
      if (star > 0.997) {
        float twinkle = sin(star * 6000.0 + uSunDir.x * 10.0) * 0.5 + 0.5;
        col += vec3(0.8, 0.85, 1.0) * darkness * twinkle * y;
      }
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function buildSkyDome(): void {
  const geo = new THREE.SphereGeometry(450, 32, 20);
  const mat = new THREE.ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x4488cc) },
      uHorizon: { value: new THREE.Color(0x83b7de) },
      uGround: { value: new THREE.Color(0x3e6842) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(0xfff4e1) },
    },
  });
  G.skyDome = new THREE.Mesh(geo, mat);
  G.skyDome.renderOrder = -1;
  G.scene!.add(G.skyDome);
}

export function updateDayNight(dt: number): void {
  G.dayTime += dt * 0.008;
  if (G.dayTime > 1) G.dayTime -= 1;
  const t = G.dayTime;

  G.sunLight!.position.set(
    Math.cos(t * Math.PI * 2) * 150,
    Math.sin(t * Math.PI * 2) * 150,
    60,
  );
  updateCelLightDir(G.sunLight!.position.clone().normalize());

  const dc = new THREE.Color(0x83b7de);
  const dk = new THREE.Color(0xd4774a);
  const nc = new THREE.Color(0x0a1628);

  let sc: THREE.Color;
  if (t < 0.2) sc = dc;
  else if (t < 0.3) sc = dc.clone().lerp(dk, (t - 0.2) * 10);
  else if (t < 0.4) sc = dk.clone().lerp(nc, (t - 0.3) * 10);
  else if (t < 0.7) sc = nc;
  else if (t < 0.8) sc = nc.clone().lerp(dk, (t - 0.7) * 10);
  else sc = dk.clone().lerp(dc, (t - 0.8) * 5);

  G.scene!.fog!.color.copy(sc);

  const isN = t > 0.5;
  G.sunLight!.intensity = legacyLightIntensity(
    isN
      ? Math.max(0.15, 1 - Math.min(1, (t - 0.5) * 4) * 0.85)
      : 1.25,
  );
  G.sunLight!.color.set(
    isN ? 0x8899cc : t > 0.2 && t < 0.4 ? 0xffaa66 : 0xfff4e1,
  );

  /* ── Update sky dome ── */
  if (G.skyDome) {
    const mat = G.skyDome.material as THREE.ShaderMaterial;
    const sunDir = G.sunLight!.position.clone().normalize();
    mat.uniforms.uSunDir.value.copy(sunDir);

    // Zenith: deep blue day → dark night
    const zenithDay = new THREE.Color(0x4488cc);
    const zenithDusk = new THREE.Color(0x663355);
    const zenithNight = new THREE.Color(0x050a18);

    let zenith: THREE.Color;
    if (t < 0.2) zenith = zenithDay;
    else if (t < 0.3) zenith = zenithDay.clone().lerp(zenithDusk, (t - 0.2) * 10);
    else if (t < 0.4) zenith = zenithDusk.clone().lerp(zenithNight, (t - 0.3) * 10);
    else if (t < 0.7) zenith = zenithNight;
    else if (t < 0.8) zenith = zenithNight.clone().lerp(zenithDusk, (t - 0.7) * 10);
    else zenith = zenithDusk.clone().lerp(zenithDay, (t - 0.8) * 5);

    mat.uniforms.uZenith.value.copy(zenith);
    mat.uniforms.uHorizon.value.copy(sc);
    mat.uniforms.uSunColor.value.set(
      isN ? 0x556688 : t > 0.2 && t < 0.4 ? 0xff8844 : 0xfff4e1,
    );

    // Follow camera so it never clips
    if (G.cam) G.skyDome.position.copy(G.cam.position);
  }
}
