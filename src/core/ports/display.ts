export type FullscreenMode = 'native' | 'fallback' | 'none';

/** 目标元素由 bootstrap 构造适配器时传入，因此接口不出现 DOM 类型。 */
export interface FullscreenPort {
  readonly mode: FullscreenMode;
  /** 必须在用户手势的同步调用栈内调用。原生不可用时切到 fallback。 */
  enter(): Promise<FullscreenMode>;
  exit(): Promise<void>;
  /** 用户按系统 Esc 等外部变化也会触发。 */
  onChange(listener: (mode: FullscreenMode) => void): () => void;
}

export type WakeLockStatus = 'unsupported' | 'inactive' | 'active' | 'denied';

export interface WakeLockPort {
  readonly status: WakeLockStatus;
  /** 不支持或失败时不抛错，只反映在 status 上。 */
  acquire(): Promise<WakeLockStatus>;
  release(): Promise<void>;
  onChange(listener: (status: WakeLockStatus) => void): () => void;
}

export type ViewportClass = 'phone' | 'tablet' | 'desktop';

export interface ViewportPort {
  readonly current: ViewportClass;
  onChange(listener: (viewport: ViewportClass) => void): () => void;
}

/** 用户活动信号，用于控件自动隐藏。 */
export interface ActivityPort {
  onActivity(listener: () => void): () => void;
}

/** 页面生命周期。D-06 新增：可见性变化由此转成命令，引擎不再自行停止。 */
export interface PageLifecyclePort {
  onHidden(listener: () => void): () => void;
  onVisible(listener: () => void): () => void;
  /** pagehide：此时只有同步写入可靠。 */
  onPageHide(listener: () => void): () => void;
}
