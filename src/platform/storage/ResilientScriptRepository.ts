import type { Script } from '@/core/models/script';
import { notImplemented } from '@/core/not-implemented';
import type {
  MetaKey,
  QuarantinedRecord,
  RepositoryOpenResult,
  ScriptRepository,
} from '@/core/ports/repositories';

/**
 * 对外的仓储入口：open() 时先试 primary（IndexedDB），失败则切到 fallback，
 * 之后所有调用都转发给选中的那一个。调用方无需感知降级，只读取 open() 的 degraded。
 */
export class ResilientScriptRepository implements ScriptRepository {
  constructor(
    protected readonly primary: ScriptRepository,
    protected readonly fallback: ScriptRepository,
  ) {}

  open(): Promise<RepositoryOpenResult> {
    return notImplemented('ResilientScriptRepository.open');
  }

  list(): Promise<Script[]> {
    return notImplemented('ResilientScriptRepository.list');
  }

  get(_id: string): Promise<Script | undefined> {
    return notImplemented('ResilientScriptRepository.get');
  }

  put(_script: Script): Promise<void> {
    return notImplemented('ResilientScriptRepository.put');
  }

  remove(_id: string): Promise<void> {
    return notImplemented('ResilientScriptRepository.remove');
  }

  getMeta<T>(_key: MetaKey): Promise<T | undefined> {
    return notImplemented('ResilientScriptRepository.getMeta');
  }

  setMeta<T>(_key: MetaKey, _value: T): Promise<void> {
    return notImplemented('ResilientScriptRepository.setMeta');
  }

  listQuarantined(): Promise<QuarantinedRecord[]> {
    return notImplemented('ResilientScriptRepository.listQuarantined');
  }
}
