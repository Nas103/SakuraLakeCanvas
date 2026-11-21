import * as THREE from 'three';
import { groundHeightAt } from '../environmentMath';

export interface SakuraTreeRig {
  group: THREE.Group;
  blossomMaterial: THREE.MeshStandardMaterial;
  setWindAndLight: (time: number, windSpeed: number, glowAmount: number) => void;
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

function buildTaperedBranchGeometry(
  points: THREE.Vector3[],
  radiusStart: number,
  radiusEnd: number,
  tubularSegments = 18,
  radialSegments = 8,
): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radiusStart, radialSegments, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const center = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, center);
    const scale = (radiusStart * (1 - t) + radiusEnd * t) / Math.max(0.001, radiusStart);
    for (let j = 0; j <= radialSegments; j++) {
      const idx = i * (radialSegments + 1) + j;
      if (idx < pos.count) {
        v.fromBufferAttribute(pos, idx);
        v.sub(center).multiplyScalar(scale).add(center);
        pos.setXYZ(idx, v.x, v.y, v.z);
      }
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Overhanging gnarled white sakura tree anchored on the right bank.
 * Designed so dark winding branches remain clearly visible through delicate clusters
 * of crisp white 5-petal blossoms against the twilight sky.
 */
export function buildSakuraTree(
  barkBumpTex: THREE.Texture,
  blossomTex: THREE.Texture,
): SakuraTreeRig {
  const group = new THREE.Group();
  group.name = 'OverhangingSakuraTree';
  const rand = seededRandom(4219);

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const barkMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x191313,
      roughness: 0.92,
      metalness: 0.04,
      bumpMap: barkBumpTex,
      bumpScale: 0.045,
    }),
  );

  // Root trunk anchored on right shoreline bank
  const rootX = 6.65;
  const rootZ = 1.9;
  const rootY = groundHeightAt(rootX, rootZ) - 0.15;
  group.position.set(rootX, rootY, rootZ);

  // Gnarled limbs reaching across upper-right quadrant with open sky breathing gaps
  const branchSpecs: { pts: THREE.Vector3[]; r0: number; r1: number; segs: number; bloomStart: number }[] = [
    // Primary trunk curving up and sweeping left
    {
      pts: [
        new THREE.Vector3(0.2, 0.0, 0.25),
        new THREE.Vector3(-0.35, 1.45, 0.15),
        new THREE.Vector3(-1.25, 2.75, 0.0),
        new THREE.Vector3(-2.75, 3.42, -0.15),
        new THREE.Vector3(-4.45, 3.65, -0.35),
      ],
      r0: 0.3,
      r1: 0.055,
      segs: 22,
      bloomStart: 0.55,
    },
    // Upper canopy limb arching across top-right frame
    {
      pts: [
        new THREE.Vector3(-1.35, 2.75, 0.0),
        new THREE.Vector3(-2.55, 3.72, 0.2),
        new THREE.Vector3(-4.1, 4.18, 0.12),
        new THREE.Vector3(-5.55, 3.92, -0.18),
      ],
      r0: 0.11,
      r1: 0.022,
      segs: 18,
      bloomStart: 0.35,
    },
    // Lower graceful limb dipping slightly over the right lake
    {
      pts: [
        new THREE.Vector3(-1.85, 2.98, -0.04),
        new THREE.Vector3(-2.85, 2.86, 0.28),
        new THREE.Vector3(-4.05, 2.72, 0.35),
        new THREE.Vector3(-5.15, 2.84, 0.18),
      ],
      r0: 0.095,
      r1: 0.018,
      segs: 16,
      bloomStart: 0.32,
    },
    // Right upper crown bough
    {
      pts: [
        new THREE.Vector3(-0.7, 2.25, 0.05),
        new THREE.Vector3(-1.25, 3.35, 0.35),
        new THREE.Vector3(-2.25, 4.05, 0.52),
      ],
      r0: 0.1,
      r1: 0.02,
      segs: 14,
      bloomStart: 0.35,
    },
    // Secondary delicate forks
    {
      pts: [
        new THREE.Vector3(-3.3, 3.55, -0.22),
        new THREE.Vector3(-4.05, 3.28, -0.58),
        new THREE.Vector3(-4.85, 3.08, -0.78),
      ],
      r0: 0.048,
      r1: 0.012,
      segs: 10,
      bloomStart: 0.2,
    },
    {
      pts: [
        new THREE.Vector3(-3.75, 4.04, 0.14),
        new THREE.Vector3(-4.5, 4.35, -0.12),
        new THREE.Vector3(-5.25, 4.22, -0.35),
      ],
      r0: 0.042,
      r1: 0.011,
      segs: 10,
      bloomStart: 0.2,
    },
    {
      pts: [
        new THREE.Vector3(-3.05, 2.84, 0.3),
        new THREE.Vector3(-3.5, 2.42, 0.62),
        new THREE.Vector3(-4.15, 2.26, 0.72),
      ],
      r0: 0.042,
      r1: 0.011,
      segs: 10,
      bloomStart: 0.2,
    },
    {
      pts: [
        new THREE.Vector3(-4.35, 3.62, -0.34),
        new THREE.Vector3(-5.2, 3.48, -0.52),
        new THREE.Vector3(-5.95, 3.22, -0.44),
      ],
      r0: 0.045,
      r1: 0.011,
      segs: 10,
      bloomStart: 0.2,
    },
    {
      pts: [
        new THREE.Vector3(-1.95, 3.45, 0.16),
        new THREE.Vector3(-2.65, 3.15, -0.35),
        new THREE.Vector3(-3.45, 3.02, -0.55),
      ],
      r0: 0.044,
      r1: 0.012,
      segs: 10,
      bloomStart: 0.25,
    },
  ];

  const blossomAnchors: THREE.Vector3[] = [];
  const branchGroup = new THREE.Group();
  group.add(branchGroup);

  for (const spec of branchSpecs) {
    const geo = track(buildTaperedBranchGeometry(spec.pts, spec.r0, spec.r1, spec.segs, 7));
    const mesh = new THREE.Mesh(geo, barkMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    branchGroup.add(mesh);

    const curve = new THREE.CatmullRomCurve3(spec.pts);
    for (let i = 0; i < spec.segs; i++) {
      const t = spec.bloomStart + (i / spec.segs) * (1 - spec.bloomStart);
      blossomAnchors.push(curve.getPointAt(Math.min(1, t)));
    }
  }

  // Subtle compact flower buds (keep small so branches stay clearly visible)
  const budGeo = track(new THREE.IcosahedronGeometry(0.055, 1));
  const blossomMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xf7f2ee,
      emissive: 0xffd5c2,
      emissiveIntensity: 0.08,
      roughness: 0.82,
      metalness: 0.0,
    }),
  );

  blossomMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: 0.7 };
    blossomMaterial.userData.shader = shader;
    shader.vertexShader =
      `uniform float uTime;\nuniform float uWind;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 instPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = sin(uTime * (1.4 + uWind * 0.8) + instPos.x * 1.9 + instPos.z * 1.5) * 0.035 * uWind;
        transformed.x += sway;
        transformed.y += cos(uTime * 1.1 + instPos.y * 2.2) * 0.02 * uWind;
      #endif
      `,
    );
  };

  // Delicate 5-petal white sakura cards clustered tightly along twigs
  const petalCardGeo = track(new THREE.PlaneGeometry(0.22, 0.22));
  const petalCardMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfff8f5,
      emissive: 0xffd6c2,
      emissiveIntensity: 0.14,
      roughness: 0.74,
      metalness: 0.0,
      map: blossomTex,
      transparent: true,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
    }),
  );

  petalCardMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: 0.7 };
    petalCardMat.userData.shader = shader;
    shader.vertexShader =
      `uniform float uTime;\nuniform float uWind;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 instPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = sin(uTime * (1.8 + uWind) + instPos.x * 2.4 + instPos.y * 1.6) * 0.045 * uWind;
        transformed.x += sway;
        transformed.z += sway * 0.5;
      #endif
      `,
    );
  };

  const budCount = 320;
  const cardCount = 920;

  const budMesh = new THREE.InstancedMesh(budGeo, blossomMaterial, budCount);
  const cardMesh = new THREE.InstancedMesh(petalCardGeo, petalCardMat, cardCount);
  budMesh.castShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < budCount; i++) {
    const anchor = blossomAnchors[Math.floor(rand() * blossomAnchors.length)];
    dummy.position.set(
      anchor.x + (rand() - 0.5) * 0.42,
      anchor.y + (rand() - 0.35) * 0.28,
      anchor.z + (rand() - 0.5) * 0.42,
    );
    dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    dummy.scale.setScalar(0.7 + rand() * 0.75);
    dummy.updateMatrix();
    budMesh.setMatrixAt(i, dummy.matrix);

    const depthShade = 0.82 + rand() * 0.18;
    color.setRGB(depthShade, depthShade * 0.97, depthShade * 0.96);
    budMesh.setColorAt(i, color);
  }
  budMesh.instanceMatrix.needsUpdate = true;
  if (budMesh.instanceColor) budMesh.instanceColor.needsUpdate = true;
  budMesh.computeBoundingSphere();

  for (let i = 0; i < cardCount; i++) {
    const anchor = blossomAnchors[Math.floor(rand() * blossomAnchors.length)];
    dummy.position.set(
      anchor.x + (rand() - 0.5) * 0.55,
      anchor.y + (rand() - 0.35) * 0.36,
      anchor.z + (rand() - 0.5) * 0.55,
    );
    dummy.rotation.set(
      (rand() - 0.5) * 1.6,
      (rand() - 0.5) * Math.PI,
      (rand() - 0.5) * 1.6,
    );
    dummy.scale.setScalar(0.62 + rand() * 0.85);
    dummy.updateMatrix();
    cardMesh.setMatrixAt(i, dummy.matrix);

    const shade = 0.84 + rand() * 0.16;
    color.setRGB(shade, shade * 0.98, shade * 0.97);
    cardMesh.setColorAt(i, color);
  }
  cardMesh.instanceMatrix.needsUpdate = true;
  if (cardMesh.instanceColor) cardMesh.instanceColor.needsUpdate = true;
  cardMesh.computeBoundingSphere();

  branchGroup.add(budMesh);
  branchGroup.add(cardMesh);

  return {
    group,
    blossomMaterial,
    setWindAndLight: (time: number, windSpeed: number, glowAmount: number) => {
      branchGroup.rotation.z = Math.sin(time * 0.65) * 0.008 * windSpeed;
      branchGroup.rotation.x = Math.cos(time * 0.52) * 0.005 * windSpeed;

      if (blossomMaterial.userData.shader) {
        blossomMaterial.userData.shader.uniforms.uTime.value = time;
        blossomMaterial.userData.shader.uniforms.uWind.value = windSpeed;
      }
      if (petalCardMat.userData.shader) {
        petalCardMat.userData.shader.uniforms.uTime.value = time;
        petalCardMat.userData.shader.uniforms.uWind.value = windSpeed;
      }

      blossomMaterial.emissiveIntensity = 0.04 + glowAmount * 0.08;
      petalCardMat.emissiveIntensity = 0.06 + glowAmount * 0.14;
    },
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}
