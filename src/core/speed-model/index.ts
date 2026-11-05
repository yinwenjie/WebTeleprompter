import type { Locale } from '../models/settings';

export const SPEED_LEVEL_MIN = 1;
export const SPEED_LEVEL_MAX = 10;
export const SPEED_LEVEL_STEP = 0.5;
export const SPEED_LEVEL_DEFAULT = 3;

/** 3 档 ≈ 中文口播 200 字/分钟（规划 §3.2 的 180–220 区间中值）。 */
export const UNITS_PER_MINUTE_AT_DEFAULT_LEVEL: Record<Locale, number> = {
  'zh-CN': 200,
};

/**
 * 决定语速的布局事实。D-02：速度由实测内容高度反推，不估算字宽，
 * 因此“每分钟读多少字”天然不受字号、行距、边距、换行影响。
 */
export interface SpeedContext {
  contentHeightPx: number;
  readingUnits: number;
  locale: Locale;
}

/** 夹到 [MIN, MAX] 并吸附到 STEP。 */
export function clampSpeedLevel(level: number): number {
  if (!Number.isFinite(level)) return SPEED_LEVEL_DEFAULT;
  const snapped = Math.round(level / SPEED_LEVEL_STEP) * SPEED_LEVEL_STEP;
  return Math.min(SPEED_LEVEL_MAX, Math.max(SPEED_LEVEL_MIN, snapped));
}

/** 档位 → 阅读单位/分钟，与档位成正比。 */
export function levelToUnitsPerMinute(level: number, locale: Locale): number {
  return (UNITS_PER_MINUTE_AT_DEFAULT_LEVEL[locale] * level) / SPEED_LEVEL_DEFAULT;
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** 统计阅读单位：CJK 每字 1 个，拉丁文每词 1 个，忽略空白与标点。单次扫描。 */
export function countReadingUnits(text: string, _locale: Locale): number {
  let units = 0;
  let inWord = false;
  for (const ch of text) {
    if (CJK.test(ch)) {
      units += 1;
      inWord = false;
    } else if (WORD_CHAR.test(ch)) {
      if (!inWord) units += 1;
      inWord = true;
    } else {
      inWord = false;
    }
  }
  return units;
}

function totalReadingSec(readingUnits: number, level: number, locale: Locale): number {
  return (readingUnits / levelToUnitsPerMinute(level, locale)) * 60;
}

/** 核心公式：px/s = contentHeightPx ÷ 总阅读秒数。readingUnits 为 0 时返回 0。 */
export function toPxPerSec(level: number, context: SpeedContext): number {
  if (context.readingUnits <= 0 || context.contentHeightPx <= 0) return 0;
  return context.contentHeightPx / totalReadingSec(context.readingUnits, level, context.locale);
}

/** 编辑区底部的预估时长，不依赖布局。 */
export function estimateReadingMs(readingUnits: number, level: number, locale: Locale): number {
  if (readingUnits <= 0) return 0;
  return totalReadingSec(readingUnits, level, locale) * 1000;
}

/** (contentHeightPx − positionPx) ÷ speed；速度为 0 时返回 null。 */
export function estimateRemainingMs(
  contentHeightPx: number,
  positionPx: number,
  speedPxPerSec: number,
): number | null {
  if (!(speedPxPerSec > 0)) return null;
  return Math.max(0, ((contentHeightPx - positionPx) / speedPxPerSec) * 1000);
}
