import * as THREE from 'three';

export interface SamuraiRig {
  group: THREE.Group;
  cloakMesh: THREE.Mesh;
  leftSode: THREE.Mesh;
  rightSode: THREE.Mesh;
  dispose: () => void;
}

/**
 * Composite 12-part procedural samurai silhouette pivoted at bottom-center (y = 0 at soles).
 * Matches the lone warrior silhouette in the reference image: kabuto helmet with crescent maedate,
 * layered sode shoulder armor, lamellar cuirass & kusazuri skirt, flowing cloak, and dual daisho katanas.
 */
export function buildSamurai(contactShadowTex: THREE.Texture): SamuraiRig {
  const group = new THREE.Group();
  group.name = 'SamuraiWarrior';

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Varied PBR materials across armor, fabric, and metallic sword fittings
  const clothMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x161922,
      roughness: 0.88,
      metalness: 0.05,
    }),
  );
  const cloakMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x1b1e28,
      roughness: 0.84,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
  );
  const armorMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x1a1e26,
      roughness: 0.36,
      metalness: 0.62,
    }),
  );
  const trimBrassMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xc99c58,
      roughness: 0.24,
      metalness: 0.9,
    }),
  );
  const scabbardMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x12141a,
      roughness: 0.22,
      metalness: 0.35,
    }),
  );

  // 1. Soft radial contact shadow beneath feet
  const shadowGeo = track(new THREE.CircleGeometry(0.65, 24));
  const shadowMat = track(
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  group.add(shadowDisc);

  // 2. Boots & Armored Greaves (Suneate) - slightly planted stance
  const legGeo = track(new THREE.CylinderGeometry(0.085, 0.068, 0.48, 10));
  const bootGeo = track(new THREE.BoxGeometry(0.11, 0.08, 0.22));

  const leftLeg = new THREE.Mesh(legGeo, armorMat);
  leftLeg.position.set(-0.14, 0.26, 0.02);
  leftLeg.rotation.z = 0.05;
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, armorMat);
  rightLeg.position.set(0.14, 0.26, -0.03);
  rightLeg.rotation.z = -0.06;
  rightLeg.castShadow = true;
  group.add(rightLeg);

  const leftBoot = new THREE.Mesh(bootGeo, clothMat);
  leftBoot.position.set(-0.15, 0.04, 0.04);
  leftBoot.castShadow = true;
  group.add(leftBoot);

  const rightBoot = new THREE.Mesh(bootGeo, clothMat);
  rightBoot.position.set(0.15, 0.04, -0.01);
  rightBoot.castShadow = true;
  group.add(rightBoot);

  // 3. Hakama trousers & Kusazuri armored tasset skirt (lathe profile)
  const skirtPoints = [
    new THREE.Vector2(0.24, 0.0),
    new THREE.Vector2(0.22, 0.16),
    new THREE.Vector2(0.18, 0.36),
    new THREE.Vector2(0.16, 0.46),
  ];
  const skirtGeo = track(new THREE.LatheGeometry(skirtPoints, 14));
  const skirt = new THREE.Mesh(skirtGeo, clothMat);
  skirt.position.set(0, 0.46, 0);
  skirt.scale.set(1.05, 1, 0.84);
  skirt.castShadow = true;
  group.add(skirt);

  // Front & side kusazuri armor flaps
  const flapGeo = track(new THREE.BoxGeometry(0.22, 0.28, 0.04));
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const flap = new THREE.Mesh(flapGeo, armorMat);
    flap.position.set(Math.sin(angle) * 0.19, 0.72, Math.cos(angle) * 0.15);
    flap.rotation.y = angle;
    flap.rotation.x = -0.14;
    flap.castShadow = true;
    group.add(flap);
  }

  // 4. Torso Cuirass (Do) & Obi waist sash
  const torsoGeo = track(new THREE.CylinderGeometry(0.19, 0.165, 0.48, 12));
  const torso = new THREE.Mesh(torsoGeo, armorMat);
  torso.position.set(0, 1.12, 0);
  torso.scale.set(1.12, 1, 0.78);
  torso.castShadow = true;
  group.add(torso);

  const sashGeo = track(new THREE.TorusGeometry(0.175, 0.036, 8, 18));
  const sash = new THREE.Mesh(sashGeo, clothMat);
  sash.rotation.x = Math.PI / 2;
  sash.position.set(0, 0.91, 0);
  sash.scale.set(1.08, 0.82, 1);
  group.add(sash);

  // 5. Flowing Back Cloak / Haori (curved plane animated gently by wind)
  const cloakGeo = track(new THREE.PlaneGeometry(0.56, 0.92, 6, 10));
  cloakGeo.translate(0, -0.46, 0);
  const posAttr = cloakGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    const x = posAttr.getX(i);
    const t = Math.abs(y) / 0.92;
    // Natural outward drape
    posAttr.setX(i, x * (0.72 + t * 0.45));
    posAttr.setZ(i, t * 0.16 + Math.sin(x * 6) * 0.025 * t);
  }
  cloakGeo.computeVertexNormals();
  const cloakMesh = new THREE.Mesh(cloakGeo, cloakMat);
  cloakMesh.position.set(0, 1.32, 0.13);
  cloakMesh.rotation.x = 0.12;
  cloakMesh.castShadow = true;
  group.add(cloakMesh);

  // 6. Layered Sode Shoulder Plates
  const sodeGeo = track(new THREE.BoxGeometry(0.18, 0.24, 0.22));
  const leftSode = new THREE.Mesh(sodeGeo, armorMat);
  leftSode.position.set(-0.27, 1.26, 0);
  leftSode.rotation.z = 0.22;
  leftSode.castShadow = true;
  group.add(leftSode);

  const rightSode = new THREE.Mesh(sodeGeo, armorMat);
  rightSode.position.set(0.27, 1.26, 0);
  rightSode.rotation.z = -0.22;
  rightSode.castShadow = true;
  group.add(rightSode);

  // 7. Arms & Gauntlets (Kote) - poised sentinel posture
  const armGeo = track(new THREE.CylinderGeometry(0.058, 0.048, 0.46, 8));
  const leftArm = new THREE.Mesh(armGeo, clothMat);
  leftArm.position.set(-0.26, 1.02, -0.04);
  leftArm.rotation.z = 0.16;
  leftArm.rotation.x = 0.18;
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, clothMat);
  rightArm.position.set(0.26, 1.01, -0.02);
  rightArm.rotation.z = -0.14;
  rightArm.rotation.x = 0.1;
  rightArm.castShadow = true;
  group.add(rightArm);

  // 8. Neck Guard (Shikoro) & Head / Menpo Mask
  const headGeo = track(new THREE.SphereGeometry(0.115, 14, 12));
  const head = new THREE.Mesh(headGeo, armorMat);
  head.position.set(0, 1.5, 0);
  head.scale.set(0.92, 1.05, 0.98);
  head.castShadow = true;
  group.add(head);

  const shikoroPoints = [
    new THREE.Vector2(0.21, 0.0),
    new THREE.Vector2(0.17, 0.08),
    new THREE.Vector2(0.13, 0.16),
  ];
  const shikoroGeo = track(new THREE.LatheGeometry(shikoroPoints, 12, Math.PI * 0.22, Math.PI * 1.56));
  const shikoro = new THREE.Mesh(shikoroGeo, armorMat);
  shikoro.position.set(0, 1.38, 0.01);
  shikoro.rotation.y = Math.PI;
  shikoro.castShadow = true;
  group.add(shikoro);

  // 9. Kabuto Helmet Bowl (Hachi) with bevel visor rim
  const helmetGeo = track(new THREE.SphereGeometry(0.145, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56));
  const helmet = new THREE.Mesh(helmetGeo, armorMat);
  helmet.position.set(0, 1.53, 0);
  helmet.castShadow = true;
  group.add(helmet);

  const visorGeo = track(new THREE.TorusGeometry(0.14, 0.018, 6, 16, Math.PI * 0.85));
  const visor = new THREE.Mesh(visorGeo, trimBrassMat);
  visor.position.set(0, 1.53, -0.02);
  visor.rotation.x = Math.PI * 0.55;
  visor.rotation.z = -Math.PI * 0.925;
  group.add(visor);

  // 10. Iconic Crescent / Horn Maedate Helmet Crest
  const crestShape = new THREE.Shape();
  crestShape.moveTo(0, 0);
  crestShape.quadraticCurveTo(-0.11, 0.06, -0.15, 0.22);
  crestShape.quadraticCurveTo(-0.07, 0.11, 0, 0.055);
  crestShape.quadraticCurveTo(0.07, 0.11, 0.15, 0.22);
  crestShape.quadraticCurveTo(0.11, 0.06, 0, 0);

  const crestGeo = track(
    new THREE.ExtrudeGeometry(crestShape, {
      depth: 0.016,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 2,
    }),
  );
  const crest = new THREE.Mesh(crestGeo, trimBrassMat);
  crest.position.set(0, 1.61, -0.13);
  crest.rotation.x = -0.18;
  crest.castShadow = true;
  group.add(crest);

  // 11 & 12. Dual Daisho Swords (Katana & Wakizashi) slung diagonally at left hip
  // Curved scabbard via TubeGeometry so silhouette matches reference image's prominent diagonal swords
  const buildSword = (length: number, curveDepth: number): THREE.Group => {
    const swordGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -length * 0.28),
      new THREE.Vector3(0, curveDepth * 0.4, 0),
      new THREE.Vector3(0, curveDepth, length * 0.72),
    ]);
    const sayaGeo = track(new THREE.TubeGeometry(curve, 14, 0.02, 8, false));
    const saya = new THREE.Mesh(sayaGeo, scabbardMat);
    saya.castShadow = true;
    swordGroup.add(saya);

    // Tsuba handguard & Tsuka hilt
    const tsubaGeo = track(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 12));
    const tsuba = new THREE.Mesh(tsubaGeo, trimBrassMat);
    tsuba.rotation.x = Math.PI / 2;
    tsuba.position.set(0, -0.01, -length * 0.28);
    swordGroup.add(tsuba);

    const hiltGeo = track(new THREE.CylinderGeometry(0.018, 0.016, 0.26, 8));
    const hilt = new THREE.Mesh(hiltGeo, clothMat);
    hilt.rotation.x = Math.PI / 2;
    hilt.position.set(0, -0.02, -length * 0.28 - 0.13);
    swordGroup.add(hilt);

    return swordGroup;
  };

  const katana = buildSword(1.08, 0.055);
  katana.position.set(-0.18, 0.91, -0.02);
  katana.rotation.set(0.32, 0.36, -0.1);
  group.add(katana);

  const wakizashi = buildSword(0.76, 0.035);
  wakizashi.position.set(-0.16, 0.87, 0.04);
  wakizashi.rotation.set(0.18, 0.28, -0.14);
  group.add(wakizashi);

  return {
    group,
    cloakMesh,
    leftSode,
    rightSode,
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}
