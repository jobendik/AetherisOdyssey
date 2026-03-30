import * as THREE from 'three';
import { G } from '../core/GameState';
import { wH, rwp } from '../core/Helpers';

const terrainVertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vSlope;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(normalMatrix * normal);
    vSlope = 1.0 - abs(dot(vNormal, vec3(0.0, 1.0, 0.0)));
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const terrainFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLightDir;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vSlope;

  void main() {
    /* Base grass color with subtle variation */
    float n1 = sin(vWorldPos.x * 0.15) * cos(vWorldPos.z * 0.12) * 0.5 + 0.5;
    float n2 = sin(vWorldPos.x * 0.4 + vWorldPos.z * 0.3) * 0.5 + 0.5;
    vec3 grassA = vec3(0.38, 0.62, 0.28);   /* lush green */
    vec3 grassB = vec3(0.48, 0.72, 0.32);   /* lighter green */
    vec3 grassC = vec3(0.32, 0.52, 0.22);   /* darker patches */
    vec3 grass = mix(mix(grassA, grassB, n1), grassC, n2 * 0.4);

    /* Height-based blending: dirt at low, snow-ish at peaks */
    vec3 dirt = vec3(0.45, 0.35, 0.22);
    vec3 rock = vec3(0.52, 0.48, 0.44);
    vec3 snow = vec3(0.85, 0.88, 0.92);

    float h = vWorldPos.y;
    vec3 col = grass;
    /* Blend to dirt/rock on steep slopes */
    col = mix(col, rock, smoothstep(0.5, 0.85, vSlope));
    /* Blend to dirt at very low areas (near water) */
    col = mix(col, dirt, smoothstep(1.0, -1.5, h));
    /* Subtle snow dusting only on the very highest peaks */
    col = mix(col, snow, smoothstep(16.0, 22.0, h) * 0.3 * (1.0 - vSlope));

    /* Smooth cel-shading: 3 bands */
    float NdotL = dot(vNormal, normalize(uLightDir));
    float shade = smoothstep(-0.1, 0.05, NdotL) * 0.3 + 0.7;
    shade = floor(shade * 3.0 + 0.5) / 3.0;

    col *= shade;

    /* ──── Caustic light patterns near waterline ──── */
    float waterDist = smoothstep(-3.0, 1.5, h); // 1 = above water, 0 = submerged
    float causticsBlend = (1.0 - waterDist) * smoothstep(-5.0, -2.5, h); // only between -5 and -0.5
    if (causticsBlend > 0.01) {
      /* Two overlapping animated voronoi-like patterns */
      vec2 cuv = vWorldPos.xz * 0.25;
      float c1 = sin(cuv.x * 3.0 + uTime * 1.2) * cos(cuv.y * 2.8 - uTime * 0.9);
      float c2 = cos(cuv.x * 2.3 - uTime * 0.7) * sin(cuv.y * 3.5 + uTime * 1.1);
      float c3 = sin((cuv.x + cuv.y) * 4.0 + uTime * 0.8) * 0.5;
      float caustic = abs(c1 + c2 + c3) * 0.33;
      caustic = smoothstep(0.15, 0.65, caustic);
      vec3 causticCol = vec3(0.3, 0.65, 0.9) * caustic * 0.45;
      col += causticCol * causticsBlend;
    }

    /* Distance fade for fog compatibility */
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function buildTerrain(): void {
  const tGeo = new THREE.PlaneGeometry(300, 300, 200, 200);
  tGeo.rotateX(-Math.PI / 2);
  const pos = tGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, wH(pos.getX(i), pos.getZ(i)));
  }
  tGeo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    vertexShader: terrainVertexShader,
    fragmentShader: terrainFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uLightDir: { value: new THREE.Vector3(1, 1.5, 0.5).normalize() },
    },
  });

  G.terrain = new THREE.Mesh(tGeo, mat);
  G.terrain.receiveShadow = true;
  G.scene!.add(G.terrain);

  /* ──── Ground decals: dirt patches, leaf clusters ──── */
  buildGroundDecals();

  /* ──── Distant mountain silhouettes ──── */
  buildDistantMountains();
}

