import { describe, expect, it } from 'vitest';
import { createExportBundle, parseExportBundle, resolveImportConflicts } from '../export-bundle';
import { createScript, splitParagraphs, validateScript, withContent } from '../script';
import {
  COLOR_PRESETS,
  DEFAULT_SETTINGS,
  SETTINGS_LIMITS,
  contrastRatio,
  normalizeSettings,
} from '../settings';

// 规格：docs/dev/modules/core-models.md
describe('Script', () => {
  it('createScript 计算 charCount，初始进度为 0', () => {
    const script = createScript({ id: 'a', title: 't', content: '你好 world\n😀', now: 5 });
    expect(script.charCount).toBe(8);
    expect(script.lastProgress).toBe(0);
    expect(script.lastPositionPx).toBe(0);
    expect(script.createdAt).toBe(5);
    expect(script.updatedAt).toBe(5);
    expect(script.schemaVersion).toBe(1);
  });

  it('withContent 更新 charCount 与 updatedAt，不改 createdAt 和播放进度', () => {
    const base = {
      ...createScript({ id: 'a', title: 't', content: 'ab', now: 1 }),
      lastProgress: 0.5,
      lastPositionPx: 40,
    };
    const next = withContent(base, 'abc d', 9);
    expect(next).not.toBe(base);
    expect(base.content).toBe('ab');
    expect(next).toMatchObject({
      content: 'abc d',
      charCount: 4,
      updatedAt: 9,
      createdAt: 1,
      lastProgress: 0.5,
      lastPositionPx: 40,
    });
  });

  it('validateScript 补齐缺失字段，拒绝缺 id 或 content 不是字符串的数据', () => {
    const ok = validateScript({ id: 'x', content: 'hi', lastProgress: 3, createdAt: Number.NaN });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value).toMatchObject({
        id: 'x',
        title: '',
        createdAt: 0,
        updatedAt: 0,
        lastProgress: 1,
        charCount: 2,
      });
    }
    expect(validateScript({ content: 'x' }).ok).toBe(false);
    expect(validateScript({ id: '', content: 'x' }).ok).toBe(false);
    expect(validateScript({ id: 'x', content: 3 }).ok).toBe(false);
    expect(validateScript(null).ok).toBe(false);
    expect(validateScript('str').ok).toBe(false);
    const negative = validateScript({ id: 'x', content: '', lastProgress: -2 });
    expect(negative.ok && negative.value.lastProgress).toBe(0);
  });

  it('splitParagraphs：空行分段，多个连续空行不产生空段', () => {
    expect(splitParagraphs('第一段\n第一段续\n\n\n  \n第二段\n\n')).toEqual([
      '第一段\n第一段续',
      '第二段',
    ]);
    expect(splitParagraphs('')).toEqual([]);
    expect(splitParagraphs('\n\n  \n')).toEqual([]);
  });

  it('splitParagraphs：全文没有空行时每个非空行算一段', () => {
    expect(splitParagraphs('一\n二\n三')).toEqual(['一', '二', '三']);
    expect(splitParagraphs('单段')).toEqual(['单段']);
  });

  it('splitParagraphs：兼容 \\r\\n', () => {
    expect(splitParagraphs('a\r\nb\r\n\r\nc')).toEqual(['a\nb', 'c']);
    expect(splitParagraphs('a\r\nb')).toEqual(['a', 'b']);
  });
});

