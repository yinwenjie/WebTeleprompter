// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScript } from '@/core/models/script';
import { DEFAULT_SETTINGS } from '@/core/models/settings';
import type { ScriptRepository } from '@/core/ports/repositories';
import { StorageError } from '@/core/ports/repositories';
import { FallbackScriptRepository } from '../FallbackScriptRepository';
import { IdbScriptRepository } from '../IdbScriptRepository';
import { LocalScratchStore } from '../LocalScratchStore';
import { LocalSettingsRepository } from '../LocalSettingsRepository';
import { ResilientScriptRepository } from '../ResilientScriptRepository';
import { IDB_NAME, LS_KEY_FALLBACK_SCRIPTS, LS_KEY_SETTINGS } from '../schema';

const script = (id: string, updatedAt: number, content = id) => ({
  ...createScript({ id, title: id, content, now: 1 }),
  updatedAt,
});

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// 规格：docs/dev/modules/platform-storage.md。用 fake-indexeddb/auto 和 jsdom 环境。
describe('IdbScriptRepository', () => {
  it('put / get / list / remove 往返一致，list 按 updatedAt 倒序', async () => {
    const repo = new IdbScriptRepository();
    await expect(repo.open()).resolves.toEqual({ degraded: false, quarantinedCount: 0 });
    await repo.put(script('a', 10));
    await repo.put(script('b', 30));
    await repo.put(script('c', 20));
    expect((await repo.list()).map((s) => s.id)).toEqual(['b', 'c', 'a']);
    expect(await repo.get('a')).toEqual(script('a', 10));
    await repo.put(script('a', 40, 'changed'));
    expect((await repo.list()).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    await repo.remove('b');
    expect(await repo.get('b')).toBeUndefined();
    await repo.setMeta('activeScriptId', 'c');
    expect(await repo.getMeta('activeScriptId')).toBe('c');
    expect(await repo.getMeta('seededSample')).toBeUndefined();
  });

  it('校验失败的稿件移入隔离区，其余稿件正常返回', async () => {
    await new IdbScriptRepository().open();
    const raw = await openDB(IDB_NAME, 1);
    await raw.put('scripts', script('ok', 1));
    await raw.put('scripts', { id: 'broken', content: 42, updatedAt: 2 });
    raw.close();

    const repo = new IdbScriptRepository();
    await expect(repo.open()).resolves.toEqual({ degraded: false, quarantinedCount: 1 });
    expect((await repo.list()).map((s) => s.id)).toEqual(['ok']);
  });

  it('隔离的数据可通过 listQuarantined 读回，不被删除', async () => {
    await new IdbScriptRepository().open();
    const raw = await openDB(IDB_NAME, 1);
    await raw.put('scripts', { id: 'broken', content: null, updatedAt: 2, title: '坏稿' });
    raw.close();

    const first = new IdbScriptRepository();
    await first.open();
    const second = new IdbScriptRepository();
    await expect(second.open()).resolves.toMatchObject({ quarantinedCount: 1 });
    expect(await second.listQuarantined()).toEqual([
      {
        key: 'broken',
        raw: { id: 'broken', content: null, updatedAt: 2, title: '坏稿' },
        reason: 'missing-content',
      },
    ]);
  });

  it('QuotaExceededError 归一化为 StorageError(quota)', async () => {
    const repo = new IdbScriptRepository();
    await repo.open();
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const error = await repo.put(script('a', 1)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).kind).toBe('quota');
  });

  it('其他错误归一化为 unknown 并保留 cause', async () => {
    const repo = new IdbScriptRepository();
    await repo.open();
    const cause = new Error('boom');
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(() => {
      throw cause;
    });
    const error = (await repo.remove('a').catch((e: unknown) => e)) as StorageError;
    expect(error.kind).toBe('unknown');
    expect(error.cause).toBe(cause);
  });

  it('indexedDB 未定义时 open 抛 StorageError(unavailable)', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const error = (await new IdbScriptRepository().open().catch((e: unknown) => e)) as StorageError;
    expect(error).toBeInstanceOf(StorageError);
    expect(error.kind).toBe('unavailable');
  });

  it('VersionError（数据比页面新）归一化为 unavailable，不删库', async () => {
    const newer = await openDB(IDB_NAME, 5, {
      upgrade(db) {
        db.createObjectStore('scripts', { keyPath: 'id' });
      },
    });
    newer.close();
    const error = (await new IdbScriptRepository().open().catch((e: unknown) => e)) as StorageError;
    expect(error.kind).toBe('unavailable');
    const check = await openDB(IDB_NAME);
    expect(check.version).toBe(5);
    check.close();
  });

  it('收到 versionchange 时关闭连接，不阻塞其他标签页升级', async () => {
    const repo = new IdbScriptRepository();
    await repo.open();
    const blocked = vi.fn();
    const upgraded = await openDB(IDB_NAME, 2, { blocked });
    expect(blocked).not.toHaveBeenCalled();
    expect(upgraded.version).toBe(2);
    upgraded.close();
  });
});

describe('FallbackScriptRepository', () => {
  it('内存读写，并尽力镜像到 localStorage，重新 open 时读回', async () => {
    const repo = new FallbackScriptRepository();
    await expect(repo.open()).resolves.toEqual({ degraded: true, quarantinedCount: 0 });
    await repo.put(script('a', 1));
    await repo.put(script('b', 2));
    await repo.setMeta('activeScriptId', 'a');
    await repo.remove('b');
    const reopened = new FallbackScriptRepository();
    await reopened.open();
    expect((await reopened.list()).map((s) => s.id)).toEqual(['a']);
    expect(await reopened.getMeta('activeScriptId')).toBe('a');
    expect(await reopened.listQuarantined()).toEqual([]);
  });

  it('localStorage 写失败时静默，内存数据仍可用', async () => {
    const repo = new FallbackScriptRepository();
    await repo.open();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    await expect(repo.put(script('a', 1))).resolves.toBeUndefined();
    expect(await repo.get('a')).toEqual(script('a', 1));
  });

  it('镜像损坏时从空仓库开始', async () => {
    localStorage.setItem(LS_KEY_FALLBACK_SCRIPTS, '{not json');
    const repo = new FallbackScriptRepository();
    await repo.open();
    expect(await repo.list()).toEqual([]);
  });
});

