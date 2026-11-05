import type { Clock } from '@/core/ports/clock';

export class BrowserClock implements Clock {
  /** epoch ms：scriptStore 用它生成 createdAt / updatedAt，所以不能用 performance.now。 */
  now(): number {
    return Date.now();
  }

  setTimeout(callback: () => void, delayMs: number): number {
    return window.setTimeout(callback, delayMs);
  }

  clearTimeout(handle: number): void {
    window.clearTimeout(handle);
  }
}
