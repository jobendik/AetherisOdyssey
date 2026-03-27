import * as THREE from 'three';
import { G } from './GameState';

export function setupLighting(): void {
  G.scene!.add(new THREE.AmbientLight(0xffffff, 0.42));

  const sun = new THREE.DirectionalLight(0xfff4e1, 1.25);
  sun.position.set(110, 150, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 360;
  const d = 110;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  G.scene!.add(sun);
  G.sunLight = sun;

  G.scene!.add(new THREE.HemisphereLight(0x8dd9ff, 0x3e6842, 0.45));
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

  (G.scene!.background as THREE.Color).copy(sc);
  G.scene!.fog!.color.copy(sc);

  const isN = t > 0.5;
  G.sunLight!.intensity = isN
    ? Math.max(0.15, 1 - Math.min(1, (t - 0.5) * 4) * 0.85)
    : 1.25;
  G.sunLight!.color.set(
    isN ? 0x8899cc : t > 0.2 && t < 0.4 ? 0xffaa66 : 0xfff4e1,
  );
}
