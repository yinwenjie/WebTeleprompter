import { notImplemented } from '@/core/not-implemented';
import type { PageLifecyclePort } from '@/core/ports/display';

/** visibilitychange / pagehide 的封装。bootstrap 把 hidden 转成 pause 命令（D-06）。 */
export class PageLifecycle implements PageLifecyclePort {
  onHidden(_listener: () => void): () => void {
    return notImplemented('PageLifecycle.onHidden');
  }

  onVisible(_listener: () => void): () => void {
    return notImplemented('PageLifecycle.onVisible');
  }

  onPageHide(_listener: () => void): () => void {
    return notImplemented('PageLifecycle.onPageHide');
  }
}
