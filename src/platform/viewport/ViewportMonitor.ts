import type { ViewportClass, ViewportPort } from '@/core/ports/display';

export const VIEWPORT_BREAKPOINTS = { tabletMinPx: 600, desktopMinPx: 1024 } as const;

const TABLET_QUERY = `(min-width: ${VIEWPORT_BREAKPOINTS.tabletMinPx}px)`;
const DESKTOP_QUERY = `(min-width: ${VIEWPORT_BREAKPOINTS.desktopMinPx}px)`;

/** 基于 matchMedia 判断设备档位。 */
export class ViewportMonitor implements ViewportPort {
  get current(): ViewportClass {
    if (typeof window.matchMedia !== 'function') return 'desktop';
    if (window.matchMedia(DESKTOP_QUERY).matches) return 'desktop';
    if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
    return 'phone';
  }

  onChange(listener: (viewport: ViewportClass) => void): () => void {
    if (typeof window.matchMedia !== 'function') return () => {};
    const queries = [window.matchMedia(TABLET_QUERY), window.matchMedia(DESKTOP_QUERY)];
    let last = this.current;
    const handler = () => {
      const next = this.current;
      if (next === last) return;
      last = next;
      listener(next);
    };
    for (const query of queries) addMediaListener(query, handler);
    return () => {
      for (const query of queries) removeMediaListener(query, handler);
    };
  }
}

// Safari 13 及更早只有 addListener；保留回退以免旧 WebKit 报错。
function addMediaListener(query: MediaQueryList, handler: () => void): void {
  if (typeof query.addEventListener === 'function') query.addEventListener('change', handler);
  else query.addListener(handler);
}

function removeMediaListener(query: MediaQueryList, handler: () => void): void {
  if (typeof query.removeEventListener === 'function') query.removeEventListener('change', handler);
  else query.removeListener(handler);
}
