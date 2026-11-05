export interface FrameScheduler {
  request(callback: (nowMs: number) => void): number;
  cancel(id: number): void;
}

/** 由 ui/prompter/Stage.tsx 实现为 transform: translate3d(0, -y, 0)（R5 的唯一例外）。 */
export interface ScrollTarget {
  apply(positionPx: number): void;
}

/** 由 Stage 经 StageBridge 上报。段落偏移按 D-13 并入此结构。 */
export interface ScrollMetrics {
  contentHeightPx: number;
  viewportHeightPx: number;
  /** 各段顶部相对内容顶部的偏移，升序。 */
  paragraphOffsetsPx: readonly number[];
}

export interface ScrollState {
  /** 内容相对阅读线的偏移。0 = 首行对准阅读线；contentHeightPx = 文末越过阅读线（atEnd）。 */
  positionPx: number;
  speedPxPerSec: number;
  running: boolean;
  atStart: boolean;
  atEnd: boolean;
  /** 0..1，positionPx / contentHeightPx；内容为空时为 0。 */
  progress: number;
  estimatedRemainingMs: number | null;
}

export const INITIAL_SCROLL_STATE: ScrollState = {
  positionPx: 0,
  speedPxPerSec: 0,
  running: false,
  atStart: true,
  atEnd: false,
  progress: 0,
  estimatedRemainingMs: null,
};

export interface ScrollEngine {
  start(): void;
  stop(): void;
  setSpeed(pxPerSec: number): void;
  /** 绝对定位，夹到 [0, contentHeightPx]。 */
  seek(positionPx: number): void;
  /** 相对微调，夹到 [0, contentHeightPx]。 */
  nudge(deltaPx: number): void;
  /** contentHeightPx 变化时按比例缩放位置以保持 progress；只有视口高度变化时位置不变（D-03）。 */
  setMetrics(metrics: ScrollMetrics): void;
  getMetrics(): ScrollMetrics;
  /** Stage 挂载时注册，卸载时传 null。D-13 */
  setTarget(target: ScrollTarget | null): void;
  getState(): ScrollState;
  /**
   * 状态变化时通知：start / stop / seek / nudge / setSpeed / setMetrics / atEnd 立即通知，
   * 运行中按 stateEmitIntervalMs 节流。每帧的位置更新只走 ScrollTarget（D-15）。
   */
  subscribe(listener: (state: ScrollState) => void): () => void;
  dispose(): void;
}
