import { notImplemented } from '../not-implemented';
import type {
  FrameScheduler,
  ScrollEngine,
  ScrollMetrics,
  ScrollState,
  ScrollTarget,
} from './types';
import { INITIAL_SCROLL_STATE } from './types';

export interface ScrollEngineOptions {
  scheduler: FrameScheduler;
  /** 单帧 dt 上限，防止后台恢复时跳跃（D-06：截断在引擎内做）。默认 100。 */
  maxFrameDtMs?: number;
  /** 运行中向订阅者推送状态的最小间隔。默认 100（10Hz）。 */
  stateEmitIntervalMs?: number;
}

/** 规格见 docs/dev/modules/core-scroll-engine.md */
export class DefaultScrollEngine implements ScrollEngine {
  constructor(protected readonly options: ScrollEngineOptions) {}

  start(): void {
    notImplemented('ScrollEngine.start');
  }

  stop(): void {
    notImplemented('ScrollEngine.stop');
  }

  setSpeed(_pxPerSec: number): void {
    notImplemented('ScrollEngine.setSpeed');
  }

  seek(_positionPx: number): void {
    notImplemented('ScrollEngine.seek');
  }

  nudge(_deltaPx: number): void {
    notImplemented('ScrollEngine.nudge');
  }

  setMetrics(_metrics: ScrollMetrics): void {
    notImplemented('ScrollEngine.setMetrics');
  }

  getMetrics(): ScrollMetrics {
    return { contentHeightPx: 0, viewportHeightPx: 0, paragraphOffsetsPx: [] };
  }

  setTarget(_target: ScrollTarget | null): void {
    notImplemented('ScrollEngine.setTarget');
  }

  getState(): ScrollState {
    return INITIAL_SCROLL_STATE;
  }

  subscribe(_listener: (state: ScrollState) => void): () => void {
    return notImplemented('ScrollEngine.subscribe');
  }

  dispose(): void {
    notImplemented('ScrollEngine.dispose');
  }
}
