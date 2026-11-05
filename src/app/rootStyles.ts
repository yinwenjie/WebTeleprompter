import type { DisplayStore, DisplayStoreState } from '@/state/displayStore';
import type { SettingsStore } from '@/state/settingsStore';
import { settingsToCssVars } from '@/state/settingsStore';

const VIEWPORT_CLASSES = ['vp-phone', 'vp-tablet', 'vp-desktop'] as const;

function displayClasses(state: DisplayStoreState): Record<string, boolean> {
  return {
    'is-fullscreen': state.fullscreenMode !== 'none',
    'is-fullscreen-fallback': state.fullscreenMode === 'fallback',
    'is-clean': state.isClean,
    'is-controls-hidden': !state.controlsVisible,
    'vp-phone': state.viewportClass === 'phone',
    'vp-tablet': state.viewportClass === 'tablet',
    'vp-desktop': state.viewportClass === 'desktop',
  };
}

/**
 * 把 settingsToCssVars 的结果和显示模式 class 写到根节点，返回取消订阅函数。
 * state 层不碰 DOM，所以放在 app 层。规格见 docs/dev/modules/app-shell.md
 */
export function bindRootStyles(
  root: HTMLElement,
  settings: SettingsStore,
  display: DisplayStore,
): () => void {
  const writtenVars = new Map<string, string>();
  const writtenClasses = new Map<string, boolean>();

  const applyVars = () => {
    for (const [name, value] of Object.entries(settingsToCssVars(settings.getState().settings))) {
      if (writtenVars.get(name) === value) continue;
      writtenVars.set(name, value);
      root.style.setProperty(name, value);
    }
  };

  const applyClasses = () => {
    for (const [name, on] of Object.entries(displayClasses(display.getState()))) {
      if (writtenClasses.get(name) === on) continue;
      writtenClasses.set(name, on);
      root.classList.toggle(name, on);
    }
  };

  applyVars();
  applyClasses();
  const offSettings = settings.subscribe((state, previous) => {
    if (state.settings !== previous.settings) applyVars();
  });
  const offDisplay = display.subscribe(applyClasses);
  return () => {
    offSettings();
    offDisplay();
    root.classList.remove(
      'is-fullscreen',
      'is-fullscreen-fallback',
      'is-clean',
      'is-controls-hidden',
      ...VIEWPORT_CLASSES,
    );
  };
}
