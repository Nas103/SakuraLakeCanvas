import { useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Flower2,
  Play,
  Pause,
  RotateCcw,
  Sun,
  Wind,
} from 'lucide-react';
import { formatHourLabel, getPhaseLabel, timePresetToHour } from '../scene/environmentMath';
import type { CameraPreset, SceneSettings, TimePreset, WeatherPreset } from '../scene/types';

type DockTab = 'lighting' | 'weather' | 'foliage' | 'camera';

interface ControlDockProps {
  settings: SceneSettings;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onUpdate: (patch: Partial<SceneSettings>) => void;
  onSelectCamera: (preset: CameraPreset) => void;
  onReset: () => void;
}

const TIME_PRESETS: { id: TimePreset; label: string }[] = [
  { id: 'dawn', label: 'Dawn' },
  { id: 'day', label: 'Day' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'twilight', label: 'Twilight' },
  { id: 'night', label: 'Night' },
];

const WEATHER_PRESETS: { id: WeatherPreset; label: string }[] = [
  { id: 'clear', label: 'Clear' },
  { id: 'breeze', label: 'Breeze' },
  { id: 'blossom-gale', label: 'Blossom Gale' },
  { id: 'misty-rain', label: 'Misty Rain' },
];

const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'reference', label: 'Scene Match' },
  { id: 'samurai', label: 'Samurai' },
  { id: 'shoreline', label: 'Shore Grass' },
  { id: 'aerial', label: 'High Vista' },
];

