import type { PageLifecyclePort } from '@/core/ports/display';

/** visibilitychange / pagehide 的封装。bootstrap 把 hidden 转成 pause 命令（D-06）。 */
export class PageLifecycle implements PageLifecyclePort {
  onHidden(listener: () => void): () => void {
    return this.onVisibility('hidden', listener);
  }

  onVisible(listener: () => void): () => void {
    return this.onVisibility('visible', listener);
  }

  onPageHide(listener: () => void): () => void {
    const handler = () => listener();
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  }

  private onVisibility(state: DocumentVisibilityState, listener: () => void): () => void {
    const handler = () => {
      if (document.visibilityState === state) listener();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }
}
