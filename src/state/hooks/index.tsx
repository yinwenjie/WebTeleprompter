import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { DisplayStore, DisplayStoreState } from '../displayStore';
import type { PlaybackStore, PlaybackStoreState } from '../playbackStore';
import type { ScriptStore, ScriptStoreState } from '../scriptStore';
import type { SettingsStore, SettingsStoreState } from '../settingsStore';
import type { StageBridge } from '../stageBridge';

/** bootstrap 装配后交给 UI 的全部内容。UI 只能经下面的 hooks 访问。 */
export interface AppStores {
  playback: PlaybackStore;
  scripts: ScriptStore;
  settings: SettingsStore;
  display: DisplayStore;
  stageBridge: StageBridge;
}

const StoresContext = createContext<AppStores | null>(null);

export function StoresProvider({ stores, children }: { stores: AppStores; children: ReactNode }) {
  return <StoresContext.Provider value={stores}>{children}</StoresContext.Provider>;
}

function useStores(): AppStores {
  const stores = useContext(StoresContext);
  if (!stores) throw new Error('必须在 StoresProvider 内使用');
  return stores;
}

/** 请用选择器只订阅需要的字段。scroll 字段以 10Hz 更新，舞台内容不要订阅它。 */
export function usePlayback<T>(selector: (state: PlaybackStoreState) => T): T {
  return useStore(useStores().playback, selector);
}

export function useDispatch(): PlaybackStoreState['dispatch'] {
  return usePlayback((state) => state.dispatch);
}

export function useScripts<T>(selector: (state: ScriptStoreState) => T): T {
  return useStore(useStores().scripts, selector);
}

export function useSettings<T>(selector: (state: SettingsStoreState) => T): T {
  return useStore(useStores().settings, selector);
}

export function useDisplay<T>(selector: (state: DisplayStoreState) => T): T {
  return useStore(useStores().display, selector);
}

export function useStageBridge(): StageBridge {
  return useStores().stageBridge;
}
