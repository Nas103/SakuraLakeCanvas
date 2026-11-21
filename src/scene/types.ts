export type TimePreset = 'dawn' | 'day' | 'sunset' | 'twilight' | 'night';

export type WeatherPreset = 'clear' | 'breeze' | 'blossom-gale' | 'misty-rain';

export type CameraPreset = 'reference' | 'samurai' | 'shoreline' | 'aerial';

export interface SceneSettings {
  timeOfDay: number; // 0..24 hours, 18.35 matches reference twilight
  autoCycleTime: boolean;
  weather: WeatherPreset;
  windSpeed: number; // 0..2.5
  leafDensity: number; // 0..1
  mistDensity: number; // 0..1
  waterRipple: number; // 0..1
  cameraPreset: CameraPreset;
}

export const DEFAULT_SCENE_SETTINGS: SceneSettings = {
  timeOfDay: 18.35,
  autoCycleTime: false,
  weather: 'breeze',
  windSpeed: 0.78,
  leafDensity: 0.75,
  mistDensity: 0.68,
  waterRipple: 0.24,
  cameraPreset: 'reference',
};

export interface RGBTuple {
  r: number;
  g: number;
  b: number;
}

export interface AtmosphereState {
  zenithColor: string;
  horizonLeftColor: string;
  horizonRightColor: string;
  fogColor: string;
  fogDensity: number;
  sunPosition: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  moonIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  rimLightColor: string;
  rimLightIntensity: number;
  starOpacity: number;
  fireflyIntensity: number;
  waterTint: string;
  waterFresnel: number;
  bloomGlowIntensity: number;
  exposure: number;
  phaseLabel: string;
}

export interface WeatherParameters {
  effectiveWind: number;
  gustStrength: number;
  activePetalRatio: number;
  rainIntensity: number;
  mistOpacity: number;
  airStreakOpacity: number;
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}
