import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  createExportBundle,
  parseExportBundle,
  resolveImportConflicts,
} from '@/core/models/export-bundle';
import type { Script } from '@/core/models/script';
import { createScript, withContent } from '@/core/models/script';
import type { Settings } from '@/core/models/settings';
import type { Clock, IdGenerator } from '@/core/ports/clock';
import type { FileIOPort } from '@/core/ports/file-io';
import type { ScratchStore, ScriptRepository, StorageErrorKind } from '@/core/ports/repositories';
import { StorageError } from '@/core/ports/repositories';
import { t } from '@/i18n';

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
  /** 文件损坏时以 StorageError('corrupt') 拒绝，现有数据不受影响。 */
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

export const DRAFT_SCRATCH_THROTTLE_MS = 100;
export const SAVE_DEBOUNCE_MS = 500;

const byUpdatedAtDesc = (a: Script, b: Script) => b.updatedAt - a.updatedAt;

function errorKind(error: unknown): StorageErrorKind {
  return error instanceof StorageError ? error.kind : 'unknown';
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** 本地时间 YYYYMMDD-HHmm，用于备份文件名。 */
export function formatFileTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function stripExtension(name: string): string {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(0, index) : name;
}

/** 规格见 docs/dev/modules/state-script.md */
export function createScriptStore(deps: ScriptStoreDeps): ScriptStore {
  const { repository, scratch, fileIO, clock, generateId } = deps;

  let queue: Promise<void> = Promise.resolve();
  let saveTimer: number | null = null;
  let throttleTimer: number | null = null;
  let scratchDirty = false;
  /** 每次编辑递增；落库完成时据此判断草稿是否又变了。 */
  let draftVersion = 0;

  return createStore<ScriptStoreState>((set, get) => {
    const findScript = (id: string) => get().scripts.find((s) => s.id === id);

    const replaceScript = (next: Script) =>
      set({
        scripts: get()
          .scripts.map((s) => (s.id === next.id ? next : s))
          .sort(byUpdatedAtDesc),
      });

    /** 所有 put 串行执行；写失败不打断队列。 */
    const enqueue = (operation: () => Promise<void>): Promise<void> => {
      const run = queue.then(operation);
      queue = run.catch(() => {});
      return queue;
    };

    const fail = (error: unknown) => set({ saveStatus: 'error', lastErrorKind: errorKind(error) });

    const writeScratchDraft = () => {
      scratchDirty = false;
      const { activeScriptId, draft } = get();
      if (!activeScriptId) return;
      try {
        scratch.writeDraft(activeScriptId, draft);
      } catch {
        // 暂存写失败静默：内存中的 draft 仍在，防抖落库照常进行。
      }
    };

    const cancelTimers = () => {
      if (saveTimer !== null) clock.clearTimeout(saveTimer);
      if (throttleTimer !== null) clock.clearTimeout(throttleTimer);
      saveTimer = null;
      throttleTimer = null;
    };

    /** 执行时读取最新稿件和草稿，只改内容相关字段。 */
    const saveContentOp = (id: string) => async () => {
      const version = draftVersion;
      const { activeScriptId, draft, saveStatus } = get();
      const script = findScript(id);
      if (activeScriptId !== id || !script) return;
      /** 落库后草稿若没再变化，删除暂存；否则保持 pending 等待下一次防抖。 */
      const settle = (status: SaveStatus) => {
        if (draftVersion !== version) {
          set({ saveStatus: 'pending', lastErrorKind: null });
          return;
        }
        if (throttleTimer !== null) clock.clearTimeout(throttleTimer);
        throttleTimer = null;
        scratchDirty = false;
        scratch.removeDraft(id);
        set({ saveStatus: status, lastErrorKind: null });
      };
      if (script.content === draft) {
        settle(saveStatus === 'idle' ? 'idle' : 'saved');
        return;
      }
      set({ saveStatus: 'saving' });
      try {
        const next = withContent(script, draft, clock.now());
        await repository.put(next);
        const latest = findScript(id) ?? next;
        replaceScript({
          ...latest,
          content: next.content,
          charCount: next.charCount,
          updatedAt: next.updatedAt,
        });
        settle('saved');
      } catch (error) {
        writeScratchDraft();
        fail(error);
      }
    };

    /** 把内存中的最新稿件整份写入。内存是除 content 外所有字段的真值。 */
    const putLatestOp = (id: string, onSuccess?: () => void) => async () => {
      const script = findScript(id);
      if (!script) return;
      try {
        await repository.put(script);
        onSuccess?.();
      } catch (error) {
        fail(error);
      }
    };

    const flush = async () => {
      if (saveTimer !== null) clock.clearTimeout(saveTimer);
      saveTimer = null;
      const id = get().activeScriptId;
      if (id) await enqueue(saveContentOp(id));
      else await queue;
    };

    const activate = (script: Script | undefined) => {
      cancelTimers();
      draftVersion += 1;
      if (!script) {
        set({ activeScriptId: null, draft: '', saveStatus: 'idle' });
        void repository.setMeta('activeScriptId', null).catch(() => {});
        return;
      }
      const stored = scratch.readDraft(script.id);
      const draft = stored ?? script.content;
      const pending = draft !== script.content;
      set({ activeScriptId: script.id, draft, saveStatus: pending ? 'pending' : 'idle' });
      void repository.setMeta('activeScriptId', script.id).catch(() => {});
      if (pending) void enqueue(saveContentOp(script.id));
    };

    const addScript = (script: Script) =>
      set({
        scripts: [...get().scripts.filter((s) => s.id !== script.id), script].sort(byUpdatedAtDesc),
      });

    const saveFile = (name: string, mime: string, text: string) =>
      fileIO.saveTextFile(name, mime, text);

    return {
      ready: false,
      scripts: [],
      activeScriptId: null,
      draft: '',
      saveStatus: 'idle',
      lastErrorKind: null,
      storageDegraded: false,
      quarantinedCount: 0,

      load: async () => {
        try {
          const opened = await repository.open();
          set({ storageDegraded: opened.degraded, quarantinedCount: opened.quarantinedCount });
          let scripts = await repository.list();
          const seeded = await repository.getMeta<boolean>('seededSample');
          if (!seeded) {
            if (scripts.length === 0) {
              const sample = createScript({
                id: generateId(),
                title: t('sample.title'),
                content: t('sample.content'),
                now: clock.now(),
              });
              await repository.put(sample).catch(() => {});
              scripts = [sample];
            }
            await repository.setMeta('seededSample', true).catch(() => {});
          }

          const merged: Script[] = [];
          for (const script of scripts) {
            const progress = scratch.readProgress(script.id);
            if (!progress) {
              merged.push(script);
              continue;
            }
            const next = {
              ...script,
              lastProgress: clamp01(progress.progress),
              lastPositionPx: Math.max(0, progress.positionPx),
            };
            merged.push(next);
            try {
              await repository.put(next);
              scratch.removeProgress(script.id);
            } catch {
              // 暂存保留，下次启动再合并。
            }
          }
          set({ scripts: merged.sort(byUpdatedAtDesc) });

          const metaActive = await repository
            .getMeta<string | null>('activeScriptId')
            .catch(() => null);
          const active = (metaActive && findScript(metaActive)) || get().scripts[0];

          for (const script of get().scripts) {
            if (script.id === active?.id) continue;
            const stored = scratch.readDraft(script.id);
            if (stored === null || stored === script.content) continue;
            const next = withContent(script, stored, clock.now());
            try {
              await repository.put(next);
              replaceScript(next);
              scratch.removeDraft(script.id);
            } catch {
              // 草稿仍在暂存中，切换到该稿件时会再次落库。
            }
          }
          activate(active);
        } catch (error) {
          set({ storageDegraded: true, lastErrorKind: errorKind(error) });
        } finally {
          set({ ready: true });
        }
      },

      setActive: async (id) => {
        if (id === get().activeScriptId) return;
        await flush();
        const script = findScript(id);
        if (script) activate(script);
      },

      updateDraft: (text) => {
        const id = get().activeScriptId;
        if (text === get().draft) return;
        draftVersion += 1;
        set({ draft: text, saveStatus: id ? 'pending' : get().saveStatus });
        if (!id) return;
        scratchDirty = true;
        if (throttleTimer === null) {
          writeScratchDraft();
          throttleTimer = clock.setTimeout(() => {
            throttleTimer = null;
            if (scratchDirty) writeScratchDraft();
          }, DRAFT_SCRATCH_THROTTLE_MS);
        }
        if (saveTimer !== null) clock.clearTimeout(saveTimer);
        saveTimer = clock.setTimeout(() => {
          saveTimer = null;
          void enqueue(saveContentOp(id));
        }, SAVE_DEBOUNCE_MS);
      },

      flush,

      create: async (title) => {
        await flush();
        const script = createScript({
          id: generateId(),
          title: title ?? t('script.untitled'),
          content: '',
          now: clock.now(),
        });
        addScript(script);
        activate(script);
        await enqueue(putLatestOp(script.id));
        return script.id;
      },

      rename: async (id, title) => {
        const script = findScript(id);
        if (!script || script.title === title) return;
        replaceScript({ ...script, title, updatedAt: clock.now() });
        await enqueue(putLatestOp(id));
      },

      remove: async (id) => {
        if (!findScript(id)) return;
        const wasActive = get().activeScriptId === id;
        if (wasActive) cancelTimers();
        draftVersion += 1;
        set({ scripts: get().scripts.filter((s) => s.id !== id) });
        if (wasActive) activate(get().scripts[0]);
        await enqueue(async () => {
          try {
            await repository.remove(id);
            scratch.removeDraft(id);
            scratch.removeProgress(id);
          } catch (error) {
            fail(error);
          }
        });
      },

      savePlaybackPoint: async (point) => {
        const id = get().activeScriptId;
        const script = id ? findScript(id) : undefined;
        if (!id || !script) return;
        const progress = clamp01(point.progress);
        const positionPx = Math.max(0, Number.isFinite(point.positionPx) ? point.positionPx : 0);
        set({
          scripts: get().scripts.map((s) =>
            s.id === id ? { ...s, lastProgress: progress, lastPositionPx: positionPx } : s,
          ),
        });
        await enqueue(async () => {
          const latest = findScript(id);
          if (!latest) return;
          try {
            await repository.put(latest);
            scratch.removeProgress(id);
          } catch (error) {
            try {
              scratch.writeProgress(id, { progress, positionPx, savedAt: clock.now() });
            } catch {
              // 暂存也写不进去时，只剩内存中的值。
            }
            fail(error);
          }
        });
      },

      persistOnPageHide: (point) => {
        const { activeScriptId, draft } = get();
        if (!activeScriptId) return;
        try {
          scratch.writeProgress(activeScriptId, {
            progress: clamp01(point.progress),
            positionPx: Math.max(0, point.positionPx),
            savedAt: clock.now(),
          });
        } catch {
          // pagehide 中无法补救，忽略。
        }
        const script = findScript(activeScriptId);
        if (scratchDirty || (script && script.content !== draft)) {
          if (throttleTimer !== null) clock.clearTimeout(throttleTimer);
          throttleTimer = null;
          writeScratchDraft();
        }
      },

      importTextFile: async () => {
        const picked = await fileIO.pickTextFile(['.txt']);
        if (!picked) return;
        await flush();
        const script = createScript({
          id: generateId(),
          title: stripExtension(picked.name) || t('script.untitled'),
          content: picked.text,
          now: clock.now(),
        });
        addScript(script);
        activate(script);
        await enqueue(putLatestOp(script.id));
      },

      exportTextFile: async (id) => {
        await flush();
        const script = findScript(id);
        if (!script) return;
        const content = id === get().activeScriptId ? get().draft : script.content;
        await saveFile(
          `${script.title || t('script.untitled')}.txt`,
          'text/plain;charset=utf-8',
          content,
        );
      },

      importBundle: async () => {
        const picked = await fileIO.pickTextFile(['.json']);
        if (!picked) return;
        let raw: unknown;
        try {
          raw = JSON.parse(picked.text);
        } catch (error) {
          throw new StorageError('corrupt', 'invalid-json', { cause: error });
        }
        const parsed = parseExportBundle(raw);
        if (!parsed.ok) throw new StorageError('corrupt', parsed.reason);
        const existing = new Set(get().scripts.map((s) => s.id));
        const incoming = resolveImportConflicts(
          parsed.value.scripts,
          existing,
          generateId,
          t('import.titleSuffix'),
        );
        for (const script of incoming) {
          addScript(script);
          void enqueue(putLatestOp(script.id));
        }
        if (!get().activeScriptId && incoming[0]) activate(findScript(incoming[0].id));
        await queue;
      },

      exportBundle: async () => {
        try {
          await flush();
        } catch {
          // 落库失败也要能导出：下面以内存为准。
        }
        let stored: Script[];
        try {
          stored = await repository.list();
        } catch {
          stored = [];
        }
        const byId = new Map(stored.map((s) => [s.id, s]));
        for (const script of get().scripts) byId.set(script.id, script);
        const { activeScriptId, draft } = get();
        const active = activeScriptId ? byId.get(activeScriptId) : undefined;
        if (active && active.content !== draft) {
          byId.set(active.id, withContent(active, draft, clock.now()));
        }
        const now = clock.now();
        const bundle = createExportBundle(
          [...byId.values()].sort(byUpdatedAtDesc),
          deps.getSettingsForExport(),
          now,
        );
        await saveFile(
          `webteleprompter-backup-${formatFileTimestamp(now)}.json`,
          'application/json',
          JSON.stringify(bundle, null, 2),
        );
      },

      exportQuarantined: async () => {
        const records = await repository.listQuarantined();
        await saveFile(
          `webteleprompter-quarantine-${formatFileTimestamp(clock.now())}.json`,
          'application/json',
          JSON.stringify(records, null, 2),
        );
      },
    };
  });
}
