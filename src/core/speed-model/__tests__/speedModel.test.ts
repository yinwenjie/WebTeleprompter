import { describe, expect, it } from 'vitest';
import {
  clampSpeedLevel,
  countReadingUnits,
  estimateReadingMs,
  estimateRemainingMs,
  levelToUnitsPerMinute,
  toPxPerSec,
} from '..';

const totalMs = (contentHeightPx: number, readingUnits: number, level = 3) =>
  (contentHeightPx / toPxPerSec(level, { contentHeightPx, readingUnits, locale: 'zh-CN' })) * 1000;

// 规格：docs/dev/modules/core-speed-model.md
describe('speedModel', () => {
  it('3 档中文约 200 字/分钟，落在规划 180–220 区间', () => {
    const upm = levelToUnitsPerMinute(3, 'zh-CN');
    expect(upm).toBe(200);
    expect(estimateReadingMs(200, 3, 'zh-CN')).toBeCloseTo(60_000, 6);
  });

  it('档位与单位/分钟成正比', () => {
    expect(levelToUnitsPerMinute(6, 'zh-CN')).toBeCloseTo(2 * levelToUnitsPerMinute(3, 'zh-CN'));
    expect(levelToUnitsPerMinute(1, 'zh-CN')).toBeCloseTo(66.67, 1);
    expect(levelToUnitsPerMinute(10, 'zh-CN')).toBeCloseTo(666.67, 1);
  });

  it('clampSpeedLevel 夹到 1–10 并吸附到 0.5', () => {
    expect(clampSpeedLevel(0)).toBe(1);
    expect(clampSpeedLevel(42)).toBe(10);
    expect(clampSpeedLevel(3.2)).toBe(3);
    expect(clampSpeedLevel(3.3)).toBe(3.5);
    expect(clampSpeedLevel(Number.NaN)).toBe(3);
    expect(clampSpeedLevel(Number.POSITIVE_INFINITY)).toBe(3);
  });

  it('8-6：长段落换行场景，字号 40 → 80（高度 ×4）全文时长不变', () => {
    const before = totalMs(10_000, 5_000);
    const after = totalMs(40_000, 5_000);
    expect(Math.abs(after - before) / before).toBeLessThan(1e-9);
  });

  it('8-6：短行不换行场景，字号 40 → 80（高度 ×2）全文时长不变', () => {
    const before = totalMs(6_000, 1_200);
    const after = totalMs(12_000, 1_200);
    expect(Math.abs(after - before) / before).toBeLessThan(1e-9);
  });

  it('countReadingUnits：中文按字，拉丁文按词，忽略空白与标点，混排相加', () => {
    expect(countReadingUnits('你好，world 2024！', 'zh-CN')).toBe(4);
    expect(countReadingUnits('Hello, brave new world.', 'zh-CN')).toBe(4);
    expect(countReadingUnits('  。，！\n', 'zh-CN')).toBe(0);
    expect(countReadingUnits('ひらがなカタカナ한글', 'zh-CN')).toBe(10);
    expect(countReadingUnits('abc中文def', 'zh-CN')).toBe(4);
  });

  it('countReadingUnits：5 万字符单次扫描足够快', () => {
    const text = '提词器测试 hello world，'.repeat(3000);
    const t0 = performance.now();
    countReadingUnits(text, 'zh-CN');
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it('readingUnits 为 0 时 toPxPerSec 返回 0', () => {
    expect(toPxPerSec(3, { contentHeightPx: 1000, readingUnits: 0, locale: 'zh-CN' })).toBe(0);
    expect(toPxPerSec(3, { contentHeightPx: 0, readingUnits: 10, locale: 'zh-CN' })).toBe(0);
    expect(estimateReadingMs(0, 3, 'zh-CN')).toBe(0);
  });

  it('estimateRemainingMs 在速度为 0 时返回 null，到达末尾时返回 0', () => {
    expect(estimateRemainingMs(1000, 0, 0)).toBeNull();
    expect(estimateRemainingMs(1000, 1000, 50)).toBe(0);
    expect(estimateRemainingMs(1000, 1200, 50)).toBe(0);
    expect(estimateRemainingMs(1000, 500, 50)).toBe(10_000);
  });
});
