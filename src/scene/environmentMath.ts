import type {
  AtmosphereState,
  CameraPose,
  CameraPreset,
  TimePreset,
  WeatherParameters,
  WeatherPreset,
} from './types';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function lerpColorHex(hexA: string, hexB: string, t: number): string {
  const k = clamp01(t);
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return rgbToHex(lerp(r1, r2, k), lerp(g1, g2, k), lerp(b1, b2, k));
}

export function normalizeHour(hour: number): number {
  if (!Number.isFinite(hour)) return 18.35;
  const wrapped = ((hour % 24) + 24) % 24;
  return wrapped;
}

export function timePresetToHour(preset: TimePreset): number {
  switch (preset) {
    case 'dawn':
      return 6.35;
    case 'day':
      return 12.5;
    case 'sunset':
      return 17.6;
    case 'twilight':
      return 18.35;
    case 'night':
      return 22.8;
  }
}

export function formatHourLabel(hour: number): string {
  const h = normalizeHour(hour);
  const wholeHours = Math.floor(h);
  const mins = Math.floor((h - wholeHours) * 60);
  return `${String(wholeHours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function getPhaseLabel(hour: number): string {
  const h = normalizeHour(hour);
  if (h >= 5.2 && h < 7.8) return 'Dawn';
  if (h >= 7.8 && h < 16.5) return 'Daylight';
  if (h >= 16.5 && h < 18.0) return 'Golden Hour';
  if (h >= 18.0 && h < 19.8) return 'Twilight';
  return 'Night';
}

interface Keyframe {
  hour: number;
  zenith: string;
  horizonLeft: string;
  horizonRight: string;
  fog: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  moonIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  rimColor: string;
  rimIntensity: number;
  starOpacity: number;
  fireflyIntensity: number;
  waterTint: string;
  waterFresnel: number;
  bloomGlow: number;
  exposure: number;
}

const KEYFRAMES: Keyframe[] = [
  {
    hour: 0.0,
    zenith: '#070a13',
    horizonLeft: '#0f1729',
    horizonRight: '#1a253d',
    fog: '#0f1626',
    fogDensity: 0.015,
    sunColor: '#9ab6e8',
    sunIntensity: 0.15,
    moonIntensity: 1.05,
    hemiSky: '#233457',
    hemiGround: '#0a0d14',
    hemiIntensity: 0.42,
    rimColor: '#8aaee6',
    rimIntensity: 0.65,
    starOpacity: 1.0,
    fireflyIntensity: 1.0,
    waterTint: '#111926',
    waterFresnel: 0.84,
    bloomGlow: 0.35,
    exposure: 0.92,
  },
  {
    hour: 5.0,
    zenith: '#141a2b',
    horizonLeft: '#262b42',
    horizonRight: '#6d4b5d',
    fog: '#29293b',
    fogDensity: 0.018,
    sunColor: '#f29e74',
    sunIntensity: 0.8,
    moonIntensity: 0.35,
    hemiSky: '#4e5575',
    hemiGround: '#1a1820',
    hemiIntensity: 0.55,
    rimColor: '#ffae85',
    rimIntensity: 0.9,
    starOpacity: 0.55,
    fireflyIntensity: 0.65,
    waterTint: '#1a1f2b',
    waterFresnel: 0.8,
    bloomGlow: 0.6,
    exposure: 1.0,
  },
  {
    hour: 6.5,
    zenith: '#2c4266',
    horizonLeft: '#6a7a99',
    horizonRight: '#f4b587',
    fog: '#8e8c99',
    fogDensity: 0.016,
    sunColor: '#ffd1a3',
    sunIntensity: 2.35,
    moonIntensity: 0.0,
    hemiSky: '#8ca8cc',
    hemiGround: '#403429',
    hemiIntensity: 0.82,
    rimColor: '#ffdcb8',
    rimIntensity: 1.15,
    starOpacity: 0.08,
    fireflyIntensity: 0.12,
    waterTint: '#363b45',
    waterFresnel: 0.72,
    bloomGlow: 0.85,
    exposure: 1.1,
  },
  {
    hour: 12.0,
    zenith: '#386ea8',
    horizonLeft: '#8fb5d6',
    horizonRight: '#bad4e6',
    fog: '#9ab6cc',
    fogDensity: 0.011,
    sunColor: '#fff6e8',
    sunIntensity: 2.9,
    moonIntensity: 0.0,
    hemiSky: '#b8d7f0',
    hemiGround: '#4f593b',
    hemiIntensity: 1.05,
    rimColor: '#ffffff',
    rimIntensity: 0.75,
    starOpacity: 0.0,
    fireflyIntensity: 0.0,
    waterTint: '#485b69',
    waterFresnel: 0.65,
    bloomGlow: 0.45,
    exposure: 1.12,
  },
  {
    hour: 15.5,
    zenith: '#386ea8',
    horizonLeft: '#8fb5d6',
    horizonRight: '#d9c8b8',
    fog: '#9cb0c2',
    fogDensity: 0.012,
    sunColor: '#ffebd1',
    sunIntensity: 2.85,
    moonIntensity: 0.0,
    hemiSky: '#a8cbe8',
    hemiGround: '#4a5238',
    hemiIntensity: 0.96,
    rimColor: '#ffeedb',
    rimIntensity: 0.95,
    starOpacity: 0.0,
    fireflyIntensity: 0.0,
    waterTint: '#3e4e5c',
    waterFresnel: 0.7,
    bloomGlow: 0.6,
    exposure: 1.12,
  },
  {
    hour: 17.5,
    zenith: '#283147',
    horizonLeft: '#57586b',
    horizonRight: '#f2a172',
    fog: '#6e5c63',
    fogDensity: 0.015,
    sunColor: '#ffb578',
    sunIntensity: 2.75,
    moonIntensity: 0.0,
    hemiSky: '#7d7a94',
    hemiGround: '#33281d',
    hemiIntensity: 0.78,
    rimColor: '#ffca99',
    rimIntensity: 1.45,
    starOpacity: 0.25,
    fireflyIntensity: 0.45,
    waterTint: '#29272b',
    waterFresnel: 0.82,
    bloomGlow: 1.0,
    exposure: 1.12,
  },
  {
    // Exact reference image match: dark slate-indigo zenith, rose-peach right horizon, glowing rim
    hour: 18.35,
    zenith: '#141926',
    horizonLeft: '#2d3142',
    horizonRight: '#e89876',
    fog: '#3d3742',
    fogDensity: 0.0085,
    sunColor: '#ffbe8a',
    sunIntensity: 2.65,
    moonIntensity: 0.0,
    hemiSky: '#585c75',
    hemiGround: '#241e18',
    hemiIntensity: 0.62,
    rimColor: '#ffd4a6',
    rimIntensity: 1.65,
    starOpacity: 0.85,
    fireflyIntensity: 0.85,
    waterTint: '#14151a',
    waterFresnel: 0.9,
    bloomGlow: 1.0,
    exposure: 1.08,
  },
  {
    hour: 20.0,
    zenith: '#0c111e',
    horizonLeft: '#1b2236',
    horizonRight: '#3c3045',
    fog: '#1a1e2e',
    fogDensity: 0.016,
    sunColor: '#8ba4d4',
    sunIntensity: 0.25,
    moonIntensity: 0.9,
    hemiSky: '#2d3b5c',
    hemiGround: '#0e1118',
    hemiIntensity: 0.48,
    rimColor: '#98b4e0',
    rimIntensity: 0.72,
    starOpacity: 0.95,
    fireflyIntensity: 0.95,
    waterTint: '#131924',
    waterFresnel: 0.86,
    bloomGlow: 0.45,
    exposure: 0.96,
  },
  {
    hour: 24.0,
    zenith: '#070a13',
    horizonLeft: '#0f1729',
    horizonRight: '#1a253d',
    fog: '#0f1626',
    fogDensity: 0.015,
    sunColor: '#9ab6e8',
    sunIntensity: 0.15,
    moonIntensity: 1.05,
    hemiSky: '#233457',
    hemiGround: '#0a0d14',
    hemiIntensity: 0.42,
    rimColor: '#8aaee6',
    rimIntensity: 0.65,
    starOpacity: 1.0,
    fireflyIntensity: 1.0,
    waterTint: '#111926',
    waterFresnel: 0.84,
    bloomGlow: 0.35,
    exposure: 0.92,
  },
];

export function getAtmosphereForTime(
  hourInput: number,
  weather: WeatherPreset,
  mistDensity: number,
): AtmosphereState {
  const hour = normalizeHour(hourInput);

  let prev = KEYFRAMES[0];
  let next = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (hour >= KEYFRAMES[i].hour && hour <= KEYFRAMES[i + 1].hour) {
      prev = KEYFRAMES[i];
      next = KEYFRAMES[i + 1];
      break;
    }
  }

  const span = Math.max(0.0001, next.hour - prev.hour);
  const t = clamp01((hour - prev.hour) / span);

  // Sun travels from east (+x back) across south high noon to right-horizon (-z, +x) at twilight
  const dayPhase = ((hour - 6.0) / 12.5) * Math.PI;
  const sunElev =
    hour >= 5.2 && hour <= 19.3
      ? Math.max(3.2, Math.sin(clamp01((hour - 5.2) / 14.1) * Math.PI) * 32 + 2.5)
      : 18;
  const sunX = hour < 12 ? lerp(-18, 8, clamp01(hour / 12)) : lerp(8, 28, clamp01((hour - 12) / 7.5));
  const sunZ = -34 + Math.cos(dayPhase) * 6;

  const isRain = weather === 'misty-rain';
  const weatherFogBoost = isRain ? 0.012 : weather === 'blossom-gale' ? 0.003 : 0;
  const weatherDesat = isRain ? 0.45 : 0;

  let zenithColor = lerpColorHex(prev.zenith, next.zenith, t);
  let horizonLeftColor = lerpColorHex(prev.horizonLeft, next.horizonLeft, t);
  let horizonRightColor = lerpColorHex(prev.horizonRight, next.horizonRight, t);
  let fogColor = lerpColorHex(prev.fog, next.fog, t);

  if (weatherDesat > 0) {
    zenithColor = lerpColorHex(zenithColor, '#26303d', weatherDesat);
    horizonLeftColor = lerpColorHex(horizonLeftColor, '#4c5663', weatherDesat);
    horizonRightColor = lerpColorHex(horizonRightColor, '#646b75', weatherDesat);
    fogColor = lerpColorHex(fogColor, '#4d5763', weatherDesat);
  }

  const baseFogDensity = lerp(prev.fogDensity, next.fogDensity, t);
  const fogDensity = baseFogDensity + clamp01(mistDensity) * 0.008 + weatherFogBoost;

  const sunIntensity =
    lerp(prev.sunIntensity, next.sunIntensity, t) * (isRain ? 0.55 : 1.0);
  const moonIntensity = lerp(prev.moonIntensity, next.moonIntensity, t);

  return {
    zenithColor,
    horizonLeftColor,
    horizonRightColor,
    fogColor,
    fogDensity,
    sunPosition: [sunX, sunElev, sunZ],
    sunColor: lerpColorHex(prev.sunColor, next.sunColor, t),
    sunIntensity,
    moonIntensity,
    hemiSkyColor: lerpColorHex(prev.hemiSky, next.hemiSky, t),
    hemiGroundColor: lerpColorHex(prev.hemiGround, next.hemiGround, t),
    hemiIntensity: lerp(prev.hemiIntensity, next.hemiIntensity, t),
    rimLightColor: lerpColorHex(prev.rimColor, next.rimColor, t),
    rimLightIntensity:
      lerp(prev.rimIntensity, next.rimIntensity, t) * (isRain ? 0.6 : 1.0),
    starOpacity: clamp01(lerp(prev.starOpacity, next.starOpacity, t)) * (isRain ? 0.15 : 1.0),
    fireflyIntensity: clamp01(lerp(prev.fireflyIntensity, next.fireflyIntensity, t)) * (isRain ? 0.25 : 1.0),
    waterTint: lerpColorHex(prev.waterTint, next.waterTint, t),
    waterFresnel: lerp(prev.waterFresnel, next.waterFresnel, t),
    bloomGlowIntensity: lerp(prev.bloomGlow, next.bloomGlow, t),
    exposure: lerp(prev.exposure, next.exposure, t),
    phaseLabel: getPhaseLabel(hour),
  };
}

export function getWeatherParameters(
  weather: WeatherPreset,
  windSpeed: number,
  leafDensity: number,
  mistDensity: number,
): WeatherParameters {
  const clampedWind = Math.max(0, Math.min(2.5, windSpeed));
  const clampedLeaf = clamp01(leafDensity);
  const clampedMist = clamp01(mistDensity);

  switch (weather) {
    case 'clear':
      return {
        effectiveWind: clampedWind * 0.45,
        gustStrength: 0.15,
        activePetalRatio: clampedLeaf * 0.55,
        rainIntensity: 0,
        mistOpacity: clampedMist * 0.65,
        airStreakOpacity: 0.12,
      };
    case 'breeze':
      return {
        effectiveWind: Math.max(0.35, clampedWind),
        gustStrength: 0.42,
        activePetalRatio: clampedLeaf,
        rainIntensity: 0,
        mistOpacity: clampedMist,
        airStreakOpacity: 0.45,
      };
    case 'blossom-gale':
      return {
        effectiveWind: Math.max(1.25, clampedWind * 1.65),
        gustStrength: 0.9,
        activePetalRatio: Math.min(1, clampedLeaf * 1.25 + 0.15),
        rainIntensity: 0,
        mistOpacity: clampedMist * 0.85,
        airStreakOpacity: 0.85,
      };
    case 'misty-rain':
      return {
        effectiveWind: Math.max(0.65, clampedWind * 1.1),
        gustStrength: 0.55,
        activePetalRatio: clampedLeaf * 0.45,
        rainIntensity: 1.0,
        mistOpacity: Math.min(1, clampedMist * 1.3 + 0.25),
        airStreakOpacity: 0.65,
      };
  }
}

/**
 * Deterministic heightfield for the lakeside scene.
 * y = 0 is the lake water surface.
 * - Foreground lake (z > -8.5, x < 1.8): submerged bed below 0
 * - Samurai shoal at (0.65, -3.2): subtle flat wet spit at y ≈ 0.025
 * - Right foreground bank (x > 1.85, z between -5 and +8): grass-covered shore rising to ~0.7
 * - Far shore treeline (z < -9.5): forested hillside rising toward back
 * - Distant left mountain (centered near x=-25, z=-45): craggy peak up to y ≈ 17.5
 */
export function groundHeightAt(x: number, z: number): number {
  // Subtle organic undulation
  const wave =
    Math.sin(x * 0.24 + z * 0.18) * 0.14 +
    Math.cos(x * 0.11 - z * 0.27) * 0.11;

  // Base lake bed
  let h = -0.55 + wave * 0.25;

  // Samurai's wet sandbar / shoal near (0.65, -3.2)
  const dxSamurai = (x - 0.65) / 1.9;
  const dzSamurai = (z + 3.2) / 1.35;
  const shoalDist2 = dxSamurai * dxSamurai + dzSamurai * dzSamurai;
  if (shoalDist2 < 1.8) {
    const shoal = Math.exp(-shoalDist2 * 1.6) * 0.59;
    h = Math.max(h, -0.55 + shoal);
  }

  // Right foreground shoreline bank curving gently above water (low dark wet shore)
  const shoreEdgeX = 2.65 - z * 0.06 + Math.sin(z * 0.45) * 0.28;
  if (x > shoreEdgeX - 0.9 && z > -8 && z < 11) {
    const bankT = clamp01((x - (shoreEdgeX - 0.9)) / 3.4);
    const smoothBank = bankT * bankT * (3 - 2 * bankT);
    const bankHeight = lerp(-0.5, 0.34, smoothBank) + wave * 0.09;
    h = Math.max(h, bankHeight);
  }

  // Left foreground far bank edge (far off left, keeping central lake & reflection open)
  if (x < -22) {
    const leftT = clamp01((-x - 22) / 10);
    h = Math.max(h, lerp(-0.45, 1.3, leftT * leftT) + wave * 0.25);
  }

  // Far shore forest rise (z < -13.5)
  const farShoreZ = -13.8 + Math.sin(x * 0.14) * 1.1;
  if (z < farShoreZ + 1.5) {
    const farT = clamp01((farShoreZ + 1.5 - z) / 18.0);
    const ridge = Math.pow(farT, 1.15) * 3.6 + wave * 0.45;
    h = Math.max(h, -0.45 + ridge);
  }

  // Distant majestic craggy snow-capped mountain on the left (x around -22, z around -44)
  const mx = (x + 22.5) / 16.5;
  const mz = (z + 44.0) / 15.0;
  const mDist2 = mx * mx + mz * mz;
  if (mDist2 < 3.0) {
    const ridgeNoise =
      Math.abs(Math.sin(x * 0.26 + z * 0.17)) * 2.2 +
      Math.cos(x * 0.54 - z * 0.43) * 0.85 +
      Math.sin(x * 0.95 + z * 0.72) * 0.35;
    const peak = Math.exp(-mDist2 * 0.92) * 20.5 + ridgeNoise * Math.exp(-mDist2 * 0.65);
    h = Math.max(h, peak);
  }

  // Secondary right-rear distant mountain ridge (subtle depth behind treeline)
  const rx = (x - 24.0) / 18.0;
  const rz = (z + 52.0) / 16.0;
  const rDist2 = rx * rx + rz * rz;
  if (rDist2 < 2.2) {
    const rPeak = Math.exp(-rDist2 * 1.1) * 8.4 + Math.sin(x * 0.22) * 0.7;
    h = Math.max(h, rPeak);
  }

  return h;
}

export function getCameraPresetPose(preset: CameraPreset): CameraPose {
  switch (preset) {
    case 'reference':
      return {
        position: [0.35, 0.56, 8.8],
        target: [0.0, 1.45, -7.0],
        fov: 46,
      };
    case 'samurai':
      return {
        position: [-2.15, 1.32, -0.15],
        target: [0.65, 1.05, -3.2],
        fov: 42,
      };
    case 'shoreline':
      return {
        position: [4.8, 1.25, 4.9],
        target: [0.4, 1.15, -3.6],
        fov: 48,
      };
    case 'aerial':
      return {
        position: [-7.5, 9.5, 14.5],
        target: [0.5, 1.1, -6.5],
        fov: 50,
      };
  }
}
