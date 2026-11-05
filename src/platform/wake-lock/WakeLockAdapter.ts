import { notImplemented } from '@/core/not-implemented';
import type { WakeLockPort, WakeLockStatus } from '@/core/ports/display';

/** 申请 / 释放 / 回到前台时重新申请。不支持时 status 为 unsupported。 */
export class WakeLockAdapter implements WakeLockPort {
  get status(): WakeLockStatus {
    return notImplemented('WakeLockAdapter.status');
  }

  acquire(): Promise<WakeLockStatus> {
    return notImplemented('WakeLockAdapter.acquire');
  }

  release(): Promise<void> {
    return notImplemented('WakeLockAdapter.release');
  }

  onChange(_listener: (status: WakeLockStatus) => void): () => void {
    return notImplemented('WakeLockAdapter.onChange');
  }
}
