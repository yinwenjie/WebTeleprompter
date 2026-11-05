import type { IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { Script } from '@/core/models/script';
import { validateScript } from '@/core/models/script';
import { runMigrations } from '@/core/migrations/runner';
import { scriptMigrations } from '@/core/migrations/script';
import type {
  MetaKey,
  QuarantinedRecord,
  RepositoryOpenResult,
  ScriptRepository,
} from '@/core/ports/repositories';
import { StorageError } from '@/core/ports/repositories';
import { isQuotaError } from './safeStorage';
import {
  IDB_INDEX_UPDATED_AT,
  IDB_NAME,
  IDB_STORE_META,
  IDB_STORE_SCRIPTS,
  IDB_VERSION,
  META_KEY_QUARANTINE,
} from './schema';

interface MetaRecord {
  key: string;
  value: unknown;
}

const CONNECTION_LOST = /connection to indexed database server lost/i;

/** 把浏览器的各种异常归一化为 StorageError。 */
export function toStorageError(error: unknown, phase: 'open' | 'op' = 'op'): StorageError {
  if (error instanceof StorageError) return error;
  const name = (error as { name?: string } | null)?.name;
  if (isQuotaError(error)) return new StorageError('quota', '存储空间不足', { cause: error });
  if (name === 'AbortError') {
    const inner = (error as { target?: { error?: unknown }; cause?: unknown }).target?.error;
    if (isQuotaError(inner)) return new StorageError('quota', '存储空间不足', { cause: error });
  }
  if (name === 'VersionError') {
    return new StorageError('unavailable', '数据库版本高于当前页面', { cause: error });
  }
  if (phase === 'open' && (name === 'InvalidStateError' || name === 'SecurityError')) {
    return new StorageError('unavailable', 'IndexedDB 不可用', { cause: error });
  }
  return new StorageError('unknown', 'IndexedDB 操作失败', { cause: error });
}

function isConnectionLost(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? '';
  return CONNECTION_LOST.test(message);
}

/** IndexedDB 实现。规格见 docs/dev/modules/platform-storage.md */
export class IdbScriptRepository implements ScriptRepository {
  private db: IDBPDatabase | null = null;

  async open(): Promise<RepositoryOpenResult> {
    try {
      const db = await this.connect();
      const quarantinedCount = await this.quarantineInvalid(db);
      this.requestPersistence();
      return { degraded: false, quarantinedCount };
    } catch (error) {
      throw toStorageError(error, 'open');
    }
  }

  async list(): Promise<Script[]> {
    return this.run(async (db) => {
      const tx = db.transaction(IDB_STORE_SCRIPTS, 'readonly');
      const scripts: Script[] = [];
      let cursor = await tx.store.index(IDB_INDEX_UPDATED_AT).openCursor(null, 'prev');
      while (cursor) {
        scripts.push(cursor.value as Script);
        cursor = await cursor.continue();
      }
      await tx.done;
      return scripts;
    });
  }

  get(id: string): Promise<Script | undefined> {
    return this.run((db) => db.get(IDB_STORE_SCRIPTS, id) as Promise<Script | undefined>);
  }

  put(script: Script): Promise<void> {
    return this.run(async (db) => {
      const tx = db.transaction(IDB_STORE_SCRIPTS, 'readwrite');
      void tx.store.put(script).catch(() => {});
      await tx.done;
    });
  }

  remove(id: string): Promise<void> {
    return this.run(async (db) => {
      const tx = db.transaction(IDB_STORE_SCRIPTS, 'readwrite');
      void tx.store.delete(id).catch(() => {});
      await tx.done;
    });
  }

  getMeta<T>(key: MetaKey): Promise<T | undefined> {
    return this.run(async (db) => {
      const record = (await db.get(IDB_STORE_META, key)) as MetaRecord | undefined;
      return record?.value as T | undefined;
    });
  }

  setMeta<T>(key: MetaKey, value: T): Promise<void> {
    return this.run(async (db) => {
      const tx = db.transaction(IDB_STORE_META, 'readwrite');
      void tx.store.put({ key, value } satisfies MetaRecord).catch(() => {});
      await tx.done;
    });
  }

  listQuarantined(): Promise<QuarantinedRecord[]> {
    return this.run(async (db) => {
      const record = (await db.get(IDB_STORE_META, META_KEY_QUARANTINE)) as MetaRecord | undefined;
      return Array.isArray(record?.value) ? (record.value as QuarantinedRecord[]) : [];
    });
  }

  private async connect(): Promise<IDBPDatabase> {
    if (this.db) return this.db;
    if (typeof indexedDB === 'undefined' || indexedDB === null) {
      throw new StorageError('unavailable', 'IndexedDB 不可用');
    }
    const db = await openDB(IDB_NAME, IDB_VERSION, {
      upgrade(database, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          const scripts = database.createObjectStore(IDB_STORE_SCRIPTS, { keyPath: 'id' });
          scripts.createIndex(IDB_INDEX_UPDATED_AT, 'updatedAt');
          database.createObjectStore(IDB_STORE_META, { keyPath: 'key' });
          return;
        }
        // 今后的版本：在同一个 versionchange 事务内把旧稿件升到最新 schema。
        if (scriptMigrations.length === 0) return;
        void (async () => {
          let cursor = await transaction.objectStore(IDB_STORE_SCRIPTS).openCursor();
          while (cursor) {
            const migrated = runMigrations(
              cursor.value as Record<string, unknown>,
              scriptMigrations,
            );
            if (migrated.ok) await cursor.update(migrated.value);
            cursor = await cursor.continue();
          }
        })();
      },
      blocking: () => {
        this.db?.close();
        this.db = null;
      },
      terminated: () => {
        this.db = null;
      },
    });
    this.db = db;
    return db;
  }

  /** 校验失败的稿件移入隔离区并从 scripts 删除，同一个读写事务内完成。返回隔离区总数。 */
  private async quarantineInvalid(db: IDBPDatabase): Promise<number> {
    const tx = db.transaction([IDB_STORE_SCRIPTS, IDB_STORE_META], 'readwrite');
    const meta = tx.objectStore(IDB_STORE_META);
    const existing = (await meta.get(META_KEY_QUARANTINE)) as MetaRecord | undefined;
    const records: QuarantinedRecord[] = Array.isArray(existing?.value)
      ? [...(existing.value as QuarantinedRecord[])]
      : [];
    const before = records.length;
    let cursor = await tx.objectStore(IDB_STORE_SCRIPTS).openCursor();
    while (cursor) {
      const raw: unknown = cursor.value;
      const result = validateScript(raw);
      if (!result.ok) {
        records.push({ key: String(cursor.primaryKey), raw, reason: result.reason });
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    if (records.length > before) {
      await meta.put({ key: META_KEY_QUARANTINE, value: records } satisfies MetaRecord);
    }
    await tx.done;
    return records.length;
  }

  private requestPersistence(): void {
    try {
      const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
      void storage?.persist?.().catch(() => {});
    } catch {
      // 持久化请求失败不影响使用（R-3）。
    }
  }

  /** Safari 偶发“Connection to Indexed Database server lost”：重新打开并重试一次。 */
  private async run<T>(operation: (db: IDBPDatabase) => Promise<T>): Promise<T> {
    try {
      return await operation(await this.connect());
    } catch (error) {
      const closedUnderUs =
        this.db === null && (error as { name?: string } | null)?.name === 'InvalidStateError';
      if (!isConnectionLost(error) && !closedUnderUs) throw toStorageError(error);
      this.db?.close();
      this.db = null;
      try {
        return await operation(await this.connect());
      } catch (retryError) {
        throw toStorageError(retryError);
      }
    }
  }
}
