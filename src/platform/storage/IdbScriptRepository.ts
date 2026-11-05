import type { Script } from '@/core/models/script';
import { notImplemented } from '@/core/not-implemented';
import type {
  MetaKey,
  QuarantinedRecord,
  RepositoryOpenResult,
  ScriptRepository,
} from '@/core/ports/repositories';

/** IndexedDB 实现。规格见 docs/dev/modules/platform-storage.md */
export class IdbScriptRepository implements ScriptRepository {
  open(): Promise<RepositoryOpenResult> {
    return notImplemented('IdbScriptRepository.open');
  }

  list(): Promise<Script[]> {
    return notImplemented('IdbScriptRepository.list');
  }

  get(_id: string): Promise<Script | undefined> {
    return notImplemented('IdbScriptRepository.get');
  }

  put(_script: Script): Promise<void> {
    return notImplemented('IdbScriptRepository.put');
  }

  remove(_id: string): Promise<void> {
    return notImplemented('IdbScriptRepository.remove');
  }

  getMeta<T>(_key: MetaKey): Promise<T | undefined> {
    return notImplemented('IdbScriptRepository.getMeta');
  }

  setMeta<T>(_key: MetaKey, _value: T): Promise<void> {
    return notImplemented('IdbScriptRepository.setMeta');
  }

  listQuarantined(): Promise<QuarantinedRecord[]> {
    return notImplemented('IdbScriptRepository.listQuarantined');
  }
}
