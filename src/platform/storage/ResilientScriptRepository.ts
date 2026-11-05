import type { Script } from '@/core/models/script';
import type {
  MetaKey,
  QuarantinedRecord,
  RepositoryOpenResult,
  ScriptRepository,
} from '@/core/ports/repositories';

/** Safari 的 open 偶尔会挂起，超时后切到降级实现。 */
export const PRIMARY_OPEN_TIMEOUT_MS = 3000;

export interface ResilientScriptRepositoryOptions {
  openTimeoutMs?: number;
}

/**
 * 对外的仓储入口：open() 时先试 primary（IndexedDB），失败则切到 fallback，
 * 之后所有调用都转发给选中的那一个。调用方无需感知降级，只读取 open() 的 degraded。
 */
export class ResilientScriptRepository implements ScriptRepository {
  private selected: ScriptRepository | null = null;

  constructor(
    protected readonly primary: ScriptRepository,
    protected readonly fallback: ScriptRepository,
    protected readonly options: ResilientScriptRepositoryOptions = {},
  ) {}

  async open(): Promise<RepositoryOpenResult> {
    try {
      const result = await this.openPrimaryWithTimeout();
      this.selected = this.primary;
      return result;
    } catch {
      const result = await this.fallback.open();
      this.selected = this.fallback;
      return { ...result, degraded: true };
    }
  }

  list(): Promise<Script[]> {
    return this.target().list();
  }

  get(id: string): Promise<Script | undefined> {
    return this.target().get(id);
  }

  put(script: Script): Promise<void> {
    return this.target().put(script);
  }

  remove(id: string): Promise<void> {
    return this.target().remove(id);
  }

  getMeta<T>(key: MetaKey): Promise<T | undefined> {
    return this.target().getMeta<T>(key);
  }

  setMeta<T>(key: MetaKey, value: T): Promise<void> {
    return this.target().setMeta<T>(key, value);
  }

  listQuarantined(): Promise<QuarantinedRecord[]> {
    return this.target().listQuarantined();
  }

  private target(): ScriptRepository {
    if (!this.selected) throw new Error('ResilientScriptRepository: 必须先调用 open()');
    return this.selected;
  }

  private openPrimaryWithTimeout(): Promise<RepositoryOpenResult> {
    const timeoutMs = this.options.openTimeoutMs ?? PRIMARY_OPEN_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('primary open timeout')), timeoutMs);
      this.primary.open().then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}
