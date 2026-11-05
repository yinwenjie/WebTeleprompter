import { clampSpeedLevel } from '../speed-model';

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

const MAX_RESUME_DELAY_MS = 5000;
const FONT_FAMILIES: readonly FontFamilyKey[] = ['sans', 'serif', 'mono'];
const PRESETS: readonly ColorPreset[] = ['black-white', 'black-yellow', 'white-black', 'custom'];
const GUIDE_STYLES: readonly GuideStyle[] = ['line', 'band', 'mask'];
const LOCALES: readonly Locale[] = ['zh-CN'];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function num(value: unknown, fallback: number, limits?: { min: number; max: number }): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return limits ? Math.min(limits.max, Math.max(limits.min, value)) : value;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback;
}

/** 用默认值补齐缺失字段，并把数值夹到 SETTINGS_LIMITS 内。永不抛错。 */
export function normalizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  const r = asRecord(raw);
  const appearance = asRecord(r.appearance);
  const display = asRecord(r.display);
  const guide = asRecord(display.guide);
  const playback = asRecord(r.playback);
  const L = SETTINGS_LIMITS;
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    appearance: {
      fontSizePx: num(appearance.fontSizePx, d.appearance.fontSizePx, L.fontSizePx),
      lineHeight: num(appearance.lineHeight, d.appearance.lineHeight, L.lineHeight),
      fontFamily: oneOf(appearance.fontFamily, FONT_FAMILIES, d.appearance.fontFamily),
      fgColor: color(appearance.fgColor, d.appearance.fgColor),
      bgColor: color(appearance.bgColor, d.appearance.bgColor),
      preset: oneOf(appearance.preset, PRESETS, d.appearance.preset),
      paddingXPercent: num(
        appearance.paddingXPercent,
        d.appearance.paddingXPercent,
        L.paddingXPercent,
      ),
    },
    display: {
      mirrorX: bool(display.mirrorX, d.display.mirrorX),
      mirrorY: bool(display.mirrorY, d.display.mirrorY),
      guide: {
        style: oneOf(guide.style, GUIDE_STYLES, d.display.guide.style),
        positionPercent: num(
          guide.positionPercent,
          d.display.guide.positionPercent,
          L.guidePositionPercent,
        ),
        opacity: num(guide.opacity, d.display.guide.opacity, L.guideOpacity),
      },
      showProgressInClean: bool(display.showProgressInClean, d.display.showProgressInClean),
    },
    playback: {
      speedLevel: clampSpeedLevel(num(playback.speedLevel, d.playback.speedLevel)),
      countdownSec: Math.round(num(playback.countdownSec, d.playback.countdownSec, L.countdownSec)),
      resumeDelayMs: num(playback.resumeDelayMs, d.playback.resumeDelayMs, {
        min: 0,
        max: MAX_RESUME_DELAY_MS,
      }),
    },
    locale: oneOf(r.locale, LOCALES, d.locale),
  };
}

function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 对比度。自定义配色低于 4.5:1 时由设置面板提示（架构 §7.3）。非法颜色返回 1。 */
export function contrastRatio(fgColor: string, bgColor: string): number {
  if (!HEX_COLOR.test(fgColor) || !HEX_COLOR.test(bgColor)) return 1;
  const a = relativeLuminance(fgColor);
  const b = relativeLuminance(bgColor);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
