import { createStore, type StoreApi } from 'zustand/vanilla';
import { notImplemented } from '@/core/not-implemented';
import type { Clock } from '@/core/ports/clock';
import type {
  FullscreenMode,
  FullscreenPort,
  ViewportClass,
  WakeLockPort,
  WakeLockStatus,
} from '@/core/ports/display';

export type ActivePanel = 'none' | 'settings' | 'library';
/** P1 的 OBS 模式会新增 'obs'（架构 §3.5）。 */
export type Presentation = 'normal';

/** 控件无操作后自动隐藏的时长（规划 P0-4）。 */
export const CONTROLS_AUTO_HIDE_MS = 3000;

export interface DisplayStoreState {
  fullscreenMode: FullscreenMode;
  isClean: boolean;
  controlsVisible: boolean;
  viewportClass: ViewportClass;
  wakeLock: WakeLockStatus;
  presentation: Presentation;
  activePanel: ActivePanel;
  helpOpen: boolean;

  /** 必须保持同步调用 FullscreenPort.enter，否则会丢失用户手势。 */
  toggleFullscreen(): void;
  exitFullscreen(): void;
  toggleClean(): void;
  toggleHelp(): void;
  setActivePanel(panel: ActivePanel): void;
  /** 显示控件并重置自动隐藏定时器。 */
  noteActivity(): void;
  setViewportClass(viewport: ViewportClass): void;
  setFullscreenMode(mode: FullscreenMode): void;
  setWakeLockStatus(status: WakeLockStatus): void;
  /** 进入提词模式时申请 Wake Lock，离开时释放。 */
  setPromptActive(active: boolean): void;
}

export type DisplayStore = StoreApi<DisplayStoreState>;

export interface DisplayStoreDeps {
  fullscreen: FullscreenPort;
  wakeLock: WakeLockPort;
  clock: Clock;
}

/** 规格见 docs/dev/modules/state-display-playback.md */
export function createDisplayStore(_deps: DisplayStoreDeps): DisplayStore {
  return createStore<DisplayStoreState>(() => ({
    fullscreenMode: 'none',
    isClean: false,
    controlsVisible: true,
    viewportClass: 'desktop',
    wakeLock: 'inactive',
    presentation: 'normal',
    activePanel: 'none',
    helpOpen: false,
    toggleFullscreen: () => notImplemented('displayStore.toggleFullscreen'),
    exitFullscreen: () => notImplemented('displayStore.exitFullscreen'),
    toggleClean: () => notImplemented('displayStore.toggleClean'),
    toggleHelp: () => notImplemented('displayStore.toggleHelp'),
    setActivePanel: () => notImplemented('displayStore.setActivePanel'),
    noteActivity: () => notImplemented('displayStore.noteActivity'),
    setViewportClass: () => notImplemented('displayStore.setViewportClass'),
    setFullscreenMode: () => notImplemented('displayStore.setFullscreenMode'),
    setWakeLockStatus: () => notImplemented('displayStore.setWakeLockStatus'),
    setPromptActive: () => notImplemented('displayStore.setPromptActive'),
  }));
}
