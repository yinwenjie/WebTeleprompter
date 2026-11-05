import type { Locale } from '../models/settings';
import { notImplemented } from '../not-implemented';

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
export function clampSpeedLevel(_level: number): number {
  return notImplemented('speedModel.clampSpeedLevel');
}

/** 档位 → 阅读单位/分钟，与档位成正比。 */
export function levelToUnitsPerMinute(_level: number, _locale: Locale): number {
  return notImplemented('speedModel.levelToUnitsPerMinute');
}

/** 统计阅读单位：CJK 每字 1 个，拉丁文每词 1 个，忽略空白与标点。 */
export function countReadingUnits(_text: string, _locale: Locale): number {
  return notImplemented('speedModel.countReadingUnits');
}

/** 核心公式：px/s = contentHeightPx ÷ 总阅读秒数。readingUnits 为 0 时返回 0。 */
export function toPxPerSec(_level: number, _context: SpeedContext): number {
  return notImplemented('speedModel.toPxPerSec');
}

/** 编辑区底部的预估时长，不依赖布局。 */
export function estimateReadingMs(_readingUnits: number, _level: number, _locale: Locale): number {
  return notImplemented('speedModel.estimateReadingMs');
}

/** (contentHeightPx − positionPx) ÷ speed；速度为 0 时返回 null。 */
export function estimateRemainingMs(
  _contentHeightPx: number,
  _positionPx: number,
  _speedPxPerSec: number,
): number | null {
  return notImplemented('speedModel.estimateRemainingMs');
}
