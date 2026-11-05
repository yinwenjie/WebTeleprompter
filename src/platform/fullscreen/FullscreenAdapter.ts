import type { FullscreenMode, FullscreenPort } from '@/core/ports/display';

interface WebkitElement {
  requestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface WebkitDocument {
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
}

/** 原生 Fullscreen（含 webkit 前缀）与“页面内全屏”降级的统一接口。 */
export class FullscreenAdapter implements FullscreenPort {
  private current: FullscreenMode = 'none';
  private listeners: Array<(mode: FullscreenMode) => void> = [];

  constructor(protected readonly element: HTMLElement) {
    const onChange = () => this.syncFromDocument();
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    const onError = () => {
      if (this.current === 'native' && !this.nativeElement()) this.setMode('fallback');
    };
    document.addEventListener('fullscreenerror', onError);
    document.addEventListener('webkitfullscreenerror', onError);
  }

  get mode(): FullscreenMode {
    return this.current;
  }

  /** 必须同步调用 requestFullscreen，前面不能有 await（R-5）。 */
  enter(): Promise<FullscreenMode> {
    if (this.current !== 'none') return Promise.resolve(this.current);
    const el = this.element as unknown as WebkitElement;
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (typeof request !== 'function') {
      this.setMode('fallback');
      return Promise.resolve(this.current);
    }
    let result: Promise<void> | void;
    try {
      result = request.call(el);
    } catch {
      this.setMode('fallback');
      return Promise.resolve(this.current);
    }
    if (result && typeof result.then === 'function') {
      return result.then(
        () => {
          this.setMode('native');
          return this.current;
        },
        () => {
          this.setMode('fallback');
          return this.current;
        },
      );
    }
    // 旧版 webkit 前缀 API 不返回 Promise；失败由 webkitfullscreenerror 回退。
    this.setMode('native');
    return Promise.resolve(this.current);
  }

  exit(): Promise<void> {
    if (this.current === 'none') return Promise.resolve();
    if (this.current === 'fallback') {
      this.setMode('none');
      return Promise.resolve();
    }
    const doc = document as unknown as WebkitDocument;
    const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
    const done = () => this.setMode('none');
    if (!this.nativeElement() || typeof exit !== 'function') {
      done();
      return Promise.resolve();
    }
    try {
      const result = exit.call(document);
      if (result && typeof result.then === 'function') return result.then(done, done);
    } catch {
      // 浏览器已退出全屏时可能抛错，按已退出处理。
    }
    done();
    return Promise.resolve();
  }

  onChange(listener: (mode: FullscreenMode) => void): () => void {
    this.listeners = [...this.listeners, listener];
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private nativeElement(): Element | null {
    const doc = document as unknown as WebkitDocument;
    return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  }

  private syncFromDocument(): void {
    if (this.nativeElement()) this.setMode('native');
    else if (this.current === 'native') this.setMode('none');
  }

  private setMode(mode: FullscreenMode): void {
    if (mode === this.current) return;
    this.current = mode;
    for (const listener of this.listeners) listener(mode);
  }
}