describe('ResilientScriptRepository', () => {
  const failing = (): ScriptRepository =>
    ({
      open: () => Promise.reject(new StorageError('unavailable', 'x')),
    }) as unknown as ScriptRepository;

  it('8-9：indexedDB 不可用时切到 fallback，open 返回 degraded: true', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const repo = new ResilientScriptRepository(
      new IdbScriptRepository(),
      new FallbackScriptRepository(),
    );
    await expect(repo.open()).resolves.toMatchObject({ degraded: true });
    await repo.put(script('a', 1));
    expect((await repo.list()).map((s) => s.id)).toEqual(['a']);
    const viaFailing = new ResilientScriptRepository(failing(), new FallbackScriptRepository());
    await expect(viaFailing.open()).resolves.toMatchObject({ degraded: true });
  });

  it('primary 的 open 挂起超时后切到 fallback', async () => {
    vi.useFakeTimers();
    try {
      const hanging = { open: () => new Promise(() => {}) } as unknown as ScriptRepository;
      const repo = new ResilientScriptRepository(hanging, new FallbackScriptRepository());
      const pending = repo.open();
      await vi.advanceTimersByTimeAsync(3000);
      await expect(pending).resolves.toMatchObject({ degraded: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('primary 正常时 degraded 为 false', async () => {
    const repo = new ResilientScriptRepository(
      new IdbScriptRepository(),
      new FallbackScriptRepository(),
    );
    await expect(repo.open()).resolves.toEqual({ degraded: false, quarantinedCount: 0 });
    await repo.put(script('a', 1));
    expect(await new IdbScriptRepository().open().then(() => true)).toBe(true);
    expect(localStorage.getItem(LS_KEY_FALLBACK_SCRIPTS)).toBeNull();
  });

  it('未 open 就调用其他方法是编程错误', () => {
    const repo = new ResilientScriptRepository(
      new IdbScriptRepository(),
      new FallbackScriptRepository(),
    );
    expect(() => repo.list()).toThrow();
  });
});

describe('LocalSettingsRepository', () => {
  it('load 在无数据、JSON 损坏、localStorage 抛错时都返回默认值', () => {
    const repo = new LocalSettingsRepository();
    expect(repo.load()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(LS_KEY_SETTINGS, '{oops');
    expect(repo.load()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(LS_KEY_SETTINGS, '[1,2]');
    expect(repo.load()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify({ schemaVersion: 99 }));
    expect(repo.load()).toEqual(DEFAULT_SETTINGS);
    expect(JSON.parse(localStorage.getItem(LS_KEY_SETTINGS)!)).toEqual({ schemaVersion: 99 });
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(repo.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('save 后 load 往返一致', () => {
    const repo = new LocalSettingsRepository();
    const settings = {
      ...DEFAULT_SETTINGS,
      appearance: { ...DEFAULT_SETTINGS.appearance, fontSizePx: 72 },
    };
    repo.save(settings);
    expect(repo.load()).toEqual(settings);
  });

  it('load 迁移旧版本并回写', () => {
    localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify({ appearance: { fontSizePx: 60 } }));
    const loaded = new LocalSettingsRepository().load();
    expect(loaded.appearance.fontSizePx).toBe(60);
    expect(JSON.parse(localStorage.getItem(LS_KEY_SETTINGS)!)).toEqual(loaded);
  });

  it('save 配额超限时抛 StorageError(quota)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    let error: unknown;
    try {
      new LocalSettingsRepository().save(DEFAULT_SETTINGS);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).kind).toBe('quota');
  });
});

describe('LocalScratchStore', () => {
  it('草稿和进度的读写删往返一致', () => {
    const store = new LocalScratchStore();
    expect(store.readDraft('a')).toBeNull();
    store.writeDraft('a', '草稿');
    expect(store.readDraft('a')).toBe('草稿');
    expect(localStorage.getItem('wtp.draft.a')).toBe('草稿');
    store.removeDraft('a');
    expect(store.readDraft('a')).toBeNull();
    const point = { progress: 0.4, positionPx: 400, savedAt: 9 };
    store.writeProgress('a', point);
    expect(store.readProgress('a')).toEqual(point);
    store.removeProgress('a');
    expect(store.readProgress('a')).toBeNull();
  });

  it('进度数据不合法时返回 null', () => {
    const store = new LocalScratchStore();
    for (const raw of [
      'oops',
      'null',
      '{"progress":2,"positionPx":1,"savedAt":1}',
      '{"progress":0.5}',
    ]) {
      localStorage.setItem('wtp.progress.x', raw);
      expect(store.readProgress('x')).toBeNull();
    }
  });

  it('localStorage 抛错时读返回 null，写抛 StorageError', () => {
    const store = new LocalScratchStore();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(store.readDraft('a')).toBeNull();
    expect(store.readProgress('a')).toBeNull();
    expect(() => store.writeDraft('a', 'x')).toThrow(StorageError);
    expect(() => store.removeDraft('a')).not.toThrow();
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    let error: unknown;
    try {
      store.writeProgress('a', { progress: 0, positionPx: 0, savedAt: 0 });
    } catch (e) {
      error = e;
    }
    expect((error as StorageError).kind).toBe('unavailable');
  });
});
