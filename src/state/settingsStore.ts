import { createStore, type StoreApi } from 'zustand/vanilla';
import { DEFAULT_SETTINGS, type ColorPreset, type Settings } from '@/core/models/settings';
import { notImplemented } from '@/core/not-implemented';
import type { SettingsRepository } from '@/core/ports/repositories';

export interface SettingsStoreState {
  settings: Settings;
  /** 同步读取持久化设置。bootstrap 在首次渲染前调用。 */
  hydrate(): void;
  setAppearance(patch: Partial<Settings['appearance']>): void;
  applyColorPreset(preset: Exclude<ColorPreset, 'custom'>): void;
  setDisplay(patch: Partial<Settings['display']>): void;
  setGuide(patch: Partial<Settings['display']['guide']>): void;
  /** 只接受 countdownSec / resumeDelayMs；speedLevel 只能由 persistSpeedLevel 写入（D-08）。 */
  setPlayback(patch: Partial<Omit<Settings['playback'], 'speedLevel'>>): void;
  /** 仅供 PlaybackEffects.onSpeedLevelChanged 调用。 */
  persistSpeedLevel(level: number): void;
  /** 镜像状态归 settings 所有（D-08）。 */
  toggleMirror(axis: 'x' | 'y'): void;
  resetToDefaults(): void;
}

export type SettingsStore = StoreApi<SettingsStoreState>;

export interface SettingsStoreDeps {
  repository: SettingsRepository;
}

/** 规格见 docs/dev/modules/state-settings.md */
export function createSettingsStore(_deps: SettingsStoreDeps): SettingsStore {
  return createStore<SettingsStoreState>(() => ({
    settings: DEFAULT_SETTINGS,
    hydrate: () => notImplemented('settingsStore.hydrate'),
    setAppearance: () => notImplemented('settingsStore.setAppearance'),
    applyColorPreset: () => notImplemented('settingsStore.applyColorPreset'),
    setDisplay: () => notImplemented('settingsStore.setDisplay'),
    setGuide: () => notImplemented('settingsStore.setGuide'),
    setPlayback: () => notImplemented('settingsStore.setPlayback'),
    persistSpeedLevel: () => notImplemented('settingsStore.persistSpeedLevel'),
    toggleMirror: () => notImplemented('settingsStore.toggleMirror'),
    resetToDefaults: () => notImplemented('settingsStore.resetToDefaults'),
  }));
}

export const FONT_STACKS: Record<Settings['appearance']['fontFamily'], string> = {
  sans: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  serif: '"Songti SC", "Noto Serif CJK SC", SimSun, serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

/** 设置 → CSS 变量的唯一映射。变量名与 styles/tokens.css 保持一致。 */
export function settingsToCssVars(settings: Settings): Record<string, string> {
  const { appearance, display } = settings;
  return {
    '--wtp-font-size': `${appearance.fontSizePx}px`,
    '--wtp-line-height': String(appearance.lineHeight),
    '--wtp-font-family': FONT_STACKS[appearance.fontFamily],
    '--wtp-fg': appearance.fgColor,
    '--wtp-bg': appearance.bgColor,
    '--wtp-padding-x': `${appearance.paddingXPercent}%`,
    '--wtp-guide-position': `${display.guide.positionPercent}%`,
    '--wtp-guide-opacity': String(display.guide.opacity),
  };
}