export function ControlDock({
  settings,
  collapsed,
  onToggleCollapse,
  onUpdate,
  onSelectCamera,
  onReset,
}: ControlDockProps) {
  const [activeTab, setActiveTab] = useState<DockTab>('lighting');

  const phaseLabel = getPhaseLabel(settings.timeOfDay);
  const hourFormatted = formatHourLabel(settings.timeOfDay);

  const isTimeActive = (preset: TimePreset): boolean => {
    const target = timePresetToHour(preset);
    return Math.abs(settings.timeOfDay - target) < 0.45;
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex flex-col items-center px-3"
      style={{
        transform: collapsed ? 'translateY(calc(100% - 34px))' : 'translateY(0)',
        transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Collapse / Expand toggle tab */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show Controls' : 'Hide Controls'}
        className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-[#121620]/90 px-3 py-1 text-xs font-medium text-[#ede6dc] transition-colors hover:bg-[#1c2231] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0b88f]"
      >
        {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <span className="whitespace-nowrap">{collapsed ? 'Show Controls' : 'Hide Controls'}</span>
      </button>

      {/* Main unified bottom dock (no backdrop-filter over WebGL) */}
      <section
        aria-label="Scene Controls"
        className="pointer-events-auto w-full max-w-[820px] rounded-xl border border-white/12 bg-[#121620]/92 px-4 py-3 text-[#f4efe8] shadow-2xl"
      >
        {/* Tab selector + quick Reset */}
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div role="tablist" aria-label="Control categories" className="flex items-center gap-1">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'lighting'}
              onClick={() => setActiveTab('lighting')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#f0b88f] ${
                activeTab === 'lighting'
                  ? 'bg-[#f0b88f] text-[#141720]'
                  : 'text-[#cbc5bc] hover:bg-white/8 hover:text-white'
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Day & Night</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'weather'}
              onClick={() => setActiveTab('weather')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#f0b88f] ${
                activeTab === 'weather'
                  ? 'bg-[#f0b88f] text-[#141720]'
                  : 'text-[#cbc5bc] hover:bg-white/8 hover:text-white'
              }`}
            >
              <CloudRain className="h-3.5 w-3.5" />
              <span>Weather & Water</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'foliage'}
              onClick={() => setActiveTab('foliage')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#f0b88f] ${
                activeTab === 'foliage'
                  ? 'bg-[#f0b88f] text-[#141720]'
                  : 'text-[#cbc5bc] hover:bg-white/8 hover:text-white'
              }`}
            >
              <Flower2 className="h-3.5 w-3.5" />
              <span>Leaves & Air</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'camera'}
              onClick={() => setActiveTab('camera')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#f0b88f] ${
                activeTab === 'camera'
                  ? 'bg-[#f0b88f] text-[#141720]'
                  : 'text-[#cbc5bc] hover:bg-white/8 hover:text-white'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Camera</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onReset}
            aria-label="Reset scene defaults"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/12 px-2.5 py-1 text-xs font-medium text-[#d8d2c9] whitespace-nowrap shrink-0 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-[#f0b88f]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Active Tab Controls */}
        {activeTab === 'lighting' && (
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-wrap items-center gap-1">
              {TIME_PRESETS.map((preset) => {
                const active = isTimeActive(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onUpdate({
                        timeOfDay: timePresetToHour(preset.id),
                        autoCycleTime: false,
                      })
                    }
                    className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#f0b88f] ${
                      active
                        ? 'bg-white/18 text-white'
                        : 'bg-white/5 text-[#bcb6ad] hover:bg-white/12 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-1 items-center gap-3">
              <label
                htmlFor="time-of-day-slider"
                className="text-xs font-medium text-[#d2ccc3] whitespace-nowrap shrink-0"
              >
                Time
              </label>
              <input
                id="time-of-day-slider"
                type="range"
                min={0}
                max={24}
                step={0.05}
                value={settings.timeOfDay}
                onChange={(e) =>
                  onUpdate({
                    timeOfDay: parseFloat(e.target.value),
                    autoCycleTime: false,
                  })
                }
                className="scene-slider w-full min-w-[110px]"
              />
              <span className="font-mono-tabular min-w-[110px] text-right text-xs text-[#f0b88f] whitespace-nowrap shrink-0">
                {hourFormatted} · {phaseLabel}
              </span>
              <button
                type="button"
                aria-pressed={settings.autoCycleTime}
                aria-label={settings.autoCycleTime ? 'Pause time cycle' : 'Play time cycle'}
                onClick={() => onUpdate({ autoCycleTime: !settings.autoCycleTime })}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#f0b88f] ${
                  settings.autoCycleTime
                    ? 'bg-[#f0b88f] text-[#141720]'
                    : 'bg-white/8 text-[#dcd6cd] hover:bg-white/14'
                }`}
              >
                {settings.autoCycleTime ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                <span>Cycle</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'weather' && (
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex flex-wrap items-center gap-1">
              {WEATHER_PRESETS.map((preset) => {
                const active = settings.weather === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onUpdate({ weather: preset.id })}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#f0b88f] ${
                      active
                        ? 'bg-white/18 text-white'
                        : 'bg-white/5 text-[#bcb6ad] hover:bg-white/12 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-1 flex-wrap items-center gap-4 sm:flex-nowrap">
              <div className="flex flex-1 items-center gap-2">
                <Wind className="h-3.5 w-3.5 shrink-0 text-[#c9c2b8]" />
                <label
                  htmlFor="wind-speed-slider"
                  className="text-xs font-medium text-[#d2ccc3] whitespace-nowrap shrink-0"
                >
                  Wind
                </label>
                <input
                  id="wind-speed-slider"
                  type="range"
                  min={0}
                  max={2.2}
                  step={0.05}
                  value={settings.windSpeed}
                  onChange={(e) => onUpdate({ windSpeed: parseFloat(e.target.value) })}
                  className="scene-slider w-full min-w-[75px]"
                />
                <span className="font-mono-tabular w-9 text-right text-xs text-[#f0b88f]">
                  {settings.windSpeed.toFixed(1)}
                </span>
              </div>

              <div className="flex flex-1 items-center gap-2">
                <label
                  htmlFor="water-ripple-slider"
                  className="text-xs font-medium text-[#d2ccc3] whitespace-nowrap shrink-0"
                >
                  Water Ripples
                </label>
                <input
                  id="water-ripple-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={settings.waterRipple}
                  onChange={(e) => onUpdate({ waterRipple: parseFloat(e.target.value) })}
                  className="scene-slider w-full min-w-[75px]"
                />
                <span className="font-mono-tabular w-9 text-right text-xs text-[#f0b88f]">
                  {Math.round(settings.waterRipple * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'foliage' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
            <div className="flex items-center gap-3">
              <label
                htmlFor="leaf-density-slider"
                className="text-xs font-medium text-[#d2ccc3] whitespace-nowrap shrink-0"
              >
                Drifting Leaves
              </label>
              <input
                id="leaf-density-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.leafDensity}
                onChange={(e) => onUpdate({ leafDensity: parseFloat(e.target.value) })}
                className="scene-slider w-full"
              />
              <span className="font-mono-tabular w-10 text-right text-xs text-[#f0b88f]">
                {Math.round(settings.leafDensity * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label
                htmlFor="mist-density-slider"
                className="text-xs font-medium text-[#d2ccc3] whitespace-nowrap shrink-0"
              >
                Lake Mist & Air
              </label>
              <input
                id="mist-density-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.mistDensity}
                onChange={(e) => onUpdate({ mistDensity: parseFloat(e.target.value) })}
                className="scene-slider w-full"
              />
              <span className="font-mono-tabular w-10 text-right text-xs text-[#f0b88f]">
                {Math.round(settings.mistDensity * 100)}%
              </span>
            </div>
          </div>
        )}

        {activeTab === 'camera' && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {CAMERA_PRESETS.map((preset) => {
                const active = settings.cameraPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectCamera(preset.id)}
                    className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#f0b88f] ${
                      active
                        ? 'bg-white/18 text-white'
                        : 'bg-white/5 text-[#bcb6ad] hover:bg-white/12 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#9c968d]">
              Drag to orbit · Scroll to zoom · Press H to toggle dock
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
