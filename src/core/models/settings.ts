import { notImplemented } from '../not-implemented';

export const SETTINGS_SCHEMA_VERSION = 1 as const;

export type FontFamilyKey = 'sans' | 'serif' | 'mono';
export type ColorPreset = 'black-white' | 'black-yellow' | 'white-black' | 'custom';
export type GuideStyle = 'line' | 'band' | 'mask';
export type Locale = 'zh-CN';

export interface Settings {
  schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  appearance: {
    fontSizePx: number;
    lineHeight: number;
    fontFamily: FontFamilyKey;
    fgColor: string;
    bgColor: string;
    preset: ColorPreset;
    paddingXPercent: number;
  };
  display: {
    mirrorX: boolean;
    mirrorY: boolean;
    guide: { style: GuideStyle; positionPercent: number; opacity: number };
    showProgressInClean: boolean;
  };
  playback: {
    /** 运行时真值在 PlaybackController，这里只是持久化副本（D-08）。 */
    speedLevel: number;
    countdownSec: number;
    resumeDelayMs: number;
  };
  locale: Locale;
}

export const SETTINGS_LIMITS = {
  fontSizePx: { min: 24, max: 120 },
  lineHeight: { min: 1.2, max: 2.0 },
  paddingXPercent: { min: 0, max: 30 },
  guidePositionPercent: { min: 5, max: 95 },
  guideOpacity: { min: 0, max: 1 },
  countdownSec: { min: 0, max: 10 },
} as const;

export const COLOR_PRESETS: Record<
  Exclude<ColorPreset, 'custom'>,
  { fgColor: string; bgColor: string }
> = {
  'black-white': { fgColor: '#ffffff', bgColor: '#000000' },
  'black-yellow': { fgColor: '#ffe600', bgColor: '#000000' },
  'white-black': { fgColor: '#000000', bgColor: '#ffffff' },
};

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  appearance: {
    fontSizePx: 48,
    lineHeight: 1.5,
    fontFamily: 'sans',
    ...COLOR_PRESETS['black-yellow'],
    preset: 'black-yellow',
    paddingXPercent: 8,
  },
  display: {
    mirrorX: false,
    mirrorY: false,
    guide: { style: 'band', positionPercent: 33, opacity: 0.4 },
    showProgressInClean: true,
  },
  playback: {
    speedLevel: 3,
    countdownSec: 3,
    resumeDelayMs: 300,
  },
  locale: 'zh-CN',
};

/** 用默认值补齐缺失字段，并把数值夹到 SETTINGS_LIMITS 内。永不抛错。 */
export function normalizeSettings(_raw: unknown): Settings {
  return notImplemented('models.normalizeSettings');
}

/** WCAG 对比度。自定义配色低于 4.5:1 时由设置面板提示（架构 §7.3）。 */
export function contrastRatio(_fgColor: string, _bgColor: string): number {
  return notImplemented('models.contrastRatio');
}
