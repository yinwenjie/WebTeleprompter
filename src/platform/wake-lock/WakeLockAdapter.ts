import type { WakeLockPort, WakeLockStatus } from '@/core/ports/display';

interface Sentinel {
  released?: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

interface WakeLockApi {
  request(type: 'screen'): Promise<Sentinel>;
}

function getApi(): WakeLockApi | null {
  const nav =
    typeof navigator !== 'undefined' ? (navigator as unknown as { wakeLock?: WakeLockApi }) : null;
  return nav?.wakeLock && typeof nav.wakeLock.request === 'function' ? nav.wakeLock : null;
}

/** 申请 / 释放 / 回到前台时重新申请。不支持时 status 为 unsupported。 */
export class WakeLockAdapter implements WakeLockPort {
  private current: WakeLockStatus;
  private wanted = false;
  private sentinel: Sentinel | null = null;
  private pending: Promise<WakeLockStatus> | null = null;
  private listeners: Array<(status: WakeLockStatus) => void> = [];

  constructor() {
    this.current = getApi() ? 'inactive' : 'unsupported';
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.wanted && !this.sentinel) {
          void this.acquire();
        }
      });
    }
  }

  get status(): WakeLockStatus {
    return this.current;
  }

  acquire(): Promise<WakeLockStatus> {
    this.wanted = true;
    const api = getApi();
    if (!api) {
      this.setStatus('unsupported');
      return Promise.resolve(this.current);
    }
    if (this.sentinel) return Promise.resolve(this.current);
    if (this.pending) return this.pending;
    let request: Promise<Sentinel>;
    try {
      request = api.request('screen');
    } catch {
      this.setStatus('denied');
      return Promise.resolve(this.current);
    }
    this.pending = request.then(
      (sentinel) => {
        this.pending = null;
        if (!this.wanted) {
          sentinel.release().catch(() => {});
          return this.current;
        }
        this.sentinel = sentinel;
        sentinel.addEventListener('release', () => {
          if (this.sentinel !== sentinel) return;
          this.sentinel = null;
          this.setStatus('inactive');
        });
        this.setStatus('active');
        return this.current;
      },
      () => {
        this.pending = null;
        this.setStatus('denied');
        return this.current;
      },
    );
    return this.pending;
  }

  async release(): Promise<void> {
    this.wanted = false;
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel) {
      try {
        await sentinel.release();
      } catch {
        // 已被系统释放时可能抛错，忽略。
      }
    }
    if (this.current === 'active') this.setStatus('inactive');
  }

  onChange(listener: (status: WakeLockStatus) => void): () => void {
    this.listeners = [...this.listeners, listener];
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private setStatus(status: WakeLockStatus): void {
    if (status === this.current) return;
    this.current = status;
    for (const listener of this.listeners) listener(status);
  }
}
