import * as THREE from 'three';
import { groundHeightAt } from '../environmentMath';
import type { AtmosphereState, WeatherParameters } from '../types';

export interface AtmosphereRig {
  group: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    atmo: AtmosphereState,
    weather: WeatherParameters,
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

interface PetalState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  scale: number;
  phase: number;
}

interface FireflyState {
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  speed: number;
  amp: number;
}

interface WindStreakState {
  x: number;
  y: number;
  z: number;
  speed: number;
  len: number;
}

const _dummy = new THREE.Object3D();
const _sunDir = new THREE.Vector3();

export function buildAtmosphere(
  blossomTex: THREE.Texture,
  glowSpriteTex: THREE.Texture,
): AtmosphereRig {
  const group = new THREE.Group();
  group.name = 'AtmosphereAndFoliage';
  const rand = seededRandom(9001);

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // =========================================================================
  // 1. Gradient Sky Dome + Asymmetric Sunset Glow + Crisp Pinpoint Evening Star
  // =========================================================================
  const skyGeo = track(new THREE.SphereGeometry(155, 36, 24));
  const skyMat = track(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color('#141926') },
        uHorizonLeft: { value: new THREE.Color('#2d3142') },
        uHorizonRight: { value: new THREE.Color('#e89876') },
        uSunDir: { value: new THREE.Vector3(0.56, 0.16, -0.81).normalize() },
        uSunColor: { value: new THREE.Color('#ffbe8a') },
        uSunIntensity: { value: 2.65 },
        uMoonIntensity: { value: 0.0 },
        uStarOpacity: { value: 0.85 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith;
        uniform vec3 uHorizonLeft;
        uniform vec3 uHorizonRight;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uSunIntensity;
        uniform float uMoonIntensity;
        uniform float uStarOpacity;
        uniform float uTime;

        varying vec3 vWorldDir;

        float hash31(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);

          float rightBias = smoothstep(-0.2, 0.65, dir.x);
          vec3 horizonCol = mix(uHorizonLeft, uHorizonRight, rightBias);

          float horizonBand = pow(1.0 - h, 2.45);
          vec3 sky = mix(uZenith, horizonCol, horizonBand);

          // Soft rose-peach horizon clouds on right side
          float cloudBand = exp(-pow((dir.y - 0.11) * 7.5, 2.0)) * rightBias;
          float cloudWave = sin(dir.x * 8.5 + dir.y * 16.0 + uTime * 0.04) * 0.5 + 0.5;
          sky += uSunColor * cloudBand * (0.1 + cloudWave * 0.1) * clamp(uSunIntensity * 0.4, 0.0, 1.0);

          // Sun halo & soft low disc
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          float sunHalo = pow(sunDot, 7.5) * 0.36 * clamp(uSunIntensity * 0.42, 0.0, 1.0);
          float sunDisc = smoothstep(0.997, 0.9994, sunDot) * clamp(uSunIntensity * 0.6, 0.0, 1.3);
          sky += uSunColor * (sunHalo + sunDisc);

          // Night moon (only visible at night, off during twilight)
          if (uMoonIntensity > 0.02) {
            vec3 moonDir = normalize(vec3(-0.32, 0.44, -0.82));
            float moonDot = max(dot(dir, moonDir), 0.0);
            float moonDisc = smoothstep(0.9985, 0.9995, moonDot) * uMoonIntensity * 1.1;
            float moonHalo = pow(moonDot, 40.0) * uMoonIntensity * 0.25;
            sky += vec3(0.78, 0.86, 1.0) * (moonDisc + moonHalo);
          }

          // Subtle faint starfield + single crisp pinpoint Evening Star (like reference image)
          if (uStarOpacity > 0.01 && dir.y > 0.08) {
            vec3 grid = floor(dir * 220.0);
            float rnd = hash31(grid);
            if (rnd > 0.9965) {
              vec3 cellCenter = normalize(grid + 0.5);
              float dist = length(dir - cellCenter) * 220.0;
              float twinkle = 0.75 + 0.25 * sin(uTime * 1.6 + rnd * 80.0);
              float star = smoothstep(0.24, 0.02, dist) * twinkle * smoothstep(0.1, 0.4, dir.y);
              sky += vec3(0.92, 0.95, 1.0) * star * uStarOpacity * 0.55;
            }

            // Crisp pinpoint evening star high center-left
            vec3 heroStarDir = normalize(vec3(-0.04, 0.35, -0.935));
            float heroDot = max(dot(dir, heroStarDir), 0.0);
            float heroCore = smoothstep(0.999995, 0.9999995, heroDot) * 2.0;
            float heroPinGlow = pow(heroDot, 140000.0) * 0.45;
            sky += vec3(1.0, 0.97, 0.92) * (heroCore + heroPinGlow) * clamp(uStarOpacity * 1.15, 0.0, 1.2);
          }

          gl_FragColor = vec4(sky, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.frustumCulled = false;
  group.add(skyMesh);

  // =========================================================================
  // 2. Low Arched Golden-Green Shore Grass on Right Bank (2,400 tapered blades)
  // =========================================================================
  const bladeSegments = 5;
  const bladeGeo = track(new THREE.PlaneGeometry(0.048, 0.72, 1, bladeSegments));
  bladeGeo.translate(0, 0.36, 0);
  const bPos = bladeGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const yNorm = Math.max(0, Math.min(1, bPos.getY(i) / 0.72));
    const taper = 1.0 - Math.pow(yNorm, 1.25);
    bPos.setX(i, bPos.getX(i) * taper);
    bPos.setZ(i, yNorm * yNorm * 0.22); // graceful arching curve
  }
  bladeGeo.computeVertexNormals();

  const grassMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.65,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
  );

  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: 0.78 };
    shader.uniforms.uGust = { value: 0.42 };
    shader.uniforms.uBacklight = { value: new THREE.Color('#ffc478') };
    shader.uniforms.uBacklightStrength = { value: 0.9 };
    grassMat.userData.shader = shader;

    shader.vertexShader =
      `
      uniform float uTime;
      uniform float uWind;
      uniform float uGust;
      varying float vBladeY;
      ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vBladeY = clamp(position.y / 0.72, 0.0, 1.0);
      #ifdef USE_INSTANCING
        vec3 instOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float waveA = sin(uTime * (1.8 + uWind * 1.4) + instOrigin.x * 0.9 + instOrigin.z * 0.7);
        float waveB = cos(uTime * (3.1 + uWind * 2.1) - instOrigin.x * 1.7 + instOrigin.z * 1.2);
        float gustWave = sin(uTime * 0.75 + instOrigin.x * 0.4 - instOrigin.z * 0.3) * 0.5 + 0.5;
        float bend = (waveA * 0.13 + waveB * 0.055 + gustWave * uGust * 0.2) * (0.15 + uWind * 0.85);
        float flex = vBladeY * vBladeY;
        transformed.x -= bend * flex * 0.85;
        transformed.z += bend * flex * 0.4;
        transformed.y -= abs(bend) * flex * 0.12;
      #endif
      `,
    );

    shader.fragmentShader =
      `
      uniform vec3 uBacklight;
      uniform float uBacklightStrength;
      varying float vBladeY;
      ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      // Rich dark olive-moss root transitioning to warm sunlit golden tips
      diffuseColor.rgb = mix(diffuseColor.rgb * 0.42, diffuseColor.rgb * 1.25, pow(vBladeY, 0.85));
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `
      #include <emissivemap_fragment>
      totalEmissiveRadiance += uBacklight * pow(vBladeY, 1.55) * uBacklightStrength * 0.42;
      `,
    );
  };

  const grassCount = 2400;
  const grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, grassCount);
  grassMesh.castShadow = false;
  grassMesh.receiveShadow = true;

  const bladeColor = new THREE.Color();
  for (let i = 0; i < grassCount; i++) {
    // Cluster strictly along the low curved right foreground shoreline
    const z = -2.0 + rand() * 9.0;
    const shoreEdge = 2.65 - z * 0.06 + Math.sin(z * 0.45) * 0.28;
    const depth = Math.pow(rand(), 0.75) * 4.4;
    const x = shoreEdge + 0.12 + depth;

    const y = Math.max(0.02, groundHeightAt(x, z)) - 0.02;
    _dummy.position.set(x, y, z);
    _dummy.rotation.set(
      (rand() - 0.5) * 0.28,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 0.28,
    );
    const heightScale = 0.52 + rand() * 0.58;
    _dummy.scale.set(0.85 + rand() * 0.45, heightScale, 1.0);
    _dummy.updateMatrix();
    grassMesh.setMatrixAt(i, _dummy.matrix);

    const warmMix = rand();
    bladeColor.setRGB(
      0.34 + warmMix * 0.4,
      0.36 + warmMix * 0.26,
      0.1 + warmMix * 0.06,
    );
    grassMesh.setColorAt(i, bladeColor);
  }
  grassMesh.instanceMatrix.needsUpdate = true;
  if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  grassMesh.computeBoundingSphere();
  group.add(grassMesh);

  // =========================================================================
  // 3. Low-Lying Lake Mist Ribbon Behind Samurai & Warm Right-Shore Haze
  // =========================================================================
  const mistGroup = new THREE.Group();
  const mistMat = track(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uMistOpacity: { value: 0.68 },
        uCoolColor: { value: new THREE.Color('#dce6f5') },
        uWarmColor: { value: new THREE.Color('#ffcf9e') },
        uMap: { value: glowSpriteTex },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uMistOpacity;
        uniform vec3 uCoolColor;
        uniform vec3 uWarmColor;
        uniform sampler2D uMap;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          float drift = sin(vUv.x * 7.0 + uTime * 0.32 + vWorldPos.z * 0.5) * 0.5 + 0.5;
          float puff = texture2D(uMap, vUv).r;
          float warmMask = smoothstep(-0.5, 6.0, vWorldPos.x);
          vec3 col = mix(uCoolColor, uWarmColor, warmMask);
          float alpha = puff * (0.48 + drift * 0.32) * uMistOpacity * 0.48;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    }),
  );

  const mistPlaneGeo = track(new THREE.PlaneGeometry(11, 1.9));
  const mistConfigs = [
    // Luminous silver-white water-skimming mist directly behind samurai & across left shore
    { pos: [-2.0, 0.34, -9.2], rotY: 0.04, scale: [2.1, 0.65, 1] },
    { pos: [1.4, 0.36, -8.5], rotY: -0.05, scale: [1.8, 0.62, 1] },
    { pos: [-8.5, 0.4, -10.5], rotY: 0.08, scale: [2.2, 0.7, 1] },
    // Warm sunlit peach haze rising off the right shoreline
    { pos: [6.8, 0.95, -5.5], rotY: -0.22, scale: [1.7, 1.35, 1] },
    { pos: [5.2, 0.55, -2.5], rotY: -0.28, scale: [1.2, 0.85, 1] },
  ];

  for (const cfg of mistConfigs) {
    const m = new THREE.Mesh(mistPlaneGeo, mistMat);
    m.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    m.rotation.y = cfg.rotY;
    m.scale.set(cfg.scale[0], cfg.scale[1], cfg.scale[2]);
    mistGroup.add(m);
  }
  group.add(mistGroup);

  // =========================================================================
  // 4. Drifting White Sakura Petals + Luminous Fallen Shore Sparks
  // =========================================================================
  const maxPetals = 420;
  const petalGeo = track(new THREE.PlaneGeometry(0.08, 0.06));
  const petalMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffdfd1,
      emissiveIntensity: 0.25,
      roughness: 0.6,
      map: blossomTex,
      transparent: true,
      alphaTest: 0.28,
      side: THREE.DoubleSide,
    }),
  );
  const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, maxPetals);
  petalMesh.frustumCulled = false;

  const petals: PetalState[] = [];
  for (let i = 0; i < maxPetals; i++) {
    petals.push({
      x: -4.0 + rand() * 13.0,
      y: 0.25 + rand() * 5.2,
      z: -5.5 + rand() * 11.5,
      vx: -0.32 - rand() * 0.52,
      vy: -0.16 - rand() * 0.25,
      vz: (rand() - 0.5) * 0.24,
      rx: rand() * Math.PI * 2,
      ry: rand() * Math.PI * 2,
      rz: rand() * Math.PI * 2,
      spinX: (rand() - 0.5) * 2.4,
      spinY: (rand() - 0.5) * 2.4,
      spinZ: (rand() - 0.5) * 2.4,
      scale: 0.55 + rand() * 0.85,
      phase: rand() * Math.PI * 2,
    });
  }
  group.add(petalMesh);

  // Luminous golden shore speckles / fallen petals along dark wet right shoreline
  const shoreSparkCount = 150;
  const sparkGeo = track(new THREE.BufferGeometry());
  const sparkPos = new Float32Array(shoreSparkCount * 3);
  for (let i = 0; i < shoreSparkCount; i++) {
    const z = -0.2 + rand() * 7.2;
    const shoreEdge = 2.65 - z * 0.06 + Math.sin(z * 0.45) * 0.28;
    const x = shoreEdge - 0.25 + rand() * 3.8;
    const y = Math.max(0.015, groundHeightAt(x, z) + 0.02);
    sparkPos[i * 3] = x;
    sparkPos[i * 3 + 1] = y;
    sparkPos[i * 3 + 2] = z;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = track(
    new THREE.PointsMaterial({
      size: 0.13,
      map: glowSpriteTex,
      color: 0xffd5a6,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const shoreSparks = new THREE.Points(sparkGeo, sparkMat);
  group.add(shoreSparks);

  // =========================================================================
  // 5. Air Effects: Fireflies / Light Motes, Wind Streaks & Rain
  // =========================================================================
  const fireflyCount = 85;
  const fireflies: FireflyState[] = [];
  const fireflyGeo = track(new THREE.BufferGeometry());
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  for (let i = 0; i < fireflyCount; i++) {
    const baseX = -6.5 + rand() * 13.5;
    const baseY = 0.22 + rand() * 2.8;
    const baseZ = -6.5 + rand() * 11.5;
    fireflies.push({
      baseX,
      baseY,
      baseZ,
      phase: rand() * Math.PI * 2,
      speed: 0.6 + rand() * 1.1,
      amp: 0.15 + rand() * 0.35,
    });
    fireflyPositions[i * 3] = baseX;
    fireflyPositions[i * 3 + 1] = baseY;
    fireflyPositions[i * 3 + 2] = baseZ;
  }
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
  const fireflyMat = track(
    new THREE.PointsMaterial({
      size: 0.14,
      map: glowSpriteTex,
      color: 0xffe4b8,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const fireflyPoints = new THREE.Points(fireflyGeo, fireflyMat);
  group.add(fireflyPoints);

  const streakCount = 42;
  const streaks: WindStreakState[] = [];
  const streakGeo = track(new THREE.BufferGeometry());
  const streakPositions = new Float32Array(streakCount * 6);
  for (let i = 0; i < streakCount; i++) {
    streaks.push({
      x: -10 + rand() * 20,
      y: 0.2 + rand() * 3.0,
      z: -6 + rand() * 12,
      speed: 2.2 + rand() * 2.5,
      len: 0.55 + rand() * 1.1,
    });
  }
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  const streakMat = track(
    new THREE.LineBasicMaterial({
      color: 0xe6eefc,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
  );
  const windStreaks = new THREE.LineSegments(streakGeo, streakMat);
  group.add(windStreaks);

  const rainCount = 850;
  const rainGeo = track(new THREE.BufferGeometry());
  const rainPositions = new Float32Array(rainCount * 6);
  const rainSeeds: { x: number; y: number; z: number; speed: number }[] = [];
  for (let i = 0; i < rainCount; i++) {
    rainSeeds.push({
      x: -14 + rand() * 28,
      y: rand() * 11,
      z: -12 + rand() * 22,
      speed: 9.5 + rand() * 4.5,
    });
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = track(
    new THREE.LineBasicMaterial({
      color: 0xc8d8eb,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    }),
  );
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.visible = false;
  group.add(rainLines);

  const stepParticles = (dt: number, elapsed: number, weather: WeatherParameters) => {
    const activeCount = Math.max(
      0,
      Math.min(maxPetals, Math.round(maxPetals * weather.activePetalRatio)),
    );
    petalMesh.count = activeCount;

    const wind = weather.effectiveWind;
    for (let i = 0; i < activeCount; i++) {
      const p = petals[i];
      const flutter = Math.sin(elapsed * 2.3 + p.phase) * 0.35;
      p.x += (p.vx * (0.45 + wind * 1.1) + flutter * 0.25) * dt;
      p.y += (p.vy * (0.7 + wind * 0.25) + Math.cos(elapsed * 1.9 + p.phase) * 0.08) * dt;
      p.z += (p.vz + Math.sin(elapsed * 1.3 + p.phase) * 0.14) * dt;

      p.rx += p.spinX * (0.5 + wind * 0.6) * dt;
      p.ry += p.spinY * (0.5 + wind * 0.6) * dt;
      p.rz += p.spinZ * (0.5 + wind * 0.6) * dt;

      if (p.y < 0.04 || p.x < -8.5) {
        p.x = 1.0 + rand() * 8.5;
        p.y = 2.6 + rand() * 3.4;
        p.z = -3.5 + rand() * 8.5;
      }

      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.rx, p.ry, p.rz);
      _dummy.scale.setScalar(p.scale);
      _dummy.updateMatrix();
      petalMesh.setMatrixAt(i, _dummy.matrix);
    }
    petalMesh.instanceMatrix.needsUpdate = true;

    const fPos = fireflyGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fireflyCount; i++) {
      const f = fireflies[i];
      const x = f.baseX + Math.sin(elapsed * f.speed + f.phase) * f.amp - wind * 0.2 * Math.sin(elapsed + f.phase);
      const y = f.baseY + Math.cos(elapsed * f.speed * 1.3 + f.phase) * f.amp * 0.6;
      const z = f.baseZ + Math.sin(elapsed * f.speed * 0.8 + f.phase * 2) * f.amp;
      fPos.setXYZ(i, x, y, z);
    }
    fPos.needsUpdate = true;

    const sPos = streakGeo.attributes.position as THREE.BufferAttribute;
    const streakSpeedMul = 0.35 + wind * 1.4;
    for (let i = 0; i < streakCount; i++) {
      const s = streaks[i];
      s.x -= s.speed * streakSpeedMul * dt;
      if (s.x < -12) {
        s.x = 11 + rand() * 4;
        s.y = 0.16 + rand() * 3.4;
      }
      const len = s.len * (0.6 + wind * 0.6);
      sPos.setXYZ(i * 2, s.x, s.y, s.z);
      sPos.setXYZ(i * 2 + 1, s.x + len, s.y + 0.03, s.z);
    }
    sPos.needsUpdate = true;

    if (weather.rainIntensity > 0.02) {
      rainLines.visible = true;
      rainMat.opacity = 0.34 * weather.rainIntensity;
      const rPos = rainGeo.attributes.position as THREE.BufferAttribute;
      const slant = -wind * 0.16;
      for (let i = 0; i < rainCount; i++) {
        const r = rainSeeds[i];
        r.y -= r.speed * dt;
        r.x += slant * r.speed * dt;
        if (r.y < 0) {
          r.y = 10 + rand() * 2;
          r.x = -12 + rand() * 26;
        }
        rPos.setXYZ(i * 2, r.x, r.y, r.z);
        rPos.setXYZ(i * 2 + 1, r.x - slant * 0.45, r.y + 0.42, r.z);
      }
      rPos.needsUpdate = true;
    } else {
      rainLines.visible = false;
    }
  };

  stepParticles(0.016, 0, {
    effectiveWind: 0.78,
    gustStrength: 0.42,
    activePetalRatio: 0.75,
    rainIntensity: 0,
    mistOpacity: 0.68,
    airStreakOpacity: 0.45,
  });

  return {
    group,
    update: (dt, elapsed, atmo, weather) => {
      skyMat.uniforms.uZenith.value.set(atmo.zenithColor);
      skyMat.uniforms.uHorizonLeft.value.set(atmo.horizonLeftColor);
      skyMat.uniforms.uHorizonRight.value.set(atmo.horizonRightColor);
      _sunDir.set(atmo.sunPosition[0], atmo.sunPosition[1], atmo.sunPosition[2]).normalize();
      skyMat.uniforms.uSunDir.value.copy(_sunDir);
      skyMat.uniforms.uSunColor.value.set(atmo.sunColor);
      skyMat.uniforms.uSunIntensity.value = atmo.sunIntensity;
      skyMat.uniforms.uMoonIntensity.value = atmo.moonIntensity;
      skyMat.uniforms.uStarOpacity.value = atmo.starOpacity;
      skyMat.uniforms.uTime.value = elapsed;

      if (grassMat.userData.shader) {
        const sh = grassMat.userData.shader;
        sh.uniforms.uTime.value = elapsed;
        sh.uniforms.uWind.value = weather.effectiveWind;
        sh.uniforms.uGust.value = weather.gustStrength;
        sh.uniforms.uBacklight.value.set(atmo.rimLightColor);
        sh.uniforms.uBacklightStrength.value = atmo.bloomGlowIntensity;
      }

      mistMat.uniforms.uTime.value = elapsed;
      mistMat.uniforms.uMistOpacity.value = weather.mistOpacity;
      mistMat.uniforms.uWarmColor.value.set(atmo.horizonRightColor);

      petalMat.emissive.set(atmo.horizonRightColor);
      petalMat.emissiveIntensity = 0.1 + atmo.bloomGlowIntensity * 0.22;

      sparkMat.color.set(atmo.rimLightColor);
      sparkMat.opacity = 0.22 + atmo.bloomGlowIntensity * 0.68;

      fireflyMat.opacity = atmo.fireflyIntensity * 0.88;
      streakMat.opacity = weather.airStreakOpacity * 0.3;

      stepParticles(Math.min(dt, 0.05), elapsed, weather);
    },
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}
