import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { groundHeightAt } from '../environmentMath';

export interface LandscapeRig {
  group: THREE.Group;
  waterReflector: Reflector;
  updateWater: (
    time: number,
    windSpeed: number,
    rippleAmount: number,
    waterTintHex: string,
    fresnelStrength: number,
    sunColorHex: string,
    sunPosition: [number, number, number],
    sunGlow: number,
  ) => void;
  dispose: () => void;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Perturbs vertices of a geometry organically so pine tiers and tree crowns
 * never read as smooth geometric cones or spheres.
 */
function perturbGeometry(
  geo: THREE.BufferGeometry,
  radialJitter: number,
  verticalJitter: number,
  seedOffset: number,
): void {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n1 = Math.sin(x * 5.2 + y * 3.7 + seedOffset) * Math.cos(z * 4.8 - y * 2.9);
    const n2 = Math.cos(x * 8.1 - z * 6.3 + seedOffset * 1.7);
    pos.setXYZ(
      i,
      x + n1 * radialJitter,
      y + n2 * verticalJitter,
      z + n1 * radialJitter * 0.85,
    );
  }
  geo.computeVertexNormals();
}

const WaterReflectorShader = {
  name: 'WaterReflectorShader',
  uniforms: {
    color: { value: new THREE.Color(0x14151a) },
    tDiffuse: { value: null },
    textureMatrix: { value: new THREE.Matrix4() },
    uNormalMap: { value: null },
    uTime: { value: 0 },
    uRippleStrength: { value: 0.24 },
    uWindSpeed: { value: 0.78 },
    uFresnelStrength: { value: 0.9 },
    uSunColor: { value: new THREE.Color(0xffbe8a) },
    uSunDir: { value: new THREE.Vector3(0.55, 0.18, -0.81) },
    uSunGlow: { value: 0.85 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorldPos;

    #include <common>
    #include <logdepthbuf_pars_vertex>

    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
      vWorldPos = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
      #include <logdepthbuf_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform sampler2D uNormalMap;
    uniform float uTime;
    uniform float uRippleStrength;
    uniform float uWindSpeed;
    uniform float uFresnelStrength;
    uniform vec3 uSunColor;
    uniform vec3 uSunDir;
    uniform float uSunGlow;

    varying vec4 vUv;
    varying vec3 vWorldPos;

    #include <logdepthbuf_pars_fragment>

    void main() {
      #include <logdepthbuf_fragment>

      vec2 uv1 = vWorldPos.xz * 0.16 + vec2(uTime * 0.016 * (0.4 + uWindSpeed), uTime * 0.008);
      vec2 uv2 = vWorldPos.xz * 0.31 - vec2(uTime * 0.011 * (0.3 + uWindSpeed), -uTime * 0.014);
      vec3 n1 = texture2D(uNormalMap, uv1).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D(uNormalMap, uv2).xyz * 2.0 - 1.0;
      vec3 rippleNormal = normalize(vec3(
        (n1.x + n2.x) * (0.03 + uRippleStrength * 0.22),
        1.0,
        (n1.y + n2.y) * (0.03 + uRippleStrength * 0.22)
      ));

      vec4 distortedUv = vUv;
      float distortAmp = (0.003 + uRippleStrength * 0.042) * max(0.25, vUv.w * 0.15);
      distortedUv.x += rippleNormal.x * distortAmp;
      distortedUv.y += rippleNormal.z * distortAmp * 0.6;

      vec3 refl = texture2DProj(tDiffuse, distortedUv).rgb;

      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float ndotv = clamp(dot(viewDir, rippleNormal), 0.0, 1.0);
      float fresnel = mix(0.22, 0.94, pow(1.0 - ndotv, 2.0) * uFresnelStrength);

      vec3 waterCol = mix(color * 0.42, refl * 0.92, fresnel);

      vec3 halfVec = normalize(normalize(uSunDir) + viewDir);
      float spec = pow(max(dot(rippleNormal, halfVec), 0.0), 160.0) * uSunGlow * 1.25;
      waterCol += uSunColor * spec;

      gl_FragColor = vec4(waterCol, 1.0);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export function buildLandscape(
  waterNormalTex: THREE.Texture,
  barkBumpTex: THREE.Texture,
  isSoftwareGl: boolean,
  viewportWidth: number,
  viewportHeight: number,
  pixelRatio: number,
): LandscapeRig {
  const group = new THREE.Group();
  group.name = 'LakesideLandscape';
  const rand = seededRandom(7331);

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // 1. Sculpted Terrain Mesh (dark wet bank, forest hillside, craggy snow mountain)
  const terrainGeo = track(new THREE.PlaneGeometry(140, 140, 150, 150));
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(0, 0, -25);

  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeightAt(x, z);
    pos.setY(i, y);

    if (y < 0.06) {
      // Dark wet shore mud/silt
      c.setRGB(0.032, 0.034, 0.038);
    } else if (y < 0.6 && z > -8) {
      // Right foreground dark soil & moss under grass
      c.setRGB(0.048, 0.055, 0.035);
    } else if (y < 4.5) {
      // Far bank forest floor
      c.setRGB(0.065, 0.075, 0.05);
    } else if (y < 9.2) {
      // Craggy slate mountain slopes
      const rockNoise = Math.sin(x * 0.6 + z * 0.5) * 0.04;
      c.setRGB(0.22 + rockNoise, 0.21 + rockNoise, 0.23 + rockNoise);
    } else {
      // Sunlit snow-capped summit & ridges
      const snowT = Math.min(1, (y - 9.2) / 3.4);
      c.setRGB(
        0.25 + snowT * 0.72,
        0.23 + snowT * 0.68,
        0.25 + snowT * 0.64,
      );
    }

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.02,
    }),
  );

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // 2. Planar Mirror Water Surface via Reflector
  const waterGeo = track(new THREE.PlaneGeometry(135, 85));
  const texW = isSoftwareGl ? 512 : Math.min(1280, Math.floor(viewportWidth * pixelRatio * 0.75));
  const texH = isSoftwareGl ? 288 : Math.min(720, Math.floor(viewportHeight * pixelRatio * 0.75));

  const waterReflector = new Reflector(waterGeo, {
    clipBias: 0.003,
    textureWidth: Math.max(256, texW),
    textureHeight: Math.max(144, texH),
    color: 0x14151a,
    multisample: isSoftwareGl ? 0 : 2,
    shader: WaterReflectorShader,
  });
  waterReflector.rotation.x = -Math.PI / 2;
  waterReflector.position.set(0, 0, -5);

  const waterMat = waterReflector.material as THREE.ShaderMaterial;
  waterMat.uniforms.uNormalMap.value = waterNormalTex;
  group.add(waterReflector);

  // 3. Organic Multi-Tier Conifer Pines (Left forest & far-right edge, pushed back z: -15..-29)
  const pineTrunkGeo = track(new THREE.CylinderGeometry(0.08, 0.18, 3.2, 6));
  pineTrunkGeo.translate(0, 1.6, 0);
  const pineTrunkMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x1e1714,
      roughness: 0.95,
      bumpMap: barkBumpTex,
      bumpScale: 0.03,
    }),
  );

  // 4 jagged irregular foliage tiers so pines have natural ragged mountain silhouettes
  const tier1Geo = track(new THREE.ConeGeometry(0.95, 2.0, 9, 2));
  tier1Geo.translate(0, 2.8, 0);
  perturbGeometry(tier1Geo, 0.22, 0.12, 1.1);

  const tier2Geo = track(new THREE.ConeGeometry(0.82, 1.9, 9, 2));
  tier2Geo.translate(0.06, 3.9, -0.04);
  perturbGeometry(tier2Geo, 0.19, 0.11, 2.4);

  const tier3Geo = track(new THREE.ConeGeometry(0.64, 1.7, 9, 2));
  tier3Geo.translate(-0.04, 4.95, 0.04);
  perturbGeometry(tier3Geo, 0.16, 0.1, 3.7);

  const tier4Geo = track(new THREE.ConeGeometry(0.42, 1.4, 8, 2));
  tier4Geo.translate(0.02, 5.85, 0);
  perturbGeometry(tier4Geo, 0.11, 0.08, 5.2);

  const pineNeedleMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.02,
    }),
  );

  const pinePositions: { x: number; z: number; scale: number; rot: number }[] = [];
  // Left & Center-Left pines (kept slightly shorter on far-left so snow mountain peak rises clearly above)
  for (let i = 0; i < 68; i++) {
    const x = -28 + rand() * 30.5;
    const z = -15.5 - rand() * 13.5;
    const mountainWindow = x < -14 ? 0.65 + rand() * 0.35 : 0.8 + rand() * 0.55;
    pinePositions.push({
      x,
      z,
      scale: mountainWindow,
      rot: rand() * Math.PI * 2,
    });
  }
  // Far-right sentinel pines
  for (let i = 0; i < 22; i++) {
    const x = 11.0 + rand() * 16.5;
    const z = -14.5 - rand() * 14.0;
    pinePositions.push({
      x,
      z,
      scale: 0.78 + rand() * 0.55,
      rot: rand() * Math.PI * 2,
    });
  }

  const pineCount = pinePositions.length;
  const pineTrunks = new THREE.InstancedMesh(pineTrunkGeo, pineTrunkMat, pineCount);
  const pineTier1 = new THREE.InstancedMesh(tier1Geo, pineNeedleMat, pineCount);
  const pineTier2 = new THREE.InstancedMesh(tier2Geo, pineNeedleMat, pineCount);
  const pineTier3 = new THREE.InstancedMesh(tier3Geo, pineNeedleMat, pineCount);
  const pineTier4 = new THREE.InstancedMesh(tier4Geo, pineNeedleMat, pineCount);

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  for (let i = 0; i < pineCount; i++) {
    const p = pinePositions[i];
    const y = groundHeightAt(p.x, p.z) - 0.12;
    dummy.position.set(p.x, y, p.z);
    dummy.rotation.set(0, p.rot, (rand() - 0.5) * 0.04);
    dummy.scale.set(p.scale * 0.9, p.scale * (0.95 + rand() * 0.25), p.scale * 0.9);
    dummy.updateMatrix();

    pineTrunks.setMatrixAt(i, dummy.matrix);
    pineTier1.setMatrixAt(i, dummy.matrix);
    pineTier2.setMatrixAt(i, dummy.matrix);
    pineTier3.setMatrixAt(i, dummy.matrix);
    pineTier4.setMatrixAt(i, dummy.matrix);

    const shade = 0.7 + rand() * 0.55;
    tint.setRGB(0.06 * shade, 0.15 * shade, 0.08 * shade);
    pineTier1.setColorAt(i, tint);
    pineTier2.setColorAt(i, tint.clone().multiplyScalar(1.06));
    pineTier3.setColorAt(i, tint.clone().multiplyScalar(1.12));
    pineTier4.setColorAt(i, tint.clone().multiplyScalar(1.18));
  }
  [pineTrunks, pineTier1, pineTier2, pineTier3, pineTier4].forEach((m) => {
    m.castShadow = true;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    group.add(m);
  });

  // 4. Warm Autumn Deciduous Grove (pushed back z: -17..-28 with irregular multi-lobe crowns)
  const decTrunkGeo = track(new THREE.CylinderGeometry(0.06, 0.13, 2.5, 6));
  decTrunkGeo.translate(0, 1.25, 0);

  const crownGeoA = track(new THREE.IcosahedronGeometry(0.72, 1));
  crownGeoA.translate(-0.22, 2.75, 0.1);
  perturbGeometry(crownGeoA, 0.24, 0.18, 6.2);

  const crownGeoB = track(new THREE.IcosahedronGeometry(0.65, 1));
  crownGeoB.translate(0.32, 3.1, -0.15);
  perturbGeometry(crownGeoB, 0.22, 0.18, 8.9);

  const crownGeoC = track(new THREE.IcosahedronGeometry(0.54, 1));
  crownGeoC.translate(0.05, 3.55, 0.12);
  perturbGeometry(crownGeoC, 0.18, 0.16, 11.3);

  const decLeafMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );

  const decPositions: { x: number; z: number; scale: number }[] = [];
  for (let i = 0; i < 54; i++) {
    // Spread across center & right-center far bank, avoiding blocking directly behind samurai silhouette
    const x = -3.0 + rand() * 21.0;
    const z = -17.0 - rand() * 12.5;
    decPositions.push({
      x,
      z,
      scale: 0.72 + rand() * 0.52,
    });
  }

  const decCount = decPositions.length;
  const decTrunks = new THREE.InstancedMesh(decTrunkGeo, pineTrunkMat, decCount);
  const decCrownA = new THREE.InstancedMesh(crownGeoA, decLeafMat, decCount);
  const decCrownB = new THREE.InstancedMesh(crownGeoB, decLeafMat, decCount);
  const decCrownC = new THREE.InstancedMesh(crownGeoC, decLeafMat, decCount);

  for (let i = 0; i < decCount; i++) {
    const d = decPositions[i];
    const y = groundHeightAt(d.x, d.z) - 0.12;
    dummy.position.set(d.x, y, d.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(d.scale);
    dummy.updateMatrix();

    decTrunks.setMatrixAt(i, dummy.matrix);
    decCrownA.setMatrixAt(i, dummy.matrix);
    decCrownB.setMatrixAt(i, dummy.matrix);
    decCrownC.setMatrixAt(i, dummy.matrix);

    const roll = rand();
    if (roll < 0.42) {
      tint.setRGB(0.56, 0.25, 0.14); // warm burnt russet
    } else if (roll < 0.78) {
      tint.setRGB(0.64, 0.34, 0.18); // sunset copper-amber
    } else {
      tint.setRGB(0.36, 0.19, 0.13); // deep umber foliage
    }
    decCrownA.setColorAt(i, tint);
    decCrownB.setColorAt(i, tint.clone().multiplyScalar(1.12));
    decCrownC.setColorAt(i, tint.clone().multiplyScalar(1.2));
  }
  [decTrunks, decCrownA, decCrownB, decCrownC].forEach((m) => {
    m.castShadow = true;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    group.add(m);
  });

  // 5. Wet Shoreline Stones & Samurai Sandbar Rocks
  const rockGeo = track(new THREE.DodecahedronGeometry(0.4, 1));
  perturbGeometry(rockGeo, 0.08, 0.05, 14.5);
  const rockMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x1a1c21,
      roughness: 0.58,
      metalness: 0.1,
    }),
  );
  const rockCount = 24;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocks.castShadow = true;
  rocks.receiveShadow = true;

  for (let i = 0; i < rockCount; i++) {
    const isNearSamurai = i < 4;
    const x = isNearSamurai ? 0.15 + rand() * 1.3 : 2.35 + rand() * 4.2;
    const z = isNearSamurai ? -3.7 + rand() * 1.1 : -3.5 + rand() * 10.0;
    const y = groundHeightAt(x, z) - 0.1;
    dummy.position.set(x, y, z);
    dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    dummy.scale.set(0.4 + rand() * 0.7, 0.18 + rand() * 0.24, 0.4 + rand() * 0.65);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.computeBoundingSphere();
  group.add(rocks);

  return {
    group,
    waterReflector,
    updateWater: (
      time,
      windSpeed,
      rippleAmount,
      waterTintHex,
      fresnelStrength,
      sunColorHex,
      sunPosition,
      sunGlow,
    ) => {
      waterMat.uniforms.uTime.value = time;
      waterMat.uniforms.uWindSpeed.value = windSpeed;
      waterMat.uniforms.uRippleStrength.value = rippleAmount;
      waterMat.uniforms.color.value.set(waterTintHex);
      waterMat.uniforms.uFresnelStrength.value = fresnelStrength;
      waterMat.uniforms.uSunColor.value.set(sunColorHex);
      waterMat.uniforms.uSunDir.value
        .set(sunPosition[0], sunPosition[1], sunPosition[2])
        .normalize();
      waterMat.uniforms.uSunGlow.value = sunGlow;
    },
    dispose: () => {
      waterReflector.dispose();
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}
