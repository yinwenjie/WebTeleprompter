// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { COLOR_PRESETS, DEFAULT_SETTINGS, type Settings } from '@/core/models/settings';
import type { SettingsRepository } from '@/core/ports/repositories';
import { StorageError } from '@/core/ports/repositories';
import { createSettingsStore, settingsToCssVars } from '../settingsStore';

class MemorySettingsRepository implements SettingsRepository {
  stored: Settings | null = null;
  saves = 0;
  fail = false;
  load(): Settings {
    return this.stored ?? DEFAULT_SETTINGS;
  }
  save(settings: Settings): void {
    if (this.fail) throw new StorageError('quota', 'full');
    this.saves += 1;
    this.stored = settings;
  }
}

function setup() {
  const repository = new MemorySettingsRepository();
  const store = createSettingsStore({ repository });
  return { repository, store, s: () => store.getState().settings };
}

const ROOT = resolve(__dirname, '../../..');

// 规格：docs/dev/modules/state-settings.md
describe('settingsStore', () => {
  it('hydrate 同步读取仓储', () => {
    const { repository, store, s } = setup();
    repository.stored = {
      ...DEFAULT_SETTINGS,
      locale: 'zh-CN',
      appearance: { ...DEFAULT_SETTINGS.appearance, fontSizePx: 90 },
    };
    store.getState().hydrate();
    expect(s().appearance.fontSizePx).toBe(90);
  });

  it('每次修改都夹取范围并同步写仓储', () => {
    const { repository, store, s } = setup();
    store.getState().setAppearance({ fontSizePx: 500, lineHeight: 1.8 });
    expect(s().appearance.fontSizePx).toBe(120);
    expect(s().appearance.lineHeight).toBe(1.8);
    expect(repository.stored).toEqual(s());
    store.getState().setGuide({ positionPercent: -10 });
    expect(s().display.guide.positionPercent).toBe(5);
    store.getState().setDisplay({ showProgressInClean: false });
    expect(repository.stored!.display.showProgressInClean).toBe(false);
    store.getState().setPlayback({ countdownSec: 42 });
    expect(s().playback.countdownSec).toBe(10);
    expect(repository.saves).toBe(4);
  });

  it('手动改颜色时 preset 变 custom；applyColorPreset 写入预设色', () => {
    const { store, s } = setup();
    store.getState().setAppearance({ fgColor: '#123456' });
    expect(s().appearance).toMatchObject({ fgColor: '#123456', preset: 'custom' });
    store.getState().applyColorPreset('white-black');
    expect(s().appearance).toMatchObject({
      ...COLOR_PRESETS['white-black'],
      preset: 'white-black',
    });
    store.getState().setAppearance({ fontSizePx: 60 });
    expect(s().appearance.preset).toBe('white-black');
    store.getState().setAppearance({ bgColor: '#111111', preset: 'black-white' });
    expect(s().appearance.preset).toBe('black-white');
  });

  it('D-08：toggleMirror 切换并持久化', () => {
    const { repository, store, s } = setup();
    store.getState().toggleMirror('x');
    expect(s().display.mirrorX).toBe(true);
    expect(repository.stored!.display.mirrorX).toBe(true);
    store.getState().toggleMirror('y');
    store.getState().toggleMirror('x');
    expect(s().display).toMatchObject({ mirrorX: false, mirrorY: true });
  });

  it('D-08：setPlayback 不接受 speedLevel，只有 persistSpeedLevel 能写', () => {
    const { store, s } = setup();
    store.getState().setPlayback({ speedLevel: 9, resumeDelayMs: 500 } as never);
    expect(s().playback.speedLevel).toBe(DEFAULT_SETTINGS.playback.speedLevel);
    expect(s().playback.resumeDelayMs).toBe(500);
    store.getState().persistSpeedLevel(6.5);
    expect(s().playback.speedLevel).toBe(6.5);
  });

  it('resetToDefaults 恢复全部默认值（控制器的语速由 UI 随后发 speed.set 同步）', () => {
    const { repository, store, s } = setup();
    store.getState().setAppearance({ fontSizePx: 100 });
    store.getState().toggleMirror('x');
    store.getState().persistSpeedLevel(8);
    store.getState().resetToDefaults();
    expect(s()).toEqual(DEFAULT_SETTINGS);
    expect(repository.stored).toEqual(DEFAULT_SETTINGS);
  });

  it('写入失败时内存状态仍生效', () => {
    const { repository, store, s } = setup();
    repository.fail = true;
    expect(() => store.getState().setAppearance({ fontSizePx: 70 })).not.toThrow();
    expect(s().appearance.fontSizePx).toBe(70);
    repository.fail = false;
    store.getState().setAppearance({ lineHeight: 1.3 });
    expect(repository.stored!.appearance).toMatchObject({ fontSizePx: 70, lineHeight: 1.3 });
  });

  it('settingsToCssVars 输出的变量名都在 tokens.css 中定义', () => {
    const tokens = readFileSync(resolve(ROOT, 'src/styles/tokens.css'), 'utf8');
    const defined = new Set([...tokens.matchAll(/(--wtp-[\w-]+)\s*:/g)].map((m) => m[1]));
    const vars = settingsToCssVars(DEFAULT_SETTINGS);
    for (const name of Object.keys(vars)) expect(defined).toContain(name);
    for (const [name, value] of Object.entries(vars)) {
      const declared = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(tokens)?.[1]?.trim();
      expect(declared?.replace(/'/g, '"')).toBe(value);
    }
  });

  it('index.html 内联脚本与 settingsToCssVars 的结果一致', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    expect(script).toBeTruthy();
    const samples: Settings[] = [
      DEFAULT_SETTINGS,
      {
        ...DEFAULT_SETTINGS,
        appearance: {
          ...DEFAULT_SETTINGS.appearance,
          fontSizePx: 72,
          lineHeight: 1.8,
          fontFamily: 'mono',
          fgColor: '#abcdef',
          bgColor: '#010203',
          paddingXPercent: 15,
        },
        display: {
          ...DEFAULT_SETTINGS.display,
          guide: { style: 'line', positionPercent: 50, opacity: 0.75 },
        },
      },
      { ...DEFAULT_SETTINGS, appearance: { ...DEFAULT_SETTINGS.appearance, fontFamily: 'serif' } },
    ];
    for (const settings of samples) {
      document.documentElement.removeAttribute('style');
      localStorage.setItem('wtp.settings', JSON.stringify(settings));
      new Function(script!)();
      const style = document.documentElement.style;
      for (const [name, value] of Object.entries(settingsToCssVars(settings))) {
        expect(style.getPropertyValue(name), name).toBe(value);
      }
    }
  });

  it('index.html 内联脚本在数据损坏或 localStorage 抛错时不抛错', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
    localStorage.setItem('wtp.settings', '{oops');
    expect(() => new Function(script)()).not.toThrow();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => new Function(script)()).not.toThrow();
    vi.restoreAllMocks();
  });
});
