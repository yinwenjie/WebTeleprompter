import { DefaultCommandBus } from '@/core/playback/DefaultCommandBus';
import type { DisplayCommand } from '@/core/playback/commands';
import { DefaultPlaybackController } from '@/core/playback/DefaultPlaybackController';
import { createEditModeInterceptor } from '@/core/playback/interceptors';
import { DefaultScrollEngine } from '@/core/scroll-engine/DefaultScrollEngine';
import { countReadingUnits } from '@/core/speed-model';
import { generateId } from '@/platform/ids';
import { FallbackScriptRepository } from '@/platform/storage/FallbackScriptRepository';
import { IdbScriptRepository } from '@/platform/storage/IdbScriptRepository';
import { LocalScratchStore } from '@/platform/storage/LocalScratchStore';
import { LocalSettingsRepository } from '@/platform/storage/LocalSettingsRepository';
import { ResilientScriptRepository } from '@/platform/storage/ResilientScriptRepository';
import { LazyFileIO } from '@/platform/file-io/LazyFileIO';
import { FullscreenAdapter } from '@/platform/fullscreen/FullscreenAdapter';
import { ActivityMonitor } from '@/platform/input/ActivityMonitor';
import { GestureInput } from '@/platform/input/GestureInput';
import { KeyboardInput } from '@/platform/input/KeyboardInput';
import { PageLifecycle } from '@/platform/lifecycle/PageLifecycle';
import { BrowserClock } from '@/platform/raf/BrowserClock';
import { RafScheduler } from '@/platform/raf/RafScheduler';
import { ViewportMonitor } from '@/platform/viewport/ViewportMonitor';
import { WakeLockAdapter } from '@/platform/wake-lock/WakeLockAdapter';
import { createDisplayStore } from '@/state/displayStore';
import type { AppStores } from '@/state/hooks';
import { connectPlaybackStore, createPlaybackStore } from '@/state/playbackStore';
import { createScriptStore } from '@/state/scriptStore';
import { createSettingsStore } from '@/state/settingsStore';
import type { StageBridge } from '@/state/stageBridge';
import { bindRootStyles } from './rootStyles';

export interface AppContainer {
  stores: AppStores;
  /** 接通所有订阅与输入，返回停止函数。 */
  start(): () => void;
}

/**
 * 组合根（R4）：唯一可以 new 具体实现的地方。
 * 这里的结构就是架构 §4.2 的数据流，新增输入源或适配器时只改这个文件。
 * 规格见 docs/dev/modules/app-shell.md
 */
