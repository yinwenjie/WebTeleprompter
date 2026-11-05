import type { ScrollMetrics, ScrollTarget } from '@/core/scroll-engine/types';

export interface StageHandle {
  /** 手势监听绑定在这个元素上。 */
  element: HTMLElement;
  /** 引擎每帧写位置的目标。 */
  target: ScrollTarget;
}

/**
 * UI 与引擎之间唯一的通道（D-04）：架构 §6.1、§6.4 画的 UI → Engine 直连违反 R3，改走这里。
 * 实现位于 app/bootstrap，因此 UI 不会接触引擎或任何 platform 实例。
 */
export interface StageBridge {
  /** Stage 挂载时调用，返回卸载回调。 */
  attachStage(handle: StageHandle): () => void;
  /** ResizeObserver 触发后上报布局测量结果。不得在帧循环内调用。 */
  reportMetrics(metrics: ScrollMetrics): void;
}