describe('Settings', () => {
  it('normalizeSettings 补齐缺失字段，非法输入返回默认值，永不抛错', () => {
    for (const raw of [undefined, null, 42, 'x', [], {}, { appearance: 'bad' }]) {
      expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
    const partial = normalizeSettings({
      appearance: { fontSizePx: 60, fontFamily: 'comic', fgColor: 'red' },
      display: { mirrorX: true, guide: { style: 'line' } },
      locale: 'en',
    });
    expect(partial.appearance.fontSizePx).toBe(60);
    expect(partial.appearance.fontFamily).toBe('sans');
    expect(partial.appearance.fgColor).toBe(DEFAULT_SETTINGS.appearance.fgColor);
    expect(partial.display.mirrorX).toBe(true);
    expect(partial.display.guide).toEqual({ ...DEFAULT_SETTINGS.display.guide, style: 'line' });
    expect(partial.locale).toBe('zh-CN');
  });

  it('normalizeSettings 把越界数值夹到 SETTINGS_LIMITS', () => {
    const s = normalizeSettings({
      appearance: { fontSizePx: 999, lineHeight: 0.1, paddingXPercent: -5 },
      display: { guide: { positionPercent: 200, opacity: 2 } },
      playback: { speedLevel: 7.3, countdownSec: 99, resumeDelayMs: -1 },
    });
    expect(s.appearance.fontSizePx).toBe(SETTINGS_LIMITS.fontSizePx.max);
    expect(s.appearance.lineHeight).toBe(SETTINGS_LIMITS.lineHeight.min);
    expect(s.appearance.paddingXPercent).toBe(SETTINGS_LIMITS.paddingXPercent.min);
    expect(s.display.guide.positionPercent).toBe(SETTINGS_LIMITS.guidePositionPercent.max);
    expect(s.display.guide.opacity).toBe(1);
    expect(s.playback.speedLevel).toBe(7.5);
    expect(s.playback.countdownSec).toBe(10);
    expect(s.playback.resumeDelayMs).toBe(0);
  });

  it('contrastRatio：黑白为 21，三个预设都 ≥ 7:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
    for (const preset of Object.values(COLOR_PRESETS)) {
      expect(contrastRatio(preset.fgColor, preset.bgColor)).toBeGreaterThanOrEqual(7);
    }
  });
});

describe('ExportBundle', () => {
  const script = createScript({ id: 's1', title: '稿', content: '内容', now: 1 });

  it('createExportBundle 组装备份并可被 parseExportBundle 读回', () => {
    const bundle = createExportBundle([script], DEFAULT_SETTINGS, 100);
    const parsed = parseExportBundle(JSON.parse(JSON.stringify(bundle)));
    expect(parsed).toEqual({ ok: true, value: bundle });
  });

  it('parseExportBundle 拒绝 app 字段不匹配的文件', () => {
    expect(parseExportBundle({ app: 'other', schemaVersion: 1, scripts: [] }).ok).toBe(false);
    expect(parseExportBundle(null).ok).toBe(false);
    expect(parseExportBundle({ app: 'webteleprompter', scripts: 'x' }).ok).toBe(false);
    expect(parseExportBundle({ app: 'webteleprompter', schemaVersion: 99, scripts: [] }).ok).toBe(
      false,
    );
  });

  it('损坏的单条稿件不影响其余稿件', () => {
    const parsed = parseExportBundle({
      app: 'webteleprompter',
      schemaVersion: 1,
      exportedAt: 1,
      scripts: [script, { id: 'bad' }, 'junk', { ...script, id: 's2', schemaVersion: 42 }],
      settings: { appearance: { fontSizePx: 1000 } },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.scripts.map((s) => s.id)).toEqual(['s1']);
      expect(parsed.value.settings?.appearance.fontSizePx).toBe(120);
    }
  });

  it('resolveImportConflicts：id 冲突时换新 id 并在标题后加“(导入)”', () => {
    let n = 0;
    const result = resolveImportConflicts(
      [script, { ...script, id: 'fresh' }],
      new Set(['s1']),
      () => `new-${++n}`,
    );
    expect(result[0]).toMatchObject({ id: 'new-1', title: '稿 (导入)' });
    expect(result[1]).toMatchObject({ id: 'fresh', title: '稿' });
    const custom = resolveImportConflicts([script], new Set(['s1']), () => 'z', '(imported)');
    expect(custom[0]!.title).toBe('稿 (imported)');
  });
});