export function createContainer(root: HTMLElement): AppContainer {
  // —— platform 基础能力 ——
  const clock = new BrowserClock();
  const scheduler = new RafScheduler();
  const lifecycle = new PageLifecycle();
  const viewport = new ViewportMonitor();
  const activity = new ActivityMonitor();
  const fullscreen = new FullscreenAdapter(root);
  const wakeLock = new WakeLockAdapter();

  // —— 设置最先就绪：控制器的初始语速和首屏样式都依赖它 ——
  const settings = createSettingsStore({ repository: new LocalSettingsRepository() });
  settings.getState().hydrate();

  const display = createDisplayStore({ fullscreen, wakeLock, clock });
  const scripts = createScriptStore({
    repository: new ResilientScriptRepository(
      new IdbScriptRepository(),
      new FallbackScriptRepository(),
    ),
    scratch: new LocalScratchStore(),
    fileIO: new LazyFileIO(),
    clock,
    generateId,
    getSettingsForExport: () => settings.getState().settings,
  });

  // —— 播放核心 ——
  const engine = new DefaultScrollEngine({ scheduler });
  const routeDisplayCommand = (command: DisplayCommand): void => {
    switch (command.type) {
      case 'display.toggleMirror':
        return settings.getState().toggleMirror(command.axis);
      case 'display.toggleFullscreen':
        return display.getState().toggleFullscreen();
      case 'display.exitFullscreen':
        return display.getState().exitFullscreen();
      case 'display.toggleClean':
        return display.getState().toggleClean();
      case 'display.toggleHelp':
        return display.getState().toggleHelp();
    }
  };
  const controller = new DefaultPlaybackController({
    engine,
    clock,
    initialSpeedLevel: settings.getState().settings.playback.speedLevel,
    getBehavior: () => settings.getState().settings.playback,
    effects: {
      onDisplayCommand: routeDisplayCommand,
      onSpeedLevelChanged: (level) => settings.getState().persistSpeedLevel(level),
      onSavePoint: (point) => void scripts.getState().savePlaybackPoint(point),
    },
  });
  const bus = new DefaultCommandBus((command, source) => controller.handle(command, source));
  const playback = createPlaybackStore({ bus, controller, engine });

  // —— 输入源：只产生命令 ——
  const keyboard = new KeyboardInput({ bus });
  const gesture = new GestureInput({
    bus,
    scheduler,
    getPositionPx: () => engine.getState().positionPx,
    getMirror: () => {
      const { mirrorX, mirrorY } = settings.getState().settings.display;
      return { x: mirrorX, y: mirrorY };
    },
  });

  // —— UI 与引擎之间的唯一通道 ——
  const stageBridge: StageBridge = {
    attachStage({ element, target }) {
      engine.setTarget(target);
      const detachGesture = gesture.attach(element);
      return () => {
        detachGesture();
        engine.setTarget(null);
      };
    },
    reportMetrics(metrics) {
      const { locale } = settings.getState().settings;
      controller.updateLayout({
        metrics,
        readingUnits: countReadingUnits(scripts.getState().draft, locale),
        locale,
      });
    },
  };

  const start = (): (() => void) => {
    const cleanups: Array<() => void> = [];
    const track = (cleanup: () => void) => cleanups.push(cleanup);

    track(bindRootStyles(root, settings, display));
    track(connectPlaybackStore(playback, { controller, engine }));
    track(bus.use(createEditModeInterceptor(() => controller.getState().mode)));

    track(keyboard.attach());
    track(activity.onActivity(() => display.getState().noteActivity()));

    // D-06：页面隐藏转成 pause 命令，保持 phase 和引擎一致。
    track(lifecycle.onHidden(() => bus.dispatch({ type: 'pause' }, 'system')));
    // D-09：pagehide 时只有同步写入可靠。
    track(
      lifecycle.onPageHide(() => {
        const { progress, positionPx } = engine.getState();
        // 舞台从未挂载或刚切换稿件时位置是 0 且仍在 idle，这不是用户的阅读位置，写入会覆盖已保存的进度。
        if (controller.getState().phase === 'idle' && positionPx === 0) return;
        scripts.getState().persistOnPageHide({ progress, positionPx });
      }),
    );

    // 适配器的 onChange 不补发初值，启动时先同步一次。
    display.getState().setViewportClass(viewport.current);
    display.getState().setFullscreenMode(fullscreen.mode);
    display.getState().setWakeLockStatus(wakeLock.status);
    track(viewport.onChange((value) => display.getState().setViewportClass(value)));
    track(fullscreen.onChange((mode) => display.getState().setFullscreenMode(mode)));
    track(wakeLock.onChange((status) => display.getState().setWakeLockStatus(status)));
    track(
      controller.subscribe((state) => display.getState().setPromptActive(state.mode === 'prompt')),
    );

    // 切换稿件时重置播放会话。
    track(
      scripts.subscribe((state, previous) => {
        if (state.activeScriptId !== previous.activeScriptId) controller.resetSession();
      }),
    );
    void scripts.getState().load();

    // E2E 需要读取引擎状态（验收 8-3、8-8、8-11）。生产构建中这段会被移除。
    if (import.meta.env.DEV || import.meta.env.VITE_E2E) {
      (window as unknown as { __WTP_DEBUG__: unknown }).__WTP_DEBUG__ = {
        getScrollState: () => engine.getState(),
        getControllerState: () => controller.getState(),
        getMetrics: () => engine.getMetrics(),
        getActiveScript: () => {
          const { activeScriptId, scripts: list, draft, saveStatus } = scripts.getState();
          const script = list.find((s) => s.id === activeScriptId);
          return script ? { ...script, draft, saveStatus } : null;
        },
        getSettings: () => settings.getState().settings,
        getDisplayState: () => {
          const { fullscreenMode, isClean, controlsVisible } = display.getState();
          return { fullscreenMode, isClean, controlsVisible };
        },
      };
    }

    return () => {
      while (cleanups.length > 0) cleanups.pop()?.();
    };
  };

  return {
    stores: { playback, scripts, settings, display, stageBridge },
    start,
  };
}
