import type { FrameScheduler } from '@/core/scroll-engine/types';

/** requestAnimationFrame 的薄封装。dt 截断在引擎内做，这里不含业务逻辑（D-06）。 */
export class RafScheduler implements FrameScheduler {
  request(callback: (nowMs: number) => void): number {
    return window.requestAnimationFrame(callback);
  }

  cancel(id: number): void {
    window.cancelAnimationFrame(id);
  }
}
