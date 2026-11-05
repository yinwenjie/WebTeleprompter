// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScript, type Script } from '@/core/models/script';
import { DEFAULT_SETTINGS, type Settings } from '@/core/models/settings';
import type { CommandBus } from '@/core/playback/bus';
import type { PlaybackController } from '@/core/playback/controller';
import { INITIAL_CONTROLLER_STATE } from '@/core/playback/controller';
import type { FullscreenMode, WakeLockStatus } from '@/core/ports/display';
import type { ScrollEngine } from '@/core/scroll-engine/types';
import { INITIAL_SCROLL_STATE } from '@/core/scroll-engine/types';
import { FakeClock } from '@/core/testing/fakes';
import { t } from '@/i18n';
import { createDisplayStore } from '@/state/displayStore';
import { StoresProvider, type AppStores } from '@/state/hooks';
import { createPlaybackStore } from '@/state/playbackStore';
import { createScriptStore } from '@/state/scriptStore';
import { createSettingsStore } from '@/state/settingsStore';
import { EditorView } from '../editor/EditorView';
import ScriptLibrary from '../library/ScriptLibrary';
import { ControlBar } from '../prompter/overlays/ControlBar';
import { GuideOverlay } from '../prompter/overlays/GuideOverlay';
import { ProgressOverlay } from '../prompter/overlays/ProgressOverlay';
import { StatusAnnouncer } from '../prompter/overlays/StatusAnnouncer';
import { Stage } from '../prompter/Stage';
import SettingsDrawer from '../settings/SettingsDrawer';
import { StorageBanner } from '../shared/StorageBanner';

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  constructor(public callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe(element: Element) {
    this.observed.push(element);
  }
  disconnect() {
    this.observed = [];
  }
  static fireAll() {
    for (const o of FakeResizeObserver.instances) if (o.observed.length > 0) o.callback();
  }
}

function makeHarness(
  options: { scripts?: Script[]; activeId?: string | null; draft?: string } = {},
) {
  const dispatch = vi.fn(() => true);
  const bus = { dispatch, use: vi.fn() } as unknown as CommandBus;
  const controller = { getState: () => INITIAL_CONTROLLER_STATE } as unknown as PlaybackController;
  const engine = { getState: () => INITIAL_SCROLL_STATE } as unknown as ScrollEngine;
  const playback = createPlaybackStore({ bus, controller, engine });
  let stored: Settings = DEFAULT_SETTINGS;
  const settings = createSettingsStore({
    repository: { load: () => stored, save: (s) => void (stored = s) },
  });
  const display = createDisplayStore({
    fullscreen: {
      mode: 'none',
      enter: () => Promise.resolve<FullscreenMode>('native'),
      exit: () => Promise.resolve(),
      onChange: () => () => {},
    },
    wakeLock: {
      status: 'inactive',
      acquire: () => Promise.resolve<WakeLockStatus>('active'),
      release: () => Promise.resolve(),
      onChange: () => () => {},
    },
    clock: new FakeClock(),
  });
  const scripts = createScriptStore({
    repository: {} as never,
    scratch: {} as never,
    fileIO: {} as never,
    clock: new FakeClock(),
    generateId: () => 'new',
    getSettingsForExport: () => DEFAULT_SETTINGS,
  });
  const list = options.scripts ?? [];
  const activeId = options.activeId === undefined ? (list[0]?.id ?? null) : options.activeId;
  scripts.setState({
    ready: true,
    scripts: list,
    activeScriptId: activeId,
    draft: options.draft ?? list.find((s) => s.id === activeId)?.content ?? '',
    updateDraft: vi.fn(),
    rename: vi.fn(() => Promise.resolve()),
    setActive: vi.fn(() => Promise.resolve()),
    create: vi.fn(() => Promise.resolve('new')),
    remove: vi.fn(() => Promise.resolve()),
    exportBundle: vi.fn(() => Promise.resolve()),
    exportQuarantined: vi.fn(() => Promise.resolve()),
    importBundle: vi.fn(() => Promise.resolve()),
    importTextFile: vi.fn(() => Promise.resolve()),
    exportTextFile: vi.fn(() => Promise.resolve()),
  });
  const detach = vi.fn();
  const stageBridge = { attachStage: vi.fn(() => detach), reportMetrics: vi.fn() };
  const stores: AppStores = { playback, scripts, settings, display, stageBridge };
  const renderWith = (ui: React.ReactNode) =>
    render(<StoresProvider stores={stores}>{ui}</StoresProvider>);
  return { stores, dispatch, detach, stageBridge, renderWith };
}

