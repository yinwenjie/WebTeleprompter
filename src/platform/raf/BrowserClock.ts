import type { Clock } from '@/core/ports/clock';

export class BrowserClock implements Clock {
  now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  setTimeout(callback: () => void, delayMs: number): number {
    return window.setTimeout(callback, delayMs);
  }

  clearTimeout(handle: number): void {
    window.clearTimeout(handle);
  }
}
