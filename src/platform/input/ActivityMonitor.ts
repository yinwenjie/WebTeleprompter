import type { ActivityPort } from '@/core/ports/display';

export const ACTIVITY_THROTTLE_MS = 250;
const EVENTS = ['pointermove', 'pointerdown', 'keydown'] as const;

/** pointermove / pointerdown / keydown → 活动信号，供控件自动隐藏（节流到每 250ms 最多一次）。 */
export class ActivityMonitor implements ActivityPort {
  constructor(private readonly now: () => number = () => performance.now()) {}

  onActivity(listener: () => void): () => void {
    let last = Number.NEGATIVE_INFINITY;
    const handler = () => {
      const now = this.now();
      if (now - last < ACTIVITY_THROTTLE_MS) return;
      last = now;
      listener();
    };
    for (const type of EVENTS) window.addEventListener(type, handler, { passive: true });
    return () => {
      for (const type of EVENTS) window.removeEventListener(type, handler);
    };
  }
}
