import { estimateRemainingMs } from '../speed-model';
import type {
  FrameScheduler,
  ScrollEngine,
  ScrollMetrics,
  ScrollState,
  ScrollTarget,
} from './types';

export interface ScrollEngineOptions {
  scheduler: FrameScheduler;
  /** 单帧 dt 上限，防止后台恢复时跳跃（D-06：截断在引擎内做）。默认 100。 */
  maxFrameDtMs?: number;
  /** 运行中向订阅者推送状态的最小间隔。默认 100（10Hz）。 */
  stateEmitIntervalMs?: number;
}

const DEFAULT_MAX_FRAME_DT_MS = 100;
const DEFAULT_STATE_EMIT_INTERVAL_MS = 100;

/** 规格见 docs/dev/modules/core-scroll-engine.md */
export class DefaultScrollEngine implements ScrollEngine {
  private readonly scheduler: FrameScheduler;
  private readonly maxFrameDtMs: number;
  private readonly stateEmitIntervalMs: number;

  private position = 0;
  private speed = 0;
  private running = false;
  private metrics: ScrollMetrics = {
    contentHeightPx: 0,
    viewportHeightPx: 0,
    paragraphOffsetsPx: [],
  };
  private target: ScrollTarget | null = null;
  private frameId: number | null = null;
  private lastFrameMs: number | null = null;
  private lastEmitMs = 0;
  private listeners: Array<(state: ScrollState) => void> = [];

  constructor(protected readonly options: ScrollEngineOptions) {
    this.scheduler = options.scheduler;
    this.maxFrameDtMs = options.maxFrameDtMs ?? DEFAULT_MAX_FRAME_DT_MS;
    this.stateEmitIntervalMs = options.stateEmitIntervalMs ?? DEFAULT_STATE_EMIT_INTERVAL_MS;
  }

  private readonly frame = (nowMs: number): void => {
    this.frameId = null;
    if (!this.running) return;
    if (this.lastFrameMs === null) {
      this.lastFrameMs = nowMs;
      this.lastEmitMs = nowMs;
      this.frameId = this.scheduler.request(this.frame);
      return;
    }
    const dt = Math.min(Math.max(nowMs - this.lastFrameMs, 0), this.maxFrameDtMs);
    this.lastFrameMs = nowMs;
    const end = this.metrics.contentHeightPx;
    this.position = Math.min(this.position + (this.speed * dt) / 1000, end);
    this.target?.apply(this.position);
    if (this.position >= end) {
      this.running = false;
      this.emit();
      return;
    }
    if (nowMs - this.lastEmitMs >= this.stateEmitIntervalMs) {
      this.lastEmitMs = nowMs;
      this.emit();
    }
    this.frameId = this.scheduler.request(this.frame);
  };

  start(): void {
    if (this.running || this.isAtEnd()) return;
    this.running = true;
    this.lastFrameMs = null;
    this.frameId = this.scheduler.request(this.frame);
    this.emit();
  }

  stop(): void {
    if (!this.running) return;
    this.cancelFrame();
    this.running = false;
    this.emit();
  }

  setSpeed(pxPerSec: number): void {
    this.speed = Number.isFinite(pxPerSec) && pxPerSec > 0 ? pxPerSec : 0;
    this.emit();
  }

  seek(positionPx: number): void {
    if (!Number.isFinite(positionPx)) return;
    this.position = this.clamp(positionPx);
    this.target?.apply(this.position);
    this.emit();
  }

  nudge(deltaPx: number): void {
    if (!Number.isFinite(deltaPx)) return;
    this.seek(this.position + deltaPx);
  }

  setMetrics(metrics: ScrollMetrics): void {
    const oldHeight = this.metrics.contentHeightPx;
    const newHeight = Math.max(
      0,
      Number.isFinite(metrics.contentHeightPx) ? metrics.contentHeightPx : 0,
    );
    if (oldHeight > 0 && newHeight !== oldHeight) {
      this.position = (this.position * newHeight) / oldHeight;
    }
    this.metrics = {
      contentHeightPx: newHeight,
      viewportHeightPx: Math.max(0, metrics.viewportHeightPx || 0),
      paragraphOffsetsPx: [...metrics.paragraphOffsetsPx],
    };
    this.position = this.clamp(this.position);
    this.target?.apply(this.position);
    if (this.running && this.isAtEnd()) {
      this.cancelFrame();
      this.running = false;
    }
    this.emit();
  }

  getMetrics(): ScrollMetrics {
    return this.metrics;
  }

  setTarget(target: ScrollTarget | null): void {
    this.target = target;
    target?.apply(this.position);
  }

  getState(): ScrollState {
    const contentHeight = this.metrics.contentHeightPx;
    return {
      positionPx: this.position,
      speedPxPerSec: this.speed,
      running: this.running,
      atStart: this.position <= 0,
      atEnd: this.isAtEnd(),
      progress: contentHeight > 0 ? this.position / contentHeight : 0,
      estimatedRemainingMs: estimateRemainingMs(contentHeight, this.position, this.speed),
    };
  }

  subscribe(listener: (state: ScrollState) => void): () => void {
    this.listeners = [...this.listeners, listener];
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  dispose(): void {
    this.cancelFrame();
    this.running = false;
    this.listeners = [];
    this.target = null;
  }

  private isAtEnd(): boolean {
    const contentHeight = this.metrics.contentHeightPx;
    return contentHeight === 0 || this.position >= contentHeight;
  }

  private clamp(positionPx: number): number {
    return Math.min(Math.max(positionPx, 0), this.metrics.contentHeightPx);
  }

  private cancelFrame(): void {
    if (this.frameId !== null) {
      this.scheduler.cancel(this.frameId);
      this.frameId = null;
    }
  }

  private emit(): void {
    const listeners = this.listeners;
    if (listeners.length === 0) return;
    const state = this.getState();
    for (const listener of listeners) listener(state);
  }
}
