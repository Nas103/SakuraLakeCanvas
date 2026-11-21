import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAtmosphere } from '../scene/builders/buildAtmosphere';
import { buildLandscape } from '../scene/builders/buildLandscape';
import { buildSakuraTree } from '../scene/builders/buildSakuraTree';
import { buildSamurai } from '../scene/builders/buildSamurai';
import {
  getAtmosphereForTime,
  getCameraPresetPose,
  getWeatherParameters,
  groundHeightAt,
  normalizeHour,
} from '../scene/environmentMath';
import {
  createBarkBumpTexture,
  createBlossomTexture,
  createContactShadowTexture,
  createGlowSpriteTexture,
  createWaterNormalTexture,
} from '../scene/textures';
import type { CameraPreset, SceneSettings } from '../scene/types';

interface SakuraLakeCanvasProps {
  settings: SceneSettings;
  cameraTransitionTrigger: number;
  onAutoTimeChange: (nextHour: number) => void;
  onUserOrbitStart: () => void;
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

// Pre-allocated scratch vectors for smooth camera damping
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

export function SakuraLakeCanvas({
  settings,
  cameraTransitionTrigger,
  onAutoTimeChange,
  onUserOrbitStart,
}: SakuraLakeCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<SceneSettings>(settings);
  const onAutoTimeRef = useRef(onAutoTimeChange);
  const onUserOrbitRef = useRef(onUserOrbitStart);
  const cameraGoalRef = useRef<{
    active: boolean;
    preset: CameraPreset;
  }>({ active: false, preset: settings.cameraPreset });

  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    onAutoTimeRef.current = onAutoTimeChange;
    onUserOrbitRef.current = onUserOrbitStart;
  }, [onAutoTimeChange, onUserOrbitStart]);

  useEffect(() => {
    cameraGoalRef.current = {
      active: true,
      preset: settings.cameraPreset,
    };
  }, [settings.cameraPreset, cameraTransitionTrigger]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const pixelRatio = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('data-testid', 'sakura-lake-canvas');

    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const initialAtmo = getAtmosphereForTime(
      settingsRef.current.timeOfDay,
      settingsRef.current.weather,
      settingsRef.current.mistDensity,
    );
    scene.fog = new THREE.FogExp2(initialAtmo.fogColor, initialAtmo.fogDensity);

    // Studio IBL environment map via RoomEnvironment on every device
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.55;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Camera & OrbitControls initialized to exact reference framing
    const initialPose = getCameraPresetPose(settingsRef.current.cameraPreset);
    const camera = new THREE.PerspectiveCamera(initialPose.fov, width / height, 0.15, 260);
    camera.position.set(...initialPose.position);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...initialPose.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.494; // keep camera above mirror lake surface
    controls.minPolarAngle = 0.12;
    controls.minDistance = 2.0;
    controls.maxDistance = 32.0;
    controls.enablePan = true;
    controls.update();

    controls.addEventListener('start', () => {
      cameraGoalRef.current.active = false;
      onUserOrbitRef.current();
    });

    // 3-Point Outdoor Lighting Rig (Warm Sun Key + Cool Hemisphere Fill + Sunset Rim)
    const sunKeyLight = new THREE.DirectionalLight(initialAtmo.sunColor, initialAtmo.sunIntensity);
    sunKeyLight.position.set(...initialAtmo.sunPosition);
    sunKeyLight.castShadow = !isSoftwareGl;
    sunKeyLight.shadow.mapSize.set(1024, 1024);
    sunKeyLight.shadow.camera.near = 1;
    sunKeyLight.shadow.camera.far = 90;
    const shadowBound = 24;
    sunKeyLight.shadow.camera.left = -shadowBound;
    sunKeyLight.shadow.camera.right = shadowBound;
    sunKeyLight.shadow.camera.top = shadowBound;
    sunKeyLight.shadow.camera.bottom = -shadowBound;
    sunKeyLight.shadow.bias = -0.0005;
    sunKeyLight.shadow.normalBias = 0.02;
    scene.add(sunKeyLight);

    const hemiLight = new THREE.HemisphereLight(
      initialAtmo.hemiSkyColor,
      initialAtmo.hemiGroundColor,
      initialAtmo.hemiIntensity,
    );
    scene.add(hemiLight);

    // Warm rim light accentuating the sakura blossoms, tall right grass, and samurai edges
    const rimLight = new THREE.DirectionalLight(
      initialAtmo.rimLightColor,
      initialAtmo.rimLightIntensity,
    );
    rimLight.position.set(14, 5.5, -18);
    scene.add(rimLight);

    // Subtle cool moon light for night illumination
    const moonLight = new THREE.DirectionalLight(0x98b4e6, initialAtmo.moonIntensity);
    moonLight.position.set(-16, 22, -24);
    scene.add(moonLight);

    // Procedural Textures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const waterNormalTex = createWaterNormalTexture(maxAniso);
    const blossomTex = createBlossomTexture(maxAniso);
    const glowSpriteTex = createGlowSpriteTexture();
    const barkBumpTex = createBarkBumpTexture(maxAniso);
    const contactShadowTex = createContactShadowTexture();

    // Build Modular 3D Subsystems
    const landscape = buildLandscape(
      waterNormalTex,
      barkBumpTex,
      isSoftwareGl,
      width,
      height,
      pixelRatio,
    );
    scene.add(landscape.group);

    const samurai = buildSamurai(contactShadowTex);
    const samuraiX = 0.65;
    const samuraiZ = -3.2;
    const samuraiY = Math.max(0.015, groundHeightAt(samuraiX, samuraiZ));
    samurai.group.position.set(samuraiX, samuraiY, samuraiZ);
    // Facing slightly left-away toward the mountain and far mist (iconic silhouette angle)
    samurai.group.rotation.y = 0.34;
    scene.add(samurai.group);

    const sakuraTree = buildSakuraTree(barkBumpTex, blossomTex);
    scene.add(sakuraTree.group);

    const atmosphere = buildAtmosphere(blossomTex, glowSpriteTex);
    scene.add(atmosphere.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Resize listener
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop with software-WebGL afterDraw pacing & zero allocations
    let frameId = 0;
    let disposed = false;
    let lastTimestamp = performance.now();
    let elapsed = 0;
    let lastTimeSync = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;

      const now = performance.now();
      const dt = Math.min(0.1, Math.max(0.001, (now - lastTimestamp) / 1000));
      lastTimestamp = now;
      elapsed += dt;

      const cur = settingsRef.current;

      // Advance auto day/night cycle if enabled (throttled React state sync <= 6Hz)
      if (cur.autoCycleTime) {
        const nextHour = normalizeHour(cur.timeOfDay + dt * 0.65);
        cur.timeOfDay = nextHour;
        if (now - lastTimeSync > 160) {
          lastTimeSync = now;
          onAutoTimeRef.current(nextHour);
        }
      }

      const atmo = getAtmosphereForTime(cur.timeOfDay, cur.weather, cur.mistDensity);
      const weatherParams = getWeatherParameters(
        cur.weather,
        cur.windSpeed,
        cur.leafDensity,
        cur.mistDensity,
      );

      // Update scene lighting & fog smoothly
      renderer.toneMappingExposure = atmo.exposure;
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set(atmo.fogColor);
        scene.fog.density = atmo.fogDensity;
      }

      sunKeyLight.position.set(...atmo.sunPosition);
      sunKeyLight.color.set(atmo.sunColor);
      sunKeyLight.intensity = atmo.sunIntensity;

      hemiLight.color.set(atmo.hemiSkyColor);
      hemiLight.groundColor.set(atmo.hemiGroundColor);
      hemiLight.intensity = atmo.hemiIntensity;

      rimLight.color.set(atmo.rimLightColor);
      rimLight.intensity = atmo.rimLightIntensity;

      moonLight.intensity = atmo.moonIntensity;

      // Update samurai subtle breathing & cloak wind flutter
      const wind = weatherParams.effectiveWind;
      samurai.cloakMesh.rotation.x = 0.1 + Math.sin(elapsed * 2.4) * 0.045 * wind + wind * 0.05;
      samurai.cloakMesh.rotation.z = Math.cos(elapsed * 1.9) * 0.03 * wind;
      samurai.leftSode.rotation.z = 0.22 + Math.sin(elapsed * 1.6) * 0.012 * wind;
      samurai.rightSode.rotation.z = -0.22 - Math.cos(elapsed * 1.6) * 0.012 * wind;

      // Update sakura tree sway & rim glow
      sakuraTree.setWindAndLight(elapsed, wind, atmo.bloomGlowIntensity);

      // Update water reflection & ripples
      landscape.updateWater(
        elapsed,
        wind,
        cur.waterRipple,
        atmo.waterTint,
        atmo.waterFresnel,
        atmo.sunColor,
        atmo.sunPosition,
        atmo.bloomGlowIntensity,
      );

      // Update sky, grass, mist, petals, fireflies, air streaks & rain
      atmosphere.update(dt, elapsed, atmo, weatherParams);

      // Smooth damped camera preset transitions
      if (cameraGoalRef.current.active) {
        const pose = getCameraPresetPose(cameraGoalRef.current.preset);
        _targetCamPos.set(...pose.position);
        _targetLookAt.set(...pose.target);

        const dampAlpha = isSoftwareGl ? 1.0 : 1 - Math.exp(-4.5 * dt);
        camera.position.lerp(_targetCamPos, dampAlpha);
        controls.target.lerp(_targetLookAt, dampAlpha);
        if (Math.abs(camera.fov - pose.fov) > 0.05) {
          camera.fov = THREE.MathUtils.lerp(camera.fov, pose.fov, dampAlpha);
          camera.updateProjectionMatrix();
        }
        if (
          camera.position.distanceTo(_targetCamPos) < 0.02 &&
          controls.target.distanceTo(_targetLookAt) < 0.02
        ) {
          camera.position.copy(_targetCamPos);
          controls.target.copy(_targetLookAt);
          cameraGoalRef.current.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    // Initial render & start loop
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      controls.dispose();
      samurai.dispose();
      sakuraTree.dispose();
      landscape.dispose();
      atmosphere.dispose();
      waterNormalTex.dispose();
      blossomTex.dispose();
      glowSpriteTex.dispose();
      barkBumpTex.dispose();
      contactShadowTex.dispose();
      envTarget.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#121620]">
      <div ref={mountRef} className="h-full w-full" />
      {contextLost && (
        <div
          role="alert"
          className="absolute inset-0 z-20 flex items-center justify-center bg-[#121620]/90 p-6 text-center text-[#f4efe8]"
        >
          <div className="max-w-md space-y-2">
            <h2 className="font-serif text-2xl font-medium">3D Viewport Paused</h2>
            <p className="text-sm text-[#c7c2ba]">
              The graphics context was interrupted. Reload the page to restore the lakeside scene.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
