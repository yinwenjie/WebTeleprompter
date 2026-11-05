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
import { createStepRunner } from './stepRunner';

export interface AppContainer {
  stores: AppStores;
  /** 接通所有订阅与输入，返回停止函数。 */
  start(): () => void;
  /** 骨架期用：尚未实现而被跳过的启动步骤。 */
  unimplementedSteps: readonly string[];
}

/**
 * 组合根（R4）：唯一可以 new 具体实现的地方。
 * 这里的结构就是架构 §4.2 的数据流，新增输入源或适配器时只改这个文件。
 * 规格见 docs/dev/modules/app-shell.md
 */
export function createContainer(root: HTMLElement): AppContainer {
  const steps = createStepRunner();

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
  steps.run('settings.hydrate', () => settings.getState().hydrate());

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
    steps.run('rootStyles', () => bindRootStyles(root, settings, display));
    steps.run('playbackStore.connect', () =>
      connectPlaybackStore(playback, { controller, engine }),
    );

    steps.run('bus.editModeInterceptor', () =>
      bus.use(createEditModeInterceptor(() => controller.getState().mode)),
    );

    steps.run('input.keyboard', () => keyboard.attach());
    steps.run('input.activity', () => activity.onActivity(() => display.getState().noteActivity()));

    // D-06：页面隐藏转成 pause 命令，保持 phase 和引擎一致。
    steps.run('lifecycle.pauseOnHidden', () =>
      lifecycle.onHidden(() => bus.dispatch({ type: 'pause' }, 'system')),
    );
    // D-09：pagehide 时只有同步写入可靠。
    steps.run('lifecycle.persistOnPageHide', () =>
      lifecycle.onPageHide(() => {
        const { progress, positionPx } = engine.getState();
        scripts.getState().persistOnPageHide({ progress, positionPx });
      }),
    );

    steps.run('display.viewport', () =>
      viewport.onChange((value) => display.getState().setViewportClass(value)),
    );
    steps.run('display.fullscreen', () =>
      fullscreen.onChange((mode) => display.getState().setFullscreenMode(mode)),
    );
    steps.run('display.wakeLock', () =>
      wakeLock.onChange((status) => display.getState().setWakeLockStatus(status)),
    );
    steps.run('display.promptActive', () =>
      controller.subscribe((state) => display.getState().setPromptActive(state.mode === 'prompt')),
    );

    // 切换稿件时重置播放会话。
    steps.run('scripts.resetOnSwitch', () =>
      scripts.subscribe((state, previous) => {
        if (state.activeScriptId !== previous.activeScriptId) controller.resetSession();
      }),
    );
    steps.run('scripts.load', () => void scripts.getState().load());

    // E2E 需要读取引擎状态（验收 8-3、8-8、8-11）。生产构建中这段会被移除。
    if (import.meta.env.DEV || import.meta.env.VITE_E2E) {
      (window as unknown as { __WTP_DEBUG__: unknown }).__WTP_DEBUG__ = {
        getScrollState: () => engine.getState(),
        getControllerState: () => controller.getState(),
      };
    }

    if (steps.unimplemented.length > 0) {
      console.warn(`[skeleton] 尚未实现的启动步骤：${steps.unimplemented.join(', ')}`);
    }
    return steps.disposeAll;
  };

  return {
    stores: { playback, scripts, settings, display, stageBridge },
    start,
    unimplementedSteps: steps.unimplemented,
  };
}
