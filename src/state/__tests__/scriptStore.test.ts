import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createExportBundle } from '@/core/models/export-bundle';
import type { Script } from '@/core/models/script';
import { createScript } from '@/core/models/script';
import { DEFAULT_SETTINGS } from '@/core/models/settings';
import type { FileIOPort, PickedTextFile } from '@/core/ports/file-io';
import type {
  MetaKey,
  ProgressPoint,
  QuarantinedRecord,
  RepositoryOpenResult,
  ScratchStore,
  ScriptRepository,
} from '@/core/ports/repositories';
import { StorageError } from '@/core/ports/repositories';
import { FakeClock } from '@/core/testing/fakes';
import { t } from '@/i18n';
import { createScriptStore, type ScriptStore } from '../scriptStore';

class MemoryRepository implements ScriptRepository {
  scripts = new Map<string, Script>();
  meta = new Map<string, unknown>();
  quarantined: QuarantinedRecord[] = [];
  puts: Script[] = [];
  failPut: StorageError | null = null;
  /** 设置后 put 等待外部 resolve，用于模拟“落库中”。 */
  gate: Promise<void> | null = null;
  openResult: RepositoryOpenResult = { degraded: false, quarantinedCount: 0 };
  failList = false;

  open() {
    return Promise.resolve(this.openResult);
  }
  list() {
    if (this.failList) return Promise.reject(new StorageError('unknown', 'x'));
    return Promise.resolve([...this.scripts.values()].sort((a, b) => b.updatedAt - a.updatedAt));
  }
  get(id: string) {
    return Promise.resolve(this.scripts.get(id));
  }
  async put(script: Script) {
    if (this.gate) await this.gate;
    if (this.failPut) throw this.failPut;
    this.puts.push(structuredClone(script));
    this.scripts.set(script.id, structuredClone(script));
  }
  remove(id: string) {
    this.scripts.delete(id);
    return Promise.resolve();
  }
  getMeta<T>(key: MetaKey) {
    return Promise.resolve(this.meta.get(key) as T | undefined);
  }
  setMeta<T>(key: MetaKey, value: T) {
    this.meta.set(key, value);
    return Promise.resolve();
  }
  listQuarantined() {
    return Promise.resolve(this.quarantined);
  }
}

class MemoryScratch implements ScratchStore {
  drafts = new Map<string, string>();
  progress = new Map<string, ProgressPoint>();
  draftWrites = 0;
  failWrites = false;
  readDraft(id: string) {
    return this.drafts.get(id) ?? null;
  }
  writeDraft(id: string, text: string) {
    if (this.failWrites) throw new StorageError('quota', 'x');
    this.draftWrites += 1;
    this.drafts.set(id, text);
  }
  removeDraft(id: string) {
    this.drafts.delete(id);
  }
  readProgress(id: string) {
    return this.progress.get(id) ?? null;
  }
  writeProgress(id: string, point: ProgressPoint) {
    if (this.failWrites) throw new StorageError('quota', 'x');
    this.progress.set(id, point);
  }
  removeProgress(id: string) {
    this.progress.delete(id);
  }
}

