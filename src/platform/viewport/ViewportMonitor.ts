import { notImplemented } from '@/core/not-implemented';
import type { ViewportClass, ViewportPort } from '@/core/ports/display';

export const VIEWPORT_BREAKPOINTS = { tabletMinPx: 600, desktopMinPx: 1024 } as const;

/** 基于 matchMedia 判断设备档位。 */
export class ViewportMonitor implements ViewportPort {
  get current(): ViewportClass {
    return notImplemented('ViewportMonitor.current');
  }

  onChange(_listener: (viewport: ViewportClass) => void): () => void {
    return notImplemented('ViewportMonitor.onChange');
  }
}
