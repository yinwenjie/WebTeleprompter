import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  COLOR_PRESETS,
  DEFAULT_SETTINGS,
  normalizeSettings,
  type ColorPreset,
  type Settings,
} from '@/core/models/settings';
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
export function createSettingsStore({ repository }: SettingsStoreDeps): SettingsStore {
  return createStore<SettingsStoreState>((set, get) => {
    /** 合并 → normalize → 写 state → 保存。保存失败时内存状态仍然生效（设置丢失不算事故）。 */
    const commit = (next: Settings) => {
      const settings = normalizeSettings(next);
      set({ settings });
      try {
        repository.save(settings);
      } catch {
        // 下次修改时会再次尝试写入。
      }
    };
    const current = () => get().settings;

    return {
      settings: DEFAULT_SETTINGS,
      hydrate: () => set({ settings: repository.load() }),
      setAppearance: (patch) => {
        const colorChanged = 'fgColor' in patch || 'bgColor' in patch;
        const preset = patch.preset ?? (colorChanged ? 'custom' : current().appearance.preset);
        commit({ ...current(), appearance: { ...current().appearance, ...patch, preset } });
      },
      applyColorPreset: (preset) =>
        commit({
          ...current(),
          appearance: { ...current().appearance, ...COLOR_PRESETS[preset], preset },
        }),
      setDisplay: (patch) => commit({ ...current(), display: { ...current().display, ...patch } }),
      setGuide: (patch) =>
        commit({
          ...current(),
          display: { ...current().display, guide: { ...current().display.guide, ...patch } },
        }),
      setPlayback: (patch) => {
        const { countdownSec, resumeDelayMs } = patch;
        const playback = { ...current().playback };
        if (countdownSec !== undefined) playback.countdownSec = countdownSec;
        if (resumeDelayMs !== undefined) playback.resumeDelayMs = resumeDelayMs;
        commit({ ...current(), playback });
      },
      persistSpeedLevel: (level) =>
        commit({ ...current(), playback: { ...current().playback, speedLevel: level } }),
      toggleMirror: (axis) => {
        const key = axis === 'x' ? 'mirrorX' : 'mirrorY';
        commit({ ...current(), display: { ...current().display, [key]: !current().display[key] } });
      },
      resetToDefaults: () => commit(DEFAULT_SETTINGS),
    };
  });
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
