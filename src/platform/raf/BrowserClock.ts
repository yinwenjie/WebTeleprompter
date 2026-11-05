import { notImplemented } from '@/core/not-implemented';
import type { Clock } from '@/core/ports/clock';

export class BrowserClock implements Clock {
  now(): number {
    return notImplemented('BrowserClock.now');
  }

  setTimeout(_callback: () => void, _delayMs: number): number {
    return notImplemented('BrowserClock.setTimeout');
  }

  clearTimeout(_handle: number): void {
    notImplemented('BrowserClock.clearTimeout');
  }
}