function buildGroundDecals(): void {
  /* Dirt patches — flat circles with slight brown tint */
  const dirtMat = new THREE.MeshBasicMaterial({
    color: 0x6b5a3e,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (let i = 0; i < 30; i++) {
    const { x, z } = rwp(10, 100, -0.5);
    const y = wH(x, z);
    if (y < -0.5) continue;
    const r = 1.5 + Math.random() * 3;
    const geo = new THREE.CircleGeometry(r, 8);
    const m = new THREE.Mesh(geo, dirtMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.05, z);
    G.scene!.add(m);
  }

  /* Fallen leaf clusters — scattered small quads */
  const leafColors = [0x8b6914, 0xa07030, 0x9c5b20, 0x7a4a10];
  for (let i = 0; i < 40; i++) {
    const { x, z } = rwp(15, 95, -0.3);
    const y = wH(x, z);
    if (y < -0.3) continue;
    const leafMat = new THREE.MeshBasicMaterial({
      color: leafColors[i % leafColors.length],
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(0.3 + Math.random() * 0.3, 0.2 + Math.random() * 0.2);
    const m = new THREE.Mesh(geo, leafMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI * 2;
    m.position.set(x + Math.random() * 2 - 1, y + 0.03, z + Math.random() * 2 - 1);
    G.scene!.add(m);
  }

  /* Small pebbles — tiny flat darkened circles */
  const pebbleMat = new THREE.MeshBasicMaterial({
    color: 0x888888,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (let i = 0; i < 20; i++) {
    const { x, z } = rwp(10, 90, -0.3);
    const y = wH(x, z);
    if (y < -0.3) continue;
    const geo = new THREE.CircleGeometry(0.15 + Math.random() * 0.2, 5);
    const m = new THREE.Mesh(geo, pebbleMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.04, z);
    G.scene!.add(m);
  }
}

function buildDistantMountains(): void {
  const mountainMat = new THREE.MeshLambertMaterial({
    color: 0x556677,
    flatShading: true,
  });
  const snowMat = new THREE.MeshLambertMaterial({
    color: 0xc8d8e8,
    flatShading: true,
  });

  const ringRadius = 210;
  const count = 28;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
    const dist = ringRadius + (Math.random() - 0.5) * 40;
    const height = 25 + Math.random() * 45;
    const width = 20 + Math.random() * 25;

    /* Main mountain cone */
    const geo = new THREE.ConeGeometry(width, height, 5 + Math.floor(Math.random() * 3));
    // Slightly randomize vertices for a natural look
    const vPos = geo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < vPos.count; v++) {
      const y = vPos.getY(v);
      if (y < height * 0.45) {
        vPos.setX(v, vPos.getX(v) + (Math.random() - 0.5) * width * 0.3);
        vPos.setZ(v, vPos.getZ(v) + (Math.random() - 0.5) * width * 0.3);
      }
    }
    geo.computeVertexNormals();

    const mountain = new THREE.Mesh(geo, mountainMat);
    mountain.position.set(
      Math.cos(angle) * dist,
      height * 0.3 - 5,
      Math.sin(angle) * dist,
    );
    mountain.rotation.y = Math.random() * Math.PI;
    G.scene!.add(mountain);

    /* Snow cap on taller mountains */
    if (height > 40) {
      const capGeo = new THREE.ConeGeometry(width * 0.3, height * 0.25, 5);
      const cap = new THREE.Mesh(capGeo, snowMat);
      cap.position.set(
        mountain.position.x,
        mountain.position.y + height * 0.38,
        mountain.position.z,
      );
      G.scene!.add(cap);
    }
  }
}

export function updateTerrain(): void {
  if (!G.terrain) return;
  const mat = G.terrain.material as THREE.ShaderMaterial;
  if (mat.uniforms) {
    mat.uniforms.uTime.value = G.worldTime;
    if (G.sunLight) mat.uniforms.uLightDir.value.copy(G.sunLight.position).normalize();
  }
}
