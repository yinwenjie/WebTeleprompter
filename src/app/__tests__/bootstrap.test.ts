// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/models/settings';
import { messageKeysWithPrefix } from '@/i18n';
import { DEFAULT_KEYMAP } from '@/platform/input/keymap';
import { createDisplayStore } from '@/state/displayStore';
import { createSettingsStore } from '@/state/settingsStore';
import { FakeClock } from '@/core/testing/fakes';
import { createContainer } from '../bootstrap';
import { bindRootStyles } from '../rootStyles';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('createContainer', () => {
  it('完成装配和启动，且没有骨架告警', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const container = createContainer(document.documentElement);
    const stop = container.start();
    expect(container.stores.playback.getState().mode).toBe('edit');
    expect(warn).not.toHaveBeenCalled();
    stop();
  });

  it('控制器的初始语速来自持久化设置', () => {
    localStorage.setItem(
      'wtp.settings',
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        playback: { ...DEFAULT_SETTINGS.playback, speedLevel: 6 },
      }),
    );
    const container = createContainer(document.documentElement);
    const stop = container.start();
    expect(container.stores.playback.getState().speedLevel).toBe(6);
    stop();
  });

  it('编辑态拦截器生效：编辑态 toggle 被丢弃，speed.set 放行', () => {
    const container = createContainer(document.documentElement);
    const stop = container.start();
    const { dispatch } = container.stores.playback.getState();
    expect(dispatch({ type: 'toggle' })).toBe(false);
    expect(dispatch({ type: 'speed.set', level: 4 })).toBe(true);
    expect(container.stores.settings.getState().settings.playback.speedLevel).toBe(4);
    stop();
  });
});

describe('bindRootStyles', () => {
  it('写入 CSS 变量和模式 class，只在变化时写', () => {
    const root = document.createElement('div');
    const settings = createSettingsStore({
      repository: { load: () => DEFAULT_SETTINGS, save: () => {} },
    });
    const display = createDisplayStore({
      fullscreen: {
        mode: 'none',
        enter: async () => 'fallback',
        exit: async () => {},
        onChange: () => () => {},
      },
      wakeLock: {
        status: 'inactive',
        acquire: async () => 'active',
        release: async () => {},
        onChange: () => () => {},
      },
      clock: new FakeClock(),
    });
    const stop = bindRootStyles(root, settings, display);
    expect(root.style.getPropertyValue('--wtp-font-size')).toBe('48px');
    expect(root.classList.contains('vp-desktop')).toBe(true);
    const setProperty = vi.spyOn(root.style, 'setProperty');
    settings.getState().setAppearance({ fontSizePx: 60 });
    expect(root.style.getPropertyValue('--wtp-font-size')).toBe('60px');
    expect(setProperty).toHaveBeenCalledTimes(1);
    display.getState().setFullscreenMode('fallback');
    display.getState().toggleClean();
    display.getState().setViewportClass('phone');
    display.setState({ controlsVisible: false });
    expect([...root.classList].sort()).toEqual(
      [
        'is-clean',
        'is-controls-hidden',
        'is-fullscreen',
        'is-fullscreen-fallback',
        'vp-phone',
      ].sort(),
    );
    settings.getState().toggleMirror('x');
    expect(root.className).not.toMatch(/mirror/);
    stop();
    expect(root.classList.length).toBe(0);
  });
});

describe('ShortcutHelp 词典', () => {
  it('help.key.* 与 DEFAULT_KEYMAP 一一对应，每个键都有说明', () => {
    const toLabel = (key: string) => (key === ' ' ? 'Space' : key);
    const fromKeymap = Object.keys(DEFAULT_KEYMAP).map(toLabel).sort();
    const fromLocale = messageKeysWithPrefix('help.key.')
      .map((k) => k.slice('help.key.'.length))
      .sort();
    expect(fromLocale).toEqual(fromKeymap);
    const actions = messageKeysWithPrefix('help.action.')
      .map((k) => k.slice('help.action.'.length))
      .sort();
    expect(actions).toEqual(fromKeymap);
  });
});
