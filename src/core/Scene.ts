import * as THREE from 'three';
import { G } from './GameState';
import { mkAmbientLight, mkDirectionalLight, mkHemisphereLight, updateCelLightDir } from './Helpers';
import { settings } from '../ui/Settings';

let ambientLight: THREE.AmbientLight | null = null;
let hemiLight: THREE.HemisphereLight | null = null;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export interface LightingDebugSettings {
  timeOfDay: number;
  freezeTime: boolean;
  exposure: number;
  sunScale: number;
  ambientScale: number;
  hemiScale: number;
  fogScale: number;
}

const lightingDebug: LightingDebugSettings = {
  timeOfDay: 0.3,
  freezeTime: false,
  exposure: 1.1,
  sunScale: 1,
  ambientScale: 1,
  hemiScale: 1,
  fogScale: 1,
};

export function getLightingDebugSettings(): LightingDebugSettings {
  return { ...lightingDebug };
}

export function updateLightingDebugSettings(next: Partial<LightingDebugSettings>): void {
  if (typeof next.timeOfDay === 'number') {
    lightingDebug.timeOfDay = ((next.timeOfDay % 1) + 1) % 1;
    if (lightingDebug.freezeTime) G.dayTime = lightingDebug.timeOfDay;
  }
  if (typeof next.freezeTime === 'boolean') lightingDebug.freezeTime = next.freezeTime;
  if (typeof next.exposure === 'number') lightingDebug.exposure = Math.max(0.2, next.exposure);
  if (typeof next.sunScale === 'number') lightingDebug.sunScale = Math.max(0, next.sunScale);
  if (typeof next.ambientScale === 'number') lightingDebug.ambientScale = Math.max(0, next.ambientScale);
  if (typeof next.hemiScale === 'number') lightingDebug.hemiScale = Math.max(0, next.hemiScale);
  if (typeof next.fogScale === 'number') lightingDebug.fogScale = Math.max(0.1, next.fogScale);

  if (G.rend) G.rend.toneMappingExposure = lightingDebug.exposure;
}

export function resetLightingDebugSettings(): void {
  updateLightingDebugSettings({
    timeOfDay: 0.3,
    freezeTime: false,
    exposure: 1.1,
    sunScale: 1,
    ambientScale: 1,
    hemiScale: 1,
    fogScale: 1,
  });
}

export function setupLighting(): void {
  ambientLight = mkAmbientLight(0xffffff, 0.34);
  G.scene!.add(ambientLight);

  const sun = mkDirectionalLight(0xfff4e1, 1.25);
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

  hemiLight = mkHemisphereLight(0x9fceff, 0x4a6444, 0.34);
  G.scene!.add(hemiLight);
  updateCelLightDir(sun.position.clone().normalize());
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

type ComposerLike = {
  addPass: (pass: unknown) => void;
  render: () => void;
  setSize: (width: number, height: number) => void;
  passes?: Array<{ enabled?: boolean; userData?: Record<string, unknown> }>;
};

type ShaderPassLike = {
  uniforms: {
    uSunScreen: { value: THREE.Vector2 };
    uIntensity: { value: number };
  };
  userData?: Record<string, unknown>;
};

let godRayPass: ShaderPassLike | null = null;
let postProcessingLoadPromise: Promise<void> | null = null;

export function setupPostProcessing(): Promise<void> {
  if (postProcessingLoadPromise) return postProcessingLoadPromise;

  G.rend!.toneMapping = THREE.ACESFilmicToneMapping;
  G.rend!.toneMappingExposure = lightingDebug.exposure;

  postProcessingLoadPromise = Promise.all([
    import('three/examples/jsm/postprocessing/EffectComposer.js'),
    import('three/examples/jsm/postprocessing/RenderPass.js'),
    import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
    import('three/examples/jsm/postprocessing/ShaderPass.js'),
    import('three/examples/jsm/postprocessing/SSAOPass.js'),
    import('three/examples/jsm/shaders/GammaCorrectionShader.js'),
  ]).then(([
    effectComposerMod,
    renderPassMod,
    bloomPassMod,
    shaderPassMod,
    ssaoPassMod,
    gammaCorrectionMod,
  ]) => {
    if (!G.rend || !G.scene || !G.cam) return;

    const composer = new effectComposerMod.EffectComposer(G.rend!) as ComposerLike;
    composer.addPass(new renderPassMod.RenderPass(G.scene!, G.cam!));

    const ssao = new ssaoPassMod.SSAOPass(G.scene!, G.cam!, innerWidth, innerHeight) as {
      kernelRadius: number;
      minDistance: number;
      maxDistance: number;
      output: unknown;
      enabled?: boolean;
      userData?: Record<string, unknown>;
    };
    ssao.kernelRadius = 12;
    ssao.minDistance = 0.002;
    ssao.maxDistance = 0.15;
    ssao.output = (ssaoPassMod.SSAOPass as any).OUTPUT.Default;
    ssao.enabled = settings.ssao;
    ssao.userData = { ...(ssao.userData || {}), passType: 'ssao' };
    composer.addPass(ssao);

    const bloom = new bloomPassMod.UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      0.35,
      0.6,
      0.7,
    ) as { enabled?: boolean; userData?: Record<string, unknown> };
    bloom.enabled = settings.bloom;
    bloom.userData = { ...(bloom.userData || {}), passType: 'bloom' };
    composer.addPass(bloom);

    godRayPass = new shaderPassMod.ShaderPass(GodRayShader) as unknown as ShaderPassLike;
    godRayPass.userData = { ...(godRayPass.userData || {}), passType: 'godRays' };
    composer.addPass(godRayPass);

    /* Gamma correction pass — required for pre-r153 Three.js with EffectComposer.
       The EffectComposer's render targets use LinearEncoding, so MeshPhongMaterial
       (from FBXLoader) outputs linear values that need sRGB conversion for correct
       brightness on screen. */
    const gammaPass = new shaderPassMod.ShaderPass(gammaCorrectionMod.GammaCorrectionShader);
    composer.addPass(gammaPass);

    G.composer = composer as never;
  });

  return postProcessingLoadPromise;
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
      uZenith: { value: new THREE.Color(0x4b88c8) },
      uHorizon: { value: new THREE.Color(0x92c7ea) },
      uGround: { value: new THREE.Color(0x36533b) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(0xfff4e1) },
    },
  });
  G.skyDome = new THREE.Mesh(geo, mat);
  G.skyDome.renderOrder = -1;
  G.scene!.add(G.skyDome);
}

