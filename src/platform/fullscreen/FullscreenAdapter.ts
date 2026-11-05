import { notImplemented } from '@/core/not-implemented';
import type { FullscreenMode, FullscreenPort } from '@/core/ports/display';

/** 原生 Fullscreen（含 webkit 前缀）与“页面内全屏”降级的统一接口。 */
export class FullscreenAdapter implements FullscreenPort {
  constructor(protected readonly element: HTMLElement) {}

  get mode(): FullscreenMode {
    return notImplemented('FullscreenAdapter.mode');
  }

  enter(): Promise<FullscreenMode> {
    return notImplemented('FullscreenAdapter.enter');
  }

  exit(): Promise<void> {
    return notImplemented('FullscreenAdapter.exit');
  }

  onChange(_listener: (mode: FullscreenMode) => void): () => void {
    return notImplemented('FullscreenAdapter.onChange');
  }
}