class FakeFileIO implements FileIOPort {
  next: PickedTextFile | null = null;
  saved: Array<{ name: string; mime: string; text: string }> = [];
  pickTextFile() {
    return Promise.resolve(this.next);
  }
  saveTextFile(name: string, mime: string, text: string) {
    this.saved.push({ name, mime, text });
    return Promise.resolve();
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const settle = async () => {
  for (let i = 0; i < 5; i += 1) await tick();
};

let repo: MemoryRepository;
let scratch: MemoryScratch;
let fileIO: FakeFileIO;
let clock: FakeClock;
let store: ScriptStore;
let ids: number;

function makeStore() {
  return createScriptStore({
    repository: repo,
    scratch,
    fileIO,
    clock,
    generateId: () => `id-${++ids}`,
    getSettingsForExport: () => DEFAULT_SETTINGS,
  });
}

function seed(...scripts: Script[]) {
  for (const s of scripts) repo.scripts.set(s.id, s);
  repo.meta.set('seededSample', true);
}

const script = (id: string, updatedAt: number, content = `内容${id}`) => ({
  ...createScript({ id, title: `稿${id}`, content, now: 1 }),
  updatedAt,
});

beforeEach(() => {
  repo = new MemoryRepository();
  scratch = new MemoryScratch();
  fileIO = new FakeFileIO();
  clock = new FakeClock();
  clock.advance(1_000_000);
  ids = 0;
  store = makeStore();
});

const state = () => store.getState();

// 规格：docs/dev/modules/state-script.md。用内存假仓储和 FakeClock。
describe('scriptStore', () => {
  it('首次 load 预置示例稿并写 seededSample；删光稿件后再次 load 不重新预置', async () => {
    await state().load();
    expect(state().ready).toBe(true);
    expect(state().scripts).toHaveLength(1);
    expect(state().scripts[0]!.title).toBe(t('sample.title'));
    expect(state().activeScriptId).toBe('id-1');
    expect(state().draft).toBe(t('sample.content'));
    expect(repo.meta.get('seededSample')).toBe(true);
    await state().remove('id-1');
    expect(state().activeScriptId).toBeNull();

    store = makeStore();
    await state().load();
    expect(state().scripts).toEqual([]);
    expect(state().activeScriptId).toBeNull();
  });

  it('activeScriptId 优先取 meta 中仍存在的值，否则取最近更新的稿件', async () => {
    seed(script('a', 10), script('b', 20));
    repo.meta.set('activeScriptId', 'a');
    await state().load();
    expect(state().activeScriptId).toBe('a');
    repo.meta.set('activeScriptId', 'gone');
    store = makeStore();
    await state().load();
    expect(state().activeScriptId).toBe('b');
  });

  it('8-5：load 时存在草稿则恢复草稿，并标记 pending 重新落库', async () => {
    seed(script('a', 10, '旧'));
    scratch.drafts.set('a', '崩溃前的草稿');
    await state().load();
    expect(state().draft).toBe('崩溃前的草稿');
    expect(['pending', 'saving']).toContain(state().saveStatus);
    await settle();
    expect(repo.scripts.get('a')!.content).toBe('崩溃前的草稿');
    expect(scratch.drafts.has('a')).toBe(false);
    expect(state().saveStatus).toBe('saved');
  });

  it('非当前稿件的草稿暂存在 load 时直接落库', async () => {
    seed(script('a', 10), script('b', 20));
    scratch.drafts.set('a', '另一份草稿');
    await state().load();
    expect(state().activeScriptId).toBe('b');
    expect(repo.scripts.get('a')!.content).toBe('另一份草稿');
    expect(scratch.drafts.has('a')).toBe(false);
  });

  it('8-5：load 时合并 wtp.progress.* 到稿件进度，且不改 updatedAt', async () => {
    seed(script('a', 10));
    scratch.progress.set('a', { progress: 0.42, positionPx: 420, savedAt: 5 });
    await state().load();
    expect(state().scripts[0]).toMatchObject({
      lastProgress: 0.42,
      lastPositionPx: 420,
      updatedAt: 10,
    });
    expect(repo.scripts.get('a')).toMatchObject({ lastProgress: 0.42, updatedAt: 10 });
    expect(scratch.progress.has('a')).toBe(false);
  });

  it('D-19：updateDraft 立即更新内存，暂存节流 100ms，500ms 防抖后落库，成功后删除暂存', async () => {
    seed(script('a', 10, '原文'));
    await state().load();
    state().updateDraft('一');
    expect(state().draft).toBe('一');
    expect(state().saveStatus).toBe('pending');
    expect(scratch.drafts.get('a')).toBe('一');
    clock.advance(30);
    state().updateDraft('一二');
    clock.advance(30);
    state().updateDraft('一二三');
    expect(scratch.drafts.get('a')).toBe('一');
    clock.advance(40);
    expect(scratch.drafts.get('a')).toBe('一二三');
    expect(repo.puts).toHaveLength(0);
    clock.advance(459);
    await settle();
    expect(repo.puts).toHaveLength(0);
    clock.advance(1);
    await settle();
    expect(repo.scripts.get('a')!.content).toBe('一二三');
    expect(repo.scripts.get('a')!.charCount).toBe(3);
    expect(scratch.drafts.has('a')).toBe(false);
    expect(state().saveStatus).toBe('saved');
    expect(state().scripts[0]!.content).toBe('一二三');
  });

  it('D-19：persistOnPageHide 同步写出尚未写入暂存的草稿和播放位置', async () => {
    seed(script('a', 10, '原文'));
    await state().load();
    state().updateDraft('x');
    clock.advance(10);
    state().updateDraft('xy');
    expect(scratch.drafts.get('a')).toBe('x');
    state().persistOnPageHide({ progress: 0.3, positionPx: 300 });
    expect(scratch.drafts.get('a')).toBe('xy');
    expect(scratch.progress.get('a')).toMatchObject({ progress: 0.3, positionPx: 300 });
  });

  it('连续输入只落库一次，保存的是最新内容', async () => {
    seed(script('a', 10));
    await state().load();
    for (const text of ['a', 'ab', 'abc', 'abcd']) {
      state().updateDraft(text);
      clock.advance(200);
    }
    clock.advance(500);
    await settle();
    expect(repo.puts).toHaveLength(1);
    expect(repo.puts[0]!.content).toBe('abcd');
  });

  it('输入 → 落库中再次输入 → 第一次成功：暂存不删除，第二次落库', async () => {
    seed(script('a', 10));
    await state().load();
    let release!: () => void;
    repo.gate = new Promise((resolve) => (release = resolve));
    state().updateDraft('第一次');
    clock.advance(500);
    await settle();
    expect(state().saveStatus).toBe('saving');
    state().updateDraft('第二次');
    repo.gate = null;
    release();
    await settle();
    expect(repo.puts.map((p) => p.content)).toEqual(['第一次']);
    expect(scratch.drafts.get('a')).toBe('第二次');
    expect(state().saveStatus).toBe('pending');
    clock.advance(500);
    await settle();
    expect(repo.puts.map((p) => p.content)).toEqual(['第一次', '第二次']);
    expect(scratch.drafts.has('a')).toBe(false);
    expect(state().saveStatus).toBe('saved');
  });

  it('落库失败时 saveStatus 为 error，暂存不删除，draft 不丢', async () => {
    seed(script('a', 10));
    await state().load();
    repo.failPut = new StorageError('quota', 'full');
    state().updateDraft('重要内容');
    clock.advance(500);
    await settle();
    expect(state().saveStatus).toBe('error');
    expect(state().lastErrorKind).toBe('quota');
    expect(state().draft).toBe('重要内容');
    expect(scratch.drafts.get('a')).toBe('重要内容');
  });

  it('put 失败 → 下次输入 → put 成功：状态恢复 saved，暂存删除', async () => {
    seed(script('a', 10));
    await state().load();
    repo.failPut = new StorageError('unknown', 'x');
    state().updateDraft('v1');
    clock.advance(500);
    await settle();
    expect(state().saveStatus).toBe('error');
    repo.failPut = null;
    state().updateDraft('v2');
    clock.advance(500);
    await settle();
    expect(state().saveStatus).toBe('saved');
    expect(state().lastErrorKind).toBeNull();
    expect(scratch.drafts.has('a')).toBe(false);
    expect(repo.scripts.get('a')!.content).toBe('v2');
  });

  it('D-09：savePlaybackPoint 不改 updatedAt', async () => {
    seed(script('a', 10));
    await state().load();
    await state().savePlaybackPoint({ progress: 0.5, positionPx: 500 });
    expect(repo.scripts.get('a')).toMatchObject({
      lastProgress: 0.5,
      lastPositionPx: 500,
      updatedAt: 10,
    });
    expect(state().scripts[0]!.updatedAt).toBe(10);
  });

  it('savePlaybackPoint 失败时写入进度暂存', async () => {
    seed(script('a', 10));
    await state().load();
    repo.failPut = new StorageError('quota', 'x');
    await state().savePlaybackPoint({ progress: 0.25, positionPx: 50 });
    expect(scratch.progress.get('a')).toMatchObject({ progress: 0.25, positionPx: 50 });
  });

  it('进度保存和内容保存同时排队：两边的字段都不丢', async () => {
    seed(script('a', 10, '旧'));
    await state().load();
    let release!: () => void;
    repo.gate = new Promise((resolve) => (release = resolve));
    state().updateDraft('新内容');
    clock.advance(500);
    const progress = state().savePlaybackPoint({ progress: 0.7, positionPx: 70 });
    repo.gate = null;
    release();
    await progress;
    await settle();
    expect(repo.scripts.get('a')).toMatchObject({
      content: '新内容',
      lastProgress: 0.7,
      lastPositionPx: 70,
    });

    const reversed = state().savePlaybackPoint({ progress: 0.9, positionPx: 90 });
    state().updateDraft('更新的内容');
    await reversed;
    await state().flush();
    expect(repo.scripts.get('a')).toMatchObject({ content: '更新的内容', lastProgress: 0.9 });
  });

  it('切换稿件前先 flush 当前草稿', async () => {
    seed(script('a', 10), script('b', 20));
    await state().load();
    expect(state().activeScriptId).toBe('b');
    state().updateDraft('b 的新内容');
    await state().setActive('a');
    expect(repo.scripts.get('b')!.content).toBe('b 的新内容');
    expect(state().activeScriptId).toBe('a');
    expect(state().draft).toBe('内容a');
    expect(repo.meta.get('activeScriptId')).toBe('a');
    clock.advance(1000);
    await settle();
    expect(repo.puts.filter((p) => p.id === 'a')).toHaveLength(0);
  });

  it('删除当前稿件后切到最近更新的稿件；全部删除后 activeScriptId 为 null', async () => {
    seed(script('a', 10), script('b', 30), script('c', 20));
    await state().load();
    expect(state().activeScriptId).toBe('b');
    await state().remove('b');
    expect(state().activeScriptId).toBe('c');
    expect(repo.scripts.has('b')).toBe(false);
    await state().remove('a');
    expect(state().activeScriptId).toBe('c');
    await state().remove('c');
    expect(state().activeScriptId).toBeNull();
    expect(state().draft).toBe('');
  });

  it('暂存写入失败不影响编辑', async () => {
    seed(script('a', 10));
    await state().load();
    scratch.failWrites = true;
    expect(() => state().updateDraft('仍然可以输入')).not.toThrow();
    expect(state().draft).toBe('仍然可以输入');
    clock.advance(500);
    await settle();
    expect(repo.scripts.get('a')!.content).toBe('仍然可以输入');
    expect(() => state().persistOnPageHide({ progress: 0, positionPx: 0 })).not.toThrow();
  });

  it('create、rename 写入仓储，rename 更新 updatedAt', async () => {
    seed(script('a', 10));
    await state().load();
    const id = await state().create();
    expect(state().activeScriptId).toBe(id);
    expect(repo.scripts.get(id)!.title).toBe(t('script.untitled'));
    clock.advance(5);
    await state().rename('a', '新标题');
    expect(repo.scripts.get('a')).toMatchObject({ title: '新标题', updatedAt: clock.now() });
    expect(state().scripts[0]!.id).toBe('a');
  });

  it('importTextFile 以文件名为标题新建并切换', async () => {
    seed(script('a', 10));
    await state().load();
    fileIO.next = { name: '演讲稿.txt', text: '第一段\n\n第二段' };
    await state().importTextFile();
    expect(state().activeScriptId).toBe('id-1');
    expect(repo.scripts.get('id-1')).toMatchObject({
      title: '演讲稿',
      content: '第一段\n\n第二段',
    });
    fileIO.next = null;
    await state().importTextFile();
    expect(state().scripts).toHaveLength(2);
  });

  it('导入：id 冲突走 resolveImportConflicts，损坏文件给出错误且不影响现有数据', async () => {
    seed(script('a', 10));
    await state().load();
    const bundle = createExportBundle(
      [script('a', 5, '导入的 a'), script('z', 6)],
      DEFAULT_SETTINGS,
      1,
    );
    fileIO.next = { name: 'b.json', text: JSON.stringify(bundle) };
    await state().importBundle();
    expect(repo.scripts.get('a')!.content).toBe('内容a');
    expect(repo.scripts.get('id-1')).toMatchObject({
      title: `稿a ${t('import.titleSuffix')}`,
      content: '导入的 a',
    });
    expect(repo.scripts.has('z')).toBe(true);
    expect(state().activeScriptId).toBe('a');

    const before = structuredClone([...repo.scripts.values()]);
    for (const text of ['{broken', JSON.stringify({ app: 'other', scripts: [] })]) {
      fileIO.next = { name: 'bad.json', text };
      const error = await state()
        .importBundle()
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(StorageError);
      expect((error as StorageError).kind).toBe('corrupt');
    }
    expect([...repo.scripts.values()]).toEqual(before);
  });

  it('exportTextFile 导出当前草稿，文件名为标题', async () => {
    seed(script('a', 10));
    await state().load();
    state().updateDraft('最新');
    await state().exportTextFile('a');
    expect(fileIO.saved[0]).toEqual({
      name: '稿a.txt',
      mime: 'text/plain;charset=utf-8',
      text: '最新',
    });
  });

  it('exportBundle 在存储损坏时退回内存并包含未落库的草稿', async () => {
    seed(script('a', 10));
    await state().load();
    repo.failPut = new StorageError('quota', 'x');
    repo.failList = true;
    state().updateDraft('没保存上的内容');
    await state().exportBundle();
    const saved = fileIO.saved[0]!;
    expect(saved.name).toMatch(/^webteleprompter-backup-\d{8}-\d{4}\.json$/);
    const bundle = JSON.parse(saved.text);
    expect(bundle.app).toBe('webteleprompter');
    expect(bundle.scripts[0].content).toBe('没保存上的内容');
    expect(bundle.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('exportQuarantined 导出隔离区原始数据', async () => {
    repo.quarantined = [{ key: 'x', raw: { id: 'x' }, reason: 'missing-content' }];
    repo.openResult = { degraded: false, quarantinedCount: 1 };
    await state().load();
    expect(state().quarantinedCount).toBe(1);
    await state().exportQuarantined();
    expect(JSON.parse(fileIO.saved[0]!.text)).toEqual(repo.quarantined);
  });

  it('load 内部捕获全部错误，不向外 reject', async () => {
    vi.spyOn(repo, 'open').mockRejectedValue(new StorageError('unavailable', 'x'));
    await expect(state().load()).resolves.toBeUndefined();
    expect(state().ready).toBe(true);
  });

  it('degraded 仓储反映到 storageDegraded', async () => {
    repo.openResult = { degraded: true, quarantinedCount: 0 };
    await state().load();
    expect(state().storageDegraded).toBe(true);
  });
});