export function updateDayNight(dt: number): void {
  if (lightingDebug.freezeTime) {
    G.dayTime = lightingDebug.timeOfDay;
  } else {
    G.dayTime += dt * 0.008;
    if (G.dayTime > 1) G.dayTime -= 1;
    lightingDebug.timeOfDay = G.dayTime;
  }
  const t = G.dayTime;

  G.sunLight!.position.set(
    Math.cos(t * Math.PI * 2) * 150,
    Math.sin(t * Math.PI * 2) * 150,
    60,
  );
  const sunDir = G.sunLight!.position.clone().normalize();
  updateCelLightDir(sunDir);

  const sunHeight = G.sunLight!.position.y / 150;
  const daylight = clamp01((sunHeight + 0.18) / 0.88);
  const nightFactor = clamp01((-sunHeight - 0.02) / 0.72);
  const twilight = clamp01(1.0 - Math.abs(sunHeight) / 0.42) * (1.0 - nightFactor * 0.35);

  const fogDay = new THREE.Color(0x92c7ea);
  const fogTwilight = new THREE.Color(0x6d678c);
  const fogNight = new THREE.Color(0x08121d);
  const sc = fogDay.clone().lerp(fogTwilight, twilight).lerp(fogNight, nightFactor);
  G.scene!.fog!.color.copy(sc);
  if (G.scene!.fog instanceof THREE.FogExp2) {
    G.scene!.fog.density = 0.008 * (0.9 + nightFactor * 0.35) * lightingDebug.fogScale;
  }
  G.scene!.background = sc.clone();

  const sunDay = new THREE.Color(0xfff2dd);
  const sunTwilight = new THREE.Color(0xffb37a);
  const sunNight = new THREE.Color(0x6f84b8);
  G.sunLight!.color.copy(sunDay.clone().lerp(sunTwilight, twilight).lerp(sunNight, nightFactor));
  G.sunLight!.intensity = (0.12 + daylight * 1.12 + twilight * 0.08) * lightingDebug.sunScale;

  if (ambientLight) {
    ambientLight.color.copy(new THREE.Color(0xffffff).lerp(new THREE.Color(0x91a6d2), nightFactor * 0.5));
    ambientLight.intensity = (0.18 + daylight * 0.16 + nightFactor * 0.06) * lightingDebug.ambientScale;
  }

  if (hemiLight) {
    hemiLight.color.copy(new THREE.Color(0xa8d8ff).lerp(new THREE.Color(0x314a72), nightFactor));
    hemiLight.groundColor.copy(new THREE.Color(0x486447).lerp(new THREE.Color(0x0f1d1d), nightFactor));
    hemiLight.intensity = (0.16 + daylight * 0.22 + twilight * 0.04) * lightingDebug.hemiScale;
  }

  /* ── Update sky dome ── */
  if (G.skyDome) {
    const mat = G.skyDome.material as THREE.ShaderMaterial;
    mat.uniforms.uSunDir.value.copy(sunDir);

    const zenithDay = new THREE.Color(0x4e8ed2);
    const zenithTwilight = new THREE.Color(0x4e4673);
    const zenithNight = new THREE.Color(0x040a14);
    const horizonDay = new THREE.Color(0xa8d7f4);
    const horizonTwilight = new THREE.Color(0x7c719a);
    const horizonNight = new THREE.Color(0x0b1625);
    const groundDay = new THREE.Color(0x39543c);
    const groundNight = new THREE.Color(0x0b1614);

    mat.uniforms.uZenith.value.copy(zenithDay.clone().lerp(zenithTwilight, twilight).lerp(zenithNight, nightFactor));
    mat.uniforms.uHorizon.value.copy(horizonDay.clone().lerp(horizonTwilight, twilight).lerp(horizonNight, nightFactor));
    mat.uniforms.uGround.value.copy(groundDay.clone().lerp(groundNight, nightFactor));
    mat.uniforms.uSunColor.value.copy(sunDay.clone().lerp(sunTwilight, twilight).lerp(sunNight, nightFactor));

    // Follow camera so it never clips
    if (G.cam) G.skyDome.position.copy(G.cam.position);
  }
}
