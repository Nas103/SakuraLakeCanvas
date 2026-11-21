import { useCallback, useEffect, useState } from 'react';
import { ControlDock } from './components/ControlDock';
import { SakuraLakeCanvas } from './components/SakuraLakeCanvas';
import { formatHourLabel, getPhaseLabel } from './scene/environmentMath';
import {
  DEFAULT_SCENE_SETTINGS,
  type CameraPreset,
  type SceneSettings,
} from './scene/types';

export default function App() {
  const [settings, setSettings] = useState<SceneSettings>(DEFAULT_SCENE_SETTINGS);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [cameraTransitionTrigger, setCameraTransitionTrigger] = useState(0);

  const handleUpdate = useCallback((patch: Partial<SceneSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSelectCamera = useCallback((preset: CameraPreset) => {
    setSettings((prev) => ({ ...prev, cameraPreset: preset }));
    setCameraTransitionTrigger((c) => c + 1);
  }, []);

  const handleReset = useCallback(() => {
    setSettings(DEFAULT_SCENE_SETTINGS);
    setCameraTransitionTrigger((c) => c + 1);
  }, []);

  const handleAutoTimeChange = useCallback((nextHour: number) => {
    setSettings((prev) => ({ ...prev, timeOfDay: nextHour }));
  }, []);

  const handleUserOrbitStart = useCallback(() => {
    // Keep current camera preset highlighted until user picks another, no forced jump
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleReset]);

  const phaseLabel = getPhaseLabel(settings.timeOfDay);
  const hourFormatted = formatHourLabel(settings.timeOfDay);
  const weatherLabel =
    settings.weather === 'blossom-gale'
      ? 'Blossom Gale'
      : settings.weather === 'misty-rain'
        ? 'Misty Rain'
        : settings.weather === 'breeze'
          ? 'Breeze'
          : 'Clear';

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-[#121620]"
      data-time-phase={phaseLabel.toLowerCase()}
      data-weather={settings.weather}
      data-camera-preset={settings.cameraPreset}
      data-dock-open={!dockCollapsed}
    >
      {/* Full-bleed WebGL 3D Canvas */}
      <SakuraLakeCanvas
        settings={settings}
        cameraTransitionTrigger={cameraTransitionTrigger}
        onAutoTimeChange={handleAutoTimeChange}
        onUserOrbitStart={handleUserOrbitStart}
      />

      {/* Minimal Top-Left Scene Header with subtle contrast scrim */}
      <header className="pointer-events-none fixed top-0 left-0 z-10 select-none bg-gradient-to-br from-[#0d1018]/60 via-[#0d1018]/25 to-transparent pt-5 pr-14 pb-8 pl-6">
        <h1 className="font-display text-2xl font-medium tracking-wide text-[#f7f2ea] drop-shadow-md sm:text-3xl">
          Tsushima Reflections
        </h1>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-[#e5dfd6] drop-shadow">
          <span>{phaseLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">{hourFormatted}</span>
          <span aria-hidden="true">·</span>
          <span>{weatherLabel}</span>
        </p>
      </header>

      {/* Collapsible Bottom Control Dock */}
      <ControlDock
        settings={settings}
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
        onUpdate={handleUpdate}
        onSelectCamera={handleSelectCamera}
        onReset={handleReset}
      />
    </main>
  );
}
