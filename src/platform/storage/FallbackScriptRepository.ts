import type { Script } from '@/core/models/script';
import { validateScript } from '@/core/models/script';
import type {
  MetaKey,
  QuarantinedRecord,
  RepositoryOpenResult,
  ScriptRepository,
} from '@/core/ports/repositories';
import { readItem, writeItem } from './safeStorage';
import { LS_KEY_FALLBACK_SCRIPTS } from './schema';

interface Snapshot {
  scripts: unknown[];
  meta: Record<string, unknown>;
}

/** IndexedDB 不可用时的降级：内存为主，尽力镜像到 localStorage。open() 返回 degraded: true。 */
export class FallbackScriptRepository implements ScriptRepository {
  private scripts = new Map<string, Script>();
  private meta = new Map<string, unknown>();

  open(): Promise<RepositoryOpenResult> {
    this.scripts.clear();
    this.meta.clear();
    try {
      const raw = readItem(LS_KEY_FALLBACK_SCRIPTS);
      const snapshot = raw ? (JSON.parse(raw) as Partial<Snapshot>) : null;
      for (const item of Array.isArray(snapshot?.scripts) ? snapshot.scripts : []) {
        const result = validateScript(item);
        if (result.ok) this.scripts.set(result.value.id, result.value);
      }
      const meta = snapshot?.meta;
      if (meta && typeof meta === 'object') {
        for (const [key, value] of Object.entries(meta)) this.meta.set(key, value);
      }
    } catch {
      // 镜像损坏时从空仓库开始，内存模式仍可用。
    }
    return Promise.resolve({ degraded: true, quarantinedCount: 0 });
  }

  list(): Promise<Script[]> {
    const scripts = [...this.scripts.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    return Promise.resolve(scripts.map((s) => ({ ...s })));
  }

  get(id: string): Promise<Script | undefined> {
    const script = this.scripts.get(id);
    return Promise.resolve(script ? { ...script } : undefined);
  }

  put(script: Script): Promise<void> {
    this.scripts.set(script.id, { ...script });
    this.persist();
    return Promise.resolve();
  }

  remove(id: string): Promise<void> {
    this.scripts.delete(id);
    this.persist();
    return Promise.resolve();
  }

  getMeta<T>(key: MetaKey): Promise<T | undefined> {
    return Promise.resolve(this.meta.get(key) as T | undefined);
  }

  setMeta<T>(key: MetaKey, value: T): Promise<void> {
    this.meta.set(key, value);
    this.persist();
    return Promise.resolve();
  }

  listQuarantined(): Promise<QuarantinedRecord[]> {
    return Promise.resolve([]);
  }

  private persist(): void {
    try {
      const snapshot: Snapshot = {
        scripts: [...this.scripts.values()],
        meta: Object.fromEntries(this.meta),
      };
      writeItem(LS_KEY_FALLBACK_SCRIPTS, JSON.stringify(snapshot));
    } catch {
      // 尽力镜像，失败静默：内存中的数据仍然有效。
    }
  }
}
