import { createStore, type StoreApi } from 'zustand/vanilla';
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
export function createDisplayStore({
  fullscreen,
  wakeLock,
  clock,
}: DisplayStoreDeps): DisplayStore {
  let hideTimer: number | null = null;
  let cleanBeforeFullscreen: boolean | null = null;
  let promptActive = false;

  return createStore<DisplayStoreState>((set, get) => {
    const scheduleHide = () => {
      if (hideTimer !== null) clock.clearTimeout(hideTimer);
      hideTimer = clock.setTimeout(() => {
        hideTimer = null;
        const { activePanel, helpOpen } = get();
        if (activePanel !== 'none' || helpOpen) return;
        set({ controlsVisible: false });
      }, CONTROLS_AUTO_HIDE_MS);
    };

    const setFullscreenMode = (mode: FullscreenMode) => {
      if (mode === get().fullscreenMode) return;
      if (mode === 'none' && cleanBeforeFullscreen !== null) {
        const isClean = cleanBeforeFullscreen;
        cleanBeforeFullscreen = null;
        set({ fullscreenMode: mode, isClean });
        return;
      }
      set({ fullscreenMode: mode });
    };

    const exitFullscreen = () => {
      if (get().fullscreenMode === 'none') return;
      void fullscreen.exit().then(() => setFullscreenMode('none'));
    };

    return {
      fullscreenMode: 'none',
      isClean: false,
      controlsVisible: true,
      viewportClass: 'desktop',
      wakeLock: 'inactive',
      presentation: 'normal',
      activePanel: 'none',
      helpOpen: false,
      toggleFullscreen: () => {
        if (get().fullscreenMode !== 'none') {
          exitFullscreen();
          return;
        }
        cleanBeforeFullscreen ??= get().isClean;
        set({ isClean: true });
        // 必须在同一调用栈内同步调用 enter，前面不能有 await（R-5）。
        void fullscreen.enter().then(setFullscreenMode);
      },
      exitFullscreen,
      toggleClean: () => set({ isClean: !get().isClean }),
      toggleHelp: () => {
        const helpOpen = !get().helpOpen;
        set({ helpOpen });
        if (!helpOpen && get().controlsVisible) scheduleHide();
      },
      setActivePanel: (activePanel) => {
        if (activePanel === get().activePanel) return;
        set({ activePanel, controlsVisible: true });
        if (activePanel === 'none') scheduleHide();
      },
      noteActivity: () => {
        if (!get().controlsVisible) set({ controlsVisible: true });
        scheduleHide();
      },
      setViewportClass: (viewportClass) => {
        if (viewportClass !== get().viewportClass) set({ viewportClass });
      },
      setFullscreenMode,
      setWakeLockStatus: (status: WakeLockStatus) => {
        if (status !== get().wakeLock) set({ wakeLock: status });
      },
      setPromptActive: (active) => {
        if (active === promptActive) return;
        promptActive = active;
        if (active) {
          void wakeLock.acquire().then((status) => get().setWakeLockStatus(status));
        } else {
          void wakeLock.release().then(() => get().setWakeLockStatus(wakeLock.status));
        }
      },
    };
  });
}
