import { describe, expect, it, vi } from 'vitest';
import type { CommandBus } from '@/core/playback/bus';
import type { PlaybackController, PlaybackControllerState } from '@/core/playback/controller';
import { INITIAL_CONTROLLER_STATE } from '@/core/playback/controller';
import type {
  FullscreenMode,
  FullscreenPort,
  WakeLockPort,
  WakeLockStatus,
} from '@/core/ports/display';
import type { ScrollEngine, ScrollState } from '@/core/scroll-engine/types';
import { INITIAL_SCROLL_STATE } from '@/core/scroll-engine/types';
import { FakeClock } from '@/core/testing/fakes';
import { CONTROLS_AUTO_HIDE_MS, createDisplayStore } from '../displayStore';
import { connectPlaybackStore, createPlaybackStore } from '../playbackStore';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeController() {
  let state: PlaybackControllerState = { ...INITIAL_CONTROLLER_STATE };
  const listeners = new Set<(s: PlaybackControllerState) => void>();
  return {
    emit(patch: Partial<PlaybackControllerState>) {
      state = { ...state, ...patch };
      listeners.forEach((l) => l(state));
    },
    getState: () => state,
    subscribe(listener: (s: PlaybackControllerState) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as PlaybackController & { emit(patch: Partial<PlaybackControllerState>): void };
}

function fakeEngine() {
  let state: ScrollState = { ...INITIAL_SCROLL_STATE };
  const listeners = new Set<(s: ScrollState) => void>();
  return {
    emit(patch: Partial<ScrollState>) {
      state = { ...state, ...patch };
      listeners.forEach((l) => l(state));
    },
    getState: () => state,
    subscribe(listener: (s: ScrollState) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as ScrollEngine & { emit(patch: Partial<ScrollState>): void };
}

// 规格：docs/dev/modules/state-display-playback.md
describe('playbackStore', () => {
  function setup() {
    const bus = { dispatch: vi.fn(() => true), use: vi.fn() } as unknown as CommandBus;
    const controller = fakeController();
    const engine = fakeEngine();
    const store = createPlaybackStore({ bus, controller, engine });
    return { bus, controller, engine, store };
  }

  it('connect 后镜像 controller 状态和 engine 的 ScrollState', () => {
    const { controller, engine, store } = setup();
    controller.emit({ mode: 'prompt' });
    engine.emit({ positionPx: 12 });
    expect(store.getState().mode).toBe('edit');
    connectPlaybackStore(store, { controller, engine });
    expect(store.getState().mode).toBe('prompt');
    expect(store.getState().scroll.positionPx).toBe(12);
    controller.emit({ phase: 'playing', speedLevel: 4 });
    engine.emit({ positionPx: 50, progress: 0.5 });
    expect(store.getState()).toMatchObject({ phase: 'playing', speedLevel: 4 });
    expect(store.getState().scroll).toMatchObject({ positionPx: 50, progress: 0.5 });
  });

  it('dispatch 默认 source 为 button，并返回 bus 的结果', () => {
    const { bus, store } = setup();
    expect(store.getState().dispatch({ type: 'toggle' })).toBe(true);
    expect(bus.dispatch).toHaveBeenCalledWith({ type: 'toggle' }, 'button');
    vi.mocked(bus.dispatch).mockReturnValueOnce(false);
    expect(store.getState().dispatch({ type: 'play' }, 'system')).toBe(false);
    expect(bus.dispatch).toHaveBeenLastCalledWith({ type: 'play' }, 'system');
  });

  it('取消连接后不再更新', () => {
    const { controller, engine, store } = setup();
    const disconnect = connectPlaybackStore(store, { controller, engine });
    disconnect();
    controller.emit({ phase: 'paused' });
    engine.emit({ positionPx: 99 });
    expect(store.getState().phase).toBe('idle');
    expect(store.getState().scroll.positionPx).toBe(0);
  });
});

describe('displayStore', () => {
  function setup() {
    let mode: FullscreenMode = 'none';
    const fullscreen = {
      get mode() {
        return mode;
      },
      enter: vi.fn(() => {
        mode = 'native';
        return Promise.resolve<FullscreenMode>('native');
      }),
      exit: vi.fn(() => {
        mode = 'none';
        return Promise.resolve();
      }),
      onChange: vi.fn(() => () => {}),
    } satisfies FullscreenPort;
    let status: WakeLockStatus = 'inactive';
    const wakeLock = {
      get status() {
        return status;
      },
      acquire: vi.fn(() => {
        status = 'active';
        return Promise.resolve<WakeLockStatus>('active');
      }),
      release: vi.fn(() => {
        status = 'inactive';
        return Promise.resolve();
      }),
      onChange: vi.fn(() => () => {}),
    } satisfies WakeLockPort;
    const clock = new FakeClock();
    const store = createDisplayStore({ fullscreen, wakeLock, clock });
    return { fullscreen, wakeLock, clock, store, s: () => store.getState() };
  }

  it('toggleFullscreen 同步调用 FullscreenPort.enter（保留用户手势）', async () => {
    const { fullscreen, s } = setup();
    s().toggleFullscreen();
    expect(fullscreen.enter).toHaveBeenCalledTimes(1);
    await tick();
    expect(s().fullscreenMode).toBe('native');
    s().toggleFullscreen();
    expect(fullscreen.exit).toHaveBeenCalledTimes(1);
    await tick();
    expect(s().fullscreenMode).toBe('none');
  });

  it('进入全屏时同时进入纯净模式，退出时恢复进入前的纯净状态', async () => {
    const { s } = setup();
    s().toggleFullscreen();
    expect(s().isClean).toBe(true);
    await tick();
    s().exitFullscreen();
    await tick();
    expect(s().isClean).toBe(false);

    s().toggleClean();
    s().toggleFullscreen();
    await tick();
    s().toggleFullscreen();
    await tick();
    expect(s().isClean).toBe(true);
  });

  it('外部退出全屏（系统 Esc）经 setFullscreenMode 同步状态', async () => {
    const { s, fullscreen } = setup();
    s().toggleFullscreen();
    await tick();
    s().setFullscreenMode('none');
    expect(s().fullscreenMode).toBe('none');
    expect(s().isClean).toBe(false);
    s().exitFullscreen();
    expect(fullscreen.exit).not.toHaveBeenCalled();
  });

  it('fallback 全屏同样记录并恢复纯净状态', async () => {
    const { s, fullscreen } = setup();
    fullscreen.enter.mockImplementationOnce(() => Promise.resolve<FullscreenMode>('fallback'));
    s().toggleFullscreen();
    await tick();
    expect(s().fullscreenMode).toBe('fallback');
    s().setFullscreenMode('none');
    expect(s().isClean).toBe(false);
  });

  it('noteActivity 显示控件，3 秒无活动后隐藏', () => {
    const { s, clock } = setup();
    s().noteActivity();
    clock.advance(CONTROLS_AUTO_HIDE_MS - 1);
    expect(s().controlsVisible).toBe(true);
    s().noteActivity();
    clock.advance(CONTROLS_AUTO_HIDE_MS - 1);
    expect(s().controlsVisible).toBe(true);
    clock.advance(1);
    expect(s().controlsVisible).toBe(false);
    s().noteActivity();
    expect(s().controlsVisible).toBe(true);
  });

  it('面板或帮助打开时不隐藏控件，关闭后重新计时', () => {
    const { s, clock } = setup();
    s().setActivePanel('settings');
    s().noteActivity();
    clock.advance(10_000);
    expect(s().controlsVisible).toBe(true);
    s().setActivePanel('none');
    clock.advance(CONTROLS_AUTO_HIDE_MS);
    expect(s().controlsVisible).toBe(false);
    s().noteActivity();
    s().toggleHelp();
    clock.advance(10_000);
    expect(s().controlsVisible).toBe(true);
    s().toggleHelp();
    clock.advance(CONTROLS_AUTO_HIDE_MS);
    expect(s().controlsVisible).toBe(false);
  });

  it('setPromptActive(true) 申请 Wake Lock，false 释放', async () => {
    const { s, wakeLock } = setup();
    s().setPromptActive(true);
    s().setPromptActive(true);
    expect(wakeLock.acquire).toHaveBeenCalledTimes(1);
    await tick();
    expect(s().wakeLock).toBe('active');
    s().setPromptActive(false);
    s().setPromptActive(false);
    expect(wakeLock.release).toHaveBeenCalledTimes(1);
    await tick();
    expect(s().wakeLock).toBe('inactive');
  });

  it('适配器回写 viewportClass、wakeLock', () => {
    const { s } = setup();
    s().setViewportClass('phone');
    s().setWakeLockStatus('unsupported');
    expect(s()).toMatchObject({ viewportClass: 'phone', wakeLock: 'unsupported' });
  });
});
