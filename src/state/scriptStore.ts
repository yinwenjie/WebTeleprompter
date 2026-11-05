import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Script } from '@/core/models/script';
import type { Settings } from '@/core/models/settings';
import { notImplemented } from '@/core/not-implemented';
import type { Clock, IdGenerator } from '@/core/ports/clock';
import type { FileIOPort } from '@/core/ports/file-io';
import type { ScratchStore, ScriptRepository, StorageErrorKind } from '@/core/ports/repositories';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface PlaybackPoint {
  progress: number;
  positionPx: number;
}

export interface ScriptStoreState {
  ready: boolean;
  scripts: Script[];
  activeScriptId: string | null;
  draft: string;
  saveStatus: SaveStatus;
  lastErrorKind: StorageErrorKind | null;
  /** IndexedDB 不可用：UI 常驻提示“本次数据不会长期保存，请导出”。 */
  storageDegraded: boolean;
  quarantinedCount: number;

  load(): Promise<void>;
  setActive(id: string): Promise<void>;
  /** 立即更新内存，暂存节流写入（100ms，D-19），防抖 500ms 后落库。 */
  updateDraft(text: string): void;
  flush(): Promise<void>;
  create(title?: string): Promise<string>;
  rename(id: string, title: string): Promise<void>;
  remove(id: string): Promise<void>;
  /** 写 IndexedDB 的 lastProgress / lastPositionPx，不改 updatedAt（D-09）。 */
  savePlaybackPoint(point: PlaybackPoint): Promise<void>;
  /** pagehide 专用：只做同步写入（未写出的草稿 + 播放位置）。 */
  persistOnPageHide(point: PlaybackPoint): void;
  importTextFile(): Promise<void>;
  exportTextFile(id: string): Promise<void>;
  importBundle(): Promise<void>;
  /** 导出全部数据，也是错误边界和隔离数据的兜底路径。 */
  exportBundle(): Promise<void>;
  /** 导出被隔离的损坏数据。 */
  exportQuarantined(): Promise<void>;
}

export type ScriptStore = StoreApi<ScriptStoreState>;

export interface ScriptStoreDeps {
  repository: ScriptRepository;
  scratch: ScratchStore;
  fileIO: FileIOPort;
  clock: Clock;
  generateId: IdGenerator;
  /** 备份文件要带上设置；scriptStore 不依赖 settingsStore，由 bootstrap 注入读取函数。 */
  getSettingsForExport(): Settings;
}

/** 规格见 docs/dev/modules/state-script.md */
export function createScriptStore(_deps: ScriptStoreDeps): ScriptStore {
  return createStore<ScriptStoreState>(() => ({
    ready: false,
    scripts: [],
    activeScriptId: null,
    draft: '',
    saveStatus: 'idle',
    lastErrorKind: null,
    storageDegraded: false,
    quarantinedCount: 0,
    load: () => notImplemented('scriptStore.load'),
    setActive: () => notImplemented('scriptStore.setActive'),
    updateDraft: () => notImplemented('scriptStore.updateDraft'),
    flush: () => notImplemented('scriptStore.flush'),
    create: () => notImplemented('scriptStore.create'),
    rename: () => notImplemented('scriptStore.rename'),
    remove: () => notImplemented('scriptStore.remove'),
    savePlaybackPoint: () => notImplemented('scriptStore.savePlaybackPoint'),
    persistOnPageHide: () => notImplemented('scriptStore.persistOnPageHide'),
    importTextFile: () => notImplemented('scriptStore.importTextFile'),
    exportTextFile: () => notImplemented('scriptStore.exportTextFile'),
    importBundle: () => notImplemented('scriptStore.importBundle'),
    exportBundle: () => notImplemented('scriptStore.exportBundle'),
    exportQuarantined: () => notImplemented('scriptStore.exportQuarantined'),
  }));
}
