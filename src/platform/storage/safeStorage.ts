import { StorageError } from '@/core/ports/repositories';

/** 部分隐私模式下连读取 window.localStorage 属性都会抛错。 */
export function getLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readItem(key: string): string | null {
  try {
    return getLocalStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, code } = error as { name?: string; code?: number };
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}

/** 写失败抛 StorageError('quota' 或 'unavailable')。 */
export function writeItem(key: string, value: string): void {
  const storage = getLocalStorage();
  if (!storage) throw new StorageError('unavailable', 'localStorage 不可用');
  try {
    storage.setItem(key, value);
  } catch (error) {
    throw new StorageError(isQuotaError(error) ? 'quota' : 'unavailable', 'localStorage 写入失败', {
      cause: error,
    });
  }
}

export function removeItem(key: string): void {
  try {
    getLocalStorage()?.removeItem(key);
  } catch {
    // 删除失败静默。
  }
}
