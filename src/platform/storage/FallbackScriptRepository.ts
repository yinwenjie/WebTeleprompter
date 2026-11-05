import type { Script } from '@/core/models/script';
import { notImplemented } from '@/core/not-implemented';
import type {
  MetaKey,
  QuarantinedRecord,
  RepositoryOpenResult,
  ScriptRepository,
} from '@/core/ports/repositories';

/** IndexedDB 不可用时的降级：内存为主，尽力镜像到 localStorage。open() 返回 degraded: true。 */
export class FallbackScriptRepository implements ScriptRepository {
  open(): Promise<RepositoryOpenResult> {
    return notImplemented('FallbackScriptRepository.open');
  }

  list(): Promise<Script[]> {
    return notImplemented('FallbackScriptRepository.list');
  }

  get(_id: string): Promise<Script | undefined> {
    return notImplemented('FallbackScriptRepository.get');
  }

  put(_script: Script): Promise<void> {
    return notImplemented('FallbackScriptRepository.put');
  }

  remove(_id: string): Promise<void> {
    return notImplemented('FallbackScriptRepository.remove');
  }

  getMeta<T>(_key: MetaKey): Promise<T | undefined> {
    return notImplemented('FallbackScriptRepository.getMeta');
  }

  setMeta<T>(_key: MetaKey, _value: T): Promise<void> {
    return notImplemented('FallbackScriptRepository.setMeta');
  }

  listQuarantined(): Promise<QuarantinedRecord[]> {
    return notImplemented('FallbackScriptRepository.listQuarantined');
  }
}
