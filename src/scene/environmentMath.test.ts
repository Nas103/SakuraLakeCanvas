import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatHourLabel,
  getAtmosphereForTime,
  getCameraPresetPose,
  getWeatherParameters,
  groundHeightAt,
  timePresetToHour,
} from './environmentMath';

test('twilight default matches reference atmosphere mood', () => {
  const atmo = getAtmosphereForTime(18.35, 'breeze', 0.68);
  assert.equal(atmo.phaseLabel, 'Twilight');
  assert.ok(atmo.starOpacity > 0.7, 'evening star should be visible in twilight');
  assert.ok(atmo.fireflyIntensity > 0.7, 'fireflies/sparks should glow in twilight');
  assert.ok(atmo.sunIntensity > 2.0, 'warm low sun rim light should be strong');
  assert.equal(atmo.zenithColor, '#141926');
  assert.equal(atmo.horizonRightColor, '#e89876');
});

test('day and night lighting differ dramatically without NaNs', () => {
  const day = getAtmosphereForTime(timePresetToHour('day'), 'clear', 0.3);
  const night = getAtmosphereForTime(timePresetToHour('night'), 'clear', 0.3);

  assert.equal(day.phaseLabel, 'Daylight');
  assert.equal(night.phaseLabel, 'Night');
  assert.equal(day.starOpacity, 0);
  assert.ok(night.starOpacity > 0.9);
  assert.ok(day.sunIntensity > night.sunIntensity * 5);
  assert.ok(night.moonIntensity > day.moonIntensity);
  assert.ok(Number.isFinite(day.fogDensity));
  assert.ok(Number.isFinite(night.exposure));
});

test('groundHeightAt shapes lake, samurai shoal, right shore, and left mountain', () => {
  const openLake = groundHeightAt(-2.0, 4.0);
  const samuraiShoal = groundHeightAt(0.65, -3.2);
  const rightGrassBank = groundHeightAt(4.6, 2.0);
  const farForest = groundHeightAt(0.0, -25.0);
  const leftMountain = groundHeightAt(-22.5, -44.0);

  assert.ok(openLake < -0.2, `expected submerged lake bed, got ${openLake}`);
  assert.ok(samuraiShoal >= 0.0 && samuraiShoal < 0.12, `expected low wet shoal, got ${samuraiShoal}`);
  assert.ok(rightGrassBank > 0.15 && rightGrassBank < 0.5, `expected low elevated right shoreline, got ${rightGrassBank}`);
  assert.ok(farForest > 1.2, `expected forested far shore rise, got ${farForest}`);
  assert.ok(leftMountain > 18.0, `expected high snow mountain peak, got ${leftMountain}`);
});

test('weather parameters scale wind, petals, mist, and rain accurately', () => {
  const clear = getWeatherParameters('clear', 0.5, 0.8, 0.5);
  const gale = getWeatherParameters('blossom-gale', 1.2, 0.8, 0.5);
  const rain = getWeatherParameters('misty-rain', 0.8, 0.8, 0.5);

  assert.equal(clear.rainIntensity, 0);
  assert.ok(gale.effectiveWind > clear.effectiveWind * 3);
  assert.ok(gale.activePetalRatio >= 0.9);
  assert.equal(rain.rainIntensity, 1.0);
  assert.ok(rain.mistOpacity > clear.mistOpacity);
});

test('time formatting and camera presets return valid values', () => {
  assert.equal(formatHourLabel(18.5), '18:30');
  assert.equal(formatHourLabel(-1), '23:00');
  const refPose = getCameraPresetPose('reference');
  assert.equal(refPose.position.length, 3);
  assert.equal(refPose.target.length, 3);
  assert.ok(refPose.fov > 30 && refPose.fov < 70);
});
