import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkMesh, rwp, rnd, mkCelMat } from '../core/Helpers';
import { registerLOD } from '../systems/LOD';

/* Tree foliage shader with wind animation */
const treeVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWindPhase;

  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 pos = position;

    /* Wind sway — stronger at the top */
    float height = pos.y;
    float sway = sin(uTime * 2.0 + uWindPhase + pos.x * 0.5) * 0.15 * height;
    float sway2 = cos(uTime * 1.4 + uWindPhase * 0.7 + pos.z * 0.3) * 0.08 * height;
    pos.x += sway;
    pos.z += sway2;

    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const treeFragmentShader = /* glsl */ `
  uniform vec3 uColor;

  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 lightDir = normalize(vec3(1.0, 1.5, 0.5));
    float NdotL = dot(vNormal, lightDir);

    /* 3-step cel shading */
    float shade;
    if (NdotL > 0.4) shade = 1.0;
    else if (NdotL > -0.1) shade = 0.75;
    else shade = 0.55;

    vec3 col = uColor * shade;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const trunkFragmentShader = /* glsl */ `
  uniform vec3 uColor;

  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 lightDir = normalize(vec3(1.0, 1.5, 0.5));
    float NdotL = dot(vNormal, lightDir);
    float shade = NdotL > 0.2 ? 1.0 : 0.7;

    vec3 col = uColor * shade;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* Store references for wind update */
const treeMaterials: THREE.ShaderMaterial[] = [];

export function populateTrees(count: number): void {
  /* Shared geometries */
  const trunkGeo = new THREE.CylinderGeometry(0.42, 0.65, 4.8, 7);

  /* Leaf cluster geometries — icospheres for rounder, more organic look */
  const clusterGeos = [
    new THREE.IcosahedronGeometry(2.2, 1),
    new THREE.IcosahedronGeometry(1.8, 1),
    new THREE.IcosahedronGeometry(1.4, 1),
  ];

  const leafColors = [
    new THREE.Color(0.37, 0.60, 0.29),
    new THREE.Color(0.42, 0.65, 0.32),
    new THREE.Color(0.32, 0.55, 0.26),
    new THREE.Color(0.38, 0.58, 0.24),
  ];

  /* Cluster placement offsets — multiple blobs instead of stacked cones */
  const clusterLayouts = [
    /* Layout A: wide canopy */
    [{ x: 0, y: 6.0, z: 0, s: 1.0 }, { x: 1.4, y: 5.4, z: 0.8, s: 0.7 }, { x: -1.2, y: 5.8, z: -0.6, s: 0.75 },
     { x: 0.3, y: 7.2, z: -0.4, s: 0.65 }, { x: -0.5, y: 7.5, z: 0.5, s: 0.5 }],
    /* Layout B: tall narrow */
    [{ x: 0, y: 5.5, z: 0, s: 0.9 }, { x: 0.4, y: 6.8, z: 0.3, s: 0.85 },
     { x: -0.3, y: 8.0, z: -0.2, s: 0.7 }, { x: 0.1, y: 9.0, z: 0, s: 0.5 }],
    /* Layout C: bushy */
    [{ x: 0, y: 5.8, z: 0, s: 1.1 }, { x: 1.6, y: 5.2, z: 1.0, s: 0.65 }, { x: -1.5, y: 5.5, z: 0.9, s: 0.7 },
     { x: 1.0, y: 5.0, z: -1.3, s: 0.6 }, { x: -0.8, y: 5.3, z: -1.1, s: 0.65 }, { x: 0, y: 7.0, z: 0, s: 0.8 }],
  ];

  for (let i = 0; i < count; i++) {
    const { x, y, z } = rwp(18, 118);
    const t = new THREE.Group();
    const sc = 0.75 + Math.random() * 0.65;
    const windPhase = Math.random() * Math.PI * 2;

    /* Trunk */
    const trunkMat = new THREE.ShaderMaterial({
      vertexShader: treeVertexShader,
      fragmentShader: trunkFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWindPhase: { value: windPhase },
        uColor: { value: new THREE.Color(0.42, 0.26, 0.15) },
      },
    });
    treeMaterials.push(trunkMat);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(0, 2.4, 0);
    trunk.castShadow = true;
    t.add(trunk);

    /* Leaf clusters — pick a random layout */
    const layout = clusterLayouts[i % clusterLayouts.length];
    const leafColor = leafColors[Math.floor(Math.random() * leafColors.length)];
    for (let j = 0; j < layout.length; j++) {
      const cl = layout[j];
      const geoIdx = j % clusterGeos.length;
      const foliageMat = new THREE.ShaderMaterial({
        vertexShader: treeVertexShader,
        fragmentShader: treeFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uWindPhase: { value: windPhase + j * 0.4 },
          uColor: { value: leafColor.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.08) },
        },
      });
      treeMaterials.push(foliageMat);
      const foliage = new THREE.Mesh(clusterGeos[geoIdx], foliageMat);
      foliage.position.set(cl.x, cl.y, cl.z);
      foliage.scale.setScalar(cl.s);
      /* Randomize rotation for organic variation */
      foliage.rotation.set(rnd(0, 0.4), rnd(0, Math.PI * 2), rnd(0, 0.3));
      foliage.castShadow = true;
      t.add(foliage);
    }

    t.position.set(x, y, z);
    t.scale.setScalar(sc);
    G.scene!.add(t);
    G.entities.trees.push({ x, z, radius: 1.25 * sc });
    registerLOD(t);
  }
}

export function updateTrees(): void {
  const t = G.worldTime;
  for (const mat of treeMaterials) {
    mat.uniforms.uTime.value = t;
  }
}

export function populateRocks(count: number): void {
  const rockMats = [
    mkCelMat(0x888880, 0x7a7a72, 0.3),   // gray with moss
    mkCelMat(0x8a8278, 0x7a726a, 0.2),    // warm gray
    mkCelMat(0x787878, 0x686868, 0.15),   // cool gray
  ];
  const geos = [
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.DodecahedronGeometry(1, 1), // smoother variant
  ];
  for (let i = 0; i < count; i++) {
    const { x, y, z } = rwp(10, 120);
    const sc = 0.4 + Math.random() * 1.2;
    const mat = rockMats[i % rockMats.length];
    const geo = geos[Math.random() < 0.7 ? 0 : 1];
    const r = mkMesh(geo, mat, x, y + sc * 0.3, z);
    r.rotation.set(rnd(0, Math.PI), rnd(0, Math.PI), 0);
    r.scale.set(sc * (0.8 + Math.random() * 0.4), sc * (0.6 + Math.random() * 0.4), sc * (0.8 + Math.random() * 0.4));
    r.castShadow = true;
    G.scene!.add(r);
    registerLOD(r);
  }
}

export function populateFlowers(count: number): void {
  const cols = [0xff7799, 0xffdd44, 0xff66aa, 0xaaddff, 0xffbb55];
  const stemMat = mkCelMat(0x44882a, 0x3a7622, 0);
  for (let i = 0; i < count; i++) {
    const { x, y, z } = rwp(10, 115, 0);
    const fl = new THREE.Group();
    fl.add(mkMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 4), stemMat, 0, 0.3, 0));
    const petalMat = mkCelMat(cols[i % cols.length], cols[(i + 1) % cols.length], 0);
    fl.add(mkMesh(new THREE.SphereGeometry(0.2, 6, 6), petalMat, 0, 0.65, 0));
    fl.position.set(x, y, z);
    G.scene!.add(fl);
    registerLOD(fl);
  }
}
