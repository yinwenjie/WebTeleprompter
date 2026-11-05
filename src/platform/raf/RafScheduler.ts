import { notImplemented } from '@/core/not-implemented';
import type { FrameScheduler } from '@/core/scroll-engine/types';

/** requestAnimationFrame 的薄封装。dt 截断在引擎内做，这里不含业务逻辑（D-06）。 */
export class RafScheduler implements FrameScheduler {
  request(_callback: (nowMs: number) => void): number {
    return notImplemented('RafScheduler.request');
  }

  cancel(_id: number): void {
    notImplemented('RafScheduler.cancel');
  }
}