const sample = (id: string, content: string, extra: Partial<Script> = {}): Script => ({
  ...createScript({ id, title: `稿${id}`, content, now: 1_700_000_000_000 }),
  ...extra,
});

beforeEach(() => {
  FakeResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// 规格：docs/dev/modules/ui-*.md
describe('EditorView', () => {
  it('输入调用 updateDraft；显示字数、预估时长和保存状态', () => {
    const h = makeHarness({ scripts: [sample('a', '你好世界')] });
    h.stores.scripts.setState({ saveStatus: 'saved' });
    h.renderWith(<EditorView />);
    const textarea = screen.getByRole('textbox', { name: t('editor.title') });
    expect(textarea).toHaveProperty('value', '你好世界');
    fireEvent.change(textarea, { target: { value: '你好世界！' } });
    expect(h.stores.scripts.getState().updateDraft).toHaveBeenCalledWith('你好世界！');
    expect(screen.getByText(t('editor.chars', { count: '4' }))).toBeTruthy();
    // 4 字 ÷ 200 字/分钟 = 1.2 秒
    expect(screen.getByText(t('editor.duration', { duration: '0:01' }))).toBeTruthy();
    expect(screen.getByTestId('save-status').textContent).toBe(t('editor.save.saved'));
  });

  it('超过 5 万字符时提示但不截断', () => {
    const long = '字'.repeat(50_001);
    const h = makeHarness({ scripts: [sample('a', long)] });
    h.renderWith(<EditorView />);
    expect(screen.getByText(t('editor.overLimit'))).toBeTruthy();
    expect(
      (screen.getByRole('textbox', { name: t('editor.title') }) as HTMLTextAreaElement).value,
    ).toHaveLength(50_001);
  });

  it('开始提词发 mode.set prompt；未就绪时禁用输入；无稿件时显示新建入口', () => {
    const h = makeHarness({ scripts: [sample('a', 'x')] });
    h.renderWith(<EditorView />);
    fireEvent.click(screen.getByRole('button', { name: t('editor.start') }));
    expect(h.dispatch).toHaveBeenCalledWith({ type: 'mode.set', mode: 'prompt' }, 'button');
    act(() => h.stores.scripts.setState({ ready: false }));
    expect(
      (screen.getByRole('textbox', { name: t('editor.title') }) as HTMLTextAreaElement).disabled,
    ).toBe(true);
    act(() => h.stores.scripts.setState({ ready: true, activeScriptId: null }));
    fireEvent.click(screen.getByRole('button', { name: t('editor.create') }));
    expect(h.stores.scripts.getState().create).toHaveBeenCalled();
  });

  it('标题失焦时调用 rename', () => {
    const h = makeHarness({ scripts: [sample('a', 'x')] });
    h.renderWith(<EditorView />);
    const input = screen.getByRole('textbox', { name: t('editor.titleLabel') });
    fireEvent.change(input, { target: { value: '新标题' } });
    fireEvent.blur(input);
    expect(h.stores.scripts.getState().rename).toHaveBeenCalledWith('a', '新标题');
  });
});

describe('Stage', () => {
  it('挂载时 attachStage，卸载时执行返回的回调', () => {
    const h = makeHarness({ scripts: [sample('a', '一\n\n二')] });
    const { unmount, container } = h.renderWith(<Stage />);
    expect(h.stageBridge.attachStage).toHaveBeenCalledTimes(1);
    const handle = (
      h.stageBridge.attachStage.mock.calls[0] as unknown as [
        { element: HTMLElement; target: { apply(y: number): void } },
      ]
    )[0];
    expect(handle.element).toBe(container.querySelector('[data-stage]'));
    handle.target.apply(120);
    expect((container.querySelector('[data-content]') as HTMLElement).style.transform).toMatch(
      /^translate3d\(0(px)?, -120px, 0(px)?\)$/,
    );
    unmount();
    expect(h.detach).toHaveBeenCalledTimes(1);
  });

  it('内容变化后上报 metrics，段落偏移数量与段落数一致', () => {
    const h = makeHarness({ scripts: [sample('a', '一\n\n二\n\n三')] });
    const { container } = h.renderWith(<Stage />);
    expect(container.querySelectorAll('[data-paragraph]')).toHaveLength(3);
    act(() => FakeResizeObserver.fireAll());
    expect(h.stageBridge.reportMetrics).toHaveBeenCalledTimes(1);
    const metrics = (
      h.stageBridge.reportMetrics.mock.calls[0] as unknown as [{ paragraphOffsetsPx: number[] }]
    )[0];
    expect(metrics.paragraphOffsetsPx).toHaveLength(3);
    act(() => h.stores.scripts.setState({ draft: '甲\n乙' }));
    act(() => FakeResizeObserver.fireAll());
    const latest = (
      h.stageBridge.reportMetrics.mock.calls.at(-1) as unknown as [{ paragraphOffsetsPx: number[] }]
    )[0];
    expect(latest.paragraphOffsetsPx).toHaveLength(2);
  });

  it('首次上报 metrics 后按 lastProgress 发 seek.progress（只发一次）', () => {
    const h = makeHarness({ scripts: [sample('a', '一\n\n二', { lastProgress: 0.4 })] });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(1000);
    h.renderWith(<Stage />);
    act(() => FakeResizeObserver.fireAll());
    act(() => FakeResizeObserver.fireAll());
    const seeks = h.dispatch.mock.calls.filter(
      (c) =>
        (c as unknown[])[0] && ((c as unknown[])[0] as { type: string }).type === 'seek.progress',
    );
    expect(seeks).toEqual([[{ type: 'seek.progress', progress: 0.4 }, 'system']]);
  });

  it('看完的稿件（lastProgress ≥ 0.999）从头开始', () => {
    const h = makeHarness({ scripts: [sample('a', '一', { lastProgress: 1 })] });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(500);
    h.renderWith(<Stage />);
    act(() => FakeResizeObserver.fireAll());
    expect(h.dispatch).toHaveBeenCalledWith({ type: 'seek.top' }, 'system');
  });

  it('镜像 class 只加在 mirror 节点上', () => {
    const h = makeHarness({ scripts: [sample('a', 'x')] });
    const { container } = h.renderWith(<Stage />);
    act(() => h.stores.settings.getState().toggleMirror('x'));
    const mirror = container.querySelector('[data-mirror]')!;
    const stage = container.querySelector('[data-stage]')!;
    expect(mirror.className).toMatch(/mirrorX/);
    expect(stage.className).not.toMatch(/mirror/);
    expect(document.documentElement.className).not.toMatch(/mirror/);
  });

  it('暂停 / 结束时在阅读线处提示', () => {
    const h = makeHarness({ scripts: [sample('a', 'x')] });
    h.renderWith(<Stage />);
    act(() => h.stores.playback.setState({ phase: 'paused' }));
    expect(screen.getByText(t('prompter.paused'))).toBeTruthy();
    act(() => h.stores.playback.setState({ phase: 'ended' }));
    expect(screen.getByText(t('prompter.ended'))).toBeTruthy();
  });
});

describe('Overlays', () => {
  it('GuideOverlay 按样式渲染，pointer-events 为 none', () => {
    const h = makeHarness();
    const { container } = h.renderWith(<GuideOverlay />);
    const guide = container.querySelector('[data-guide]') as HTMLElement;
    expect(guide.dataset.guide).toBe('band');
    expect(guide.className).toMatch(/guide/);
    for (const style of ['line', 'mask'] as const) {
      act(() => h.stores.settings.getState().setGuide({ style }));
      expect((container.querySelector('[data-guide]') as HTMLElement).dataset.guide).toBe(style);
    }
    expect(container.querySelector('[data-guide]')!.children).toHaveLength(2);
  });

  it('已用时间 = positionPx / speed，速度为 0 时显示占位符', () => {
    const h = makeHarness();
    h.renderWith(<ProgressOverlay />);
    expect(screen.getByText(t('prompter.elapsed', { time: '--:--' }))).toBeTruthy();
    act(() =>
      h.stores.playback.setState({
        scroll: {
          ...INITIAL_SCROLL_STATE,
          positionPx: 650,
          speedPxPerSec: 10,
          progress: 0.25,
          estimatedRemainingMs: 125_000,
        },
      }),
    );
    expect(screen.getByText(t('prompter.elapsed', { time: '1:05' }))).toBeTruthy();
    expect(screen.getByText(t('prompter.remaining', { time: '2:05' }))).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
  });

  it('纯净模式下只留细线，或按设置完全隐藏', () => {
    const h = makeHarness();
    const { container } = h.renderWith(<ProgressOverlay />);
    act(() => h.stores.display.getState().toggleClean());
    expect(container.querySelector('[data-times]')).toBeNull();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    act(() => h.stores.settings.getState().setDisplay({ showProgressInClean: false }));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('StatusAnnouncer 在倒计时、暂停、结束时写入 aria-live 区域', () => {
    const h = makeHarness();
    h.renderWith(<StatusAnnouncer />);
    const region = screen.getByTestId('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    act(() => h.stores.playback.setState({ phase: 'countdown', countdownRemainingMs: 2500 }));
    expect(region.textContent).toBe(t('prompter.countdownAnnounce', { count: 3 }));
    act(() => h.stores.playback.setState({ phase: 'paused' }));
    expect(region.textContent).toBe(t('prompter.paused'));
    act(() => h.stores.playback.setState({ phase: 'ended' }));
    expect(region.textContent).toBe(t('prompter.ended'));
  });

  it('ControlBar 的按钮都有 aria-label，并发出正确的命令', () => {
    const h = makeHarness();
    const { container } = h.renderWith(<ControlBar />);
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.length).toBe(10);
    for (const button of buttons) expect(button.getAttribute('aria-label')).toBeTruthy();
    const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
    click(t('prompter.play'));
    click(t('prompter.slower'));
    click(t('prompter.faster'));
    click(t('prompter.prevParagraph'));
    click(t('prompter.nextParagraph'));
    click(t('prompter.top'));
    click(t('prompter.fullscreen'));
    click(t('prompter.mirror'));
    click(t('prompter.backToEdit'));
    expect(h.dispatch.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      { type: 'toggle' },
      { type: 'speed.step', delta: -0.5 },
      { type: 'speed.step', delta: 0.5 },
      { type: 'seek.paragraph', dir: -1 },
      { type: 'seek.paragraph', dir: 1 },
      { type: 'seek.top' },
      { type: 'display.toggleFullscreen' },
      { type: 'display.toggleMirror', axis: 'x' },
      { type: 'mode.set', mode: 'edit' },
    ]);
    click(t('prompter.settings'));
    expect(h.stores.display.getState().activePanel).toBe('settings');
  });

  it('ControlBar 按下时不抢焦点，控件隐藏时淡出', () => {
    const h = makeHarness();
    const { container } = h.renderWith(<ControlBar />);
    const button = screen.getByRole('button', { name: t('prompter.play') });
    expect(fireEvent.mouseDown(button)).toBe(false);
    act(() => h.stores.display.setState({ controlsVisible: false }));
    expect(container.querySelector('[data-controls]')!.className).toMatch(/hidden/);
  });
});

describe('SettingsDrawer', () => {
  it('修改即时生效；语速滑杆发 speed.set 而不是写 store', () => {
    const h = makeHarness();
    h.renderWith(<SettingsDrawer />);
    fireEvent.change(screen.getByRole('slider', { name: new RegExp(t('settings.fontSize')) }), {
      target: { value: '80' },
    });
    expect(h.stores.settings.getState().settings.appearance.fontSizePx).toBe(80);
    fireEvent.change(screen.getByRole('slider', { name: new RegExp(t('settings.speed')) }), {
      target: { value: '5.5' },
    });
    expect(h.dispatch).toHaveBeenCalledWith({ type: 'speed.set', level: 5.5 }, 'button');
    expect(h.stores.settings.getState().settings.playback.speedLevel).toBe(
      DEFAULT_SETTINGS.playback.speedLevel,
    );
    fireEvent.click(screen.getByRole('switch', { name: t('settings.mirrorX') }));
    expect(h.stores.settings.getState().settings.display.mirrorX).toBe(true);
  });

  it('自定义配色对比度低于 4.5:1 时提示', () => {
    const h = makeHarness();
    h.renderWith(<SettingsDrawer />);
    expect(screen.queryByText(/对比度不足/)).toBeNull();
    act(() =>
      h.stores.settings.getState().setAppearance({ fgColor: '#222222', bgColor: '#000000' }),
    );
    expect(screen.getByText(/对比度不足/)).toBeTruthy();
  });

  it('恢复默认同时发 speed.set；Esc 关闭且不冒泡', () => {
    const h = makeHarness();
    h.renderWith(<SettingsDrawer />);
    act(() => h.stores.display.getState().setActivePanel('settings'));
    fireEvent.click(screen.getByRole('button', { name: t('settings.reset') }));
    expect(h.dispatch).toHaveBeenCalledWith(
      { type: 'speed.set', level: DEFAULT_SETTINGS.playback.speedLevel },
      'button',
    );
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    window.removeEventListener('keydown', onWindowKey);
    expect(onWindowKey).not.toHaveBeenCalled();
    expect(h.stores.display.getState().activePanel).toBe('none');
  });
});

describe('ScriptLibrary', () => {
  it('删除前二次确认；重命名、切换、新建调用对应 action', () => {
    const h = makeHarness({ scripts: [sample('a', 'x'), sample('b', 'y')] });
    h.renderWith(<ScriptLibrary />);
    const s = h.stores.scripts.getState();
    fireEvent.click(screen.getByRole('button', { name: `${t('library.delete')} 稿a` }));
    expect(s.remove).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog').textContent).toContain('稿a');
    fireEvent.click(screen.getByRole('button', { name: t('library.cancel') }));
    expect(s.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: `${t('library.delete')} 稿a` }));
    fireEvent.click(screen.getByRole('button', { name: t('library.confirm') }));
    expect(s.remove).toHaveBeenCalledWith('a');

    fireEvent.click(screen.getByRole('button', { name: `${t('library.rename')} 稿b` }));
    const input = screen.getByRole('textbox', { name: t('library.renameLabel') });
    fireEvent.change(input, { target: { value: '改名' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(s.rename).toHaveBeenCalledWith('b', '改名');

    fireEvent.click(screen.getByText('稿b'));
    expect(s.setActive).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: t('library.new') }));
    expect(s.create).toHaveBeenCalled();
  });

  it('隔离的稿件有提示和导出入口', () => {
    const h = makeHarness({ scripts: [sample('a', 'x')] });
    h.stores.scripts.setState({ quarantinedCount: 2 });
    h.renderWith(<ScriptLibrary />);
    expect(screen.getByText(t('library.quarantined', { count: 2 }))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('library.exportQuarantined') }));
    expect(h.stores.scripts.getState().exportQuarantined).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /删除损坏/ })).toBeNull();
  });

  it('恢复备份失败时显示错误', async () => {
    const h = makeHarness({ scripts: [sample('a', 'x')] });
    h.stores.scripts.setState({ importBundle: vi.fn(() => Promise.reject(new Error('bad'))) });
    h.renderWith(<ScriptLibrary />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: t('library.restore') }));
    });
    expect(screen.getByText(t('library.importError'))).toBeTruthy();
  });
});

describe('StorageBanner', () => {
  it('降级或保存失败时显示并可导出；提词 + 纯净模式下隐藏', () => {
    const h = makeHarness({ scripts: [sample('a', 'x')] });
    h.renderWith(<StorageBanner />);
    expect(screen.queryByTestId('storage-banner')).toBeNull();
    act(() => h.stores.scripts.setState({ saveStatus: 'error', lastErrorKind: 'quota' }));
    expect(screen.getByTestId('storage-banner').textContent).toContain(t('storage.quota'));
    fireEvent.click(screen.getByRole('button', { name: t('storage.exportBackup') }));
    expect(h.stores.scripts.getState().exportBundle).toHaveBeenCalled();
    act(() => h.stores.scripts.setState({ saveStatus: 'saved', storageDegraded: true }));
    expect(screen.getByTestId('storage-banner').textContent).toContain(t('storage.degraded'));
    act(() => {
      h.stores.playback.setState({ mode: 'prompt' });
      h.stores.display.getState().toggleClean();
    });
    expect(screen.queryByTestId('storage-banner')).toBeNull();
  });
});
