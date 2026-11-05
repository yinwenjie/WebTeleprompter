import { notImplemented } from '@/core/not-implemented';
import type { ActivityPort } from '@/core/ports/display';

/** pointermove / pointerdown / keydown → 活动信号，供控件自动隐藏（节流到每 250ms 最多一次）。 */
export class ActivityMonitor implements ActivityPort {
  onActivity(_listener: () => void): () => void {
    return notImplemented('ActivityMonitor.onActivity');
  }
}
