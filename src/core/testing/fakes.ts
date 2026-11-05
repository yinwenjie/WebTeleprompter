import type { Clock } from '../ports/clock';
import type { FrameScheduler } from '../scroll-engine/types';

/** 手动推进的帧调度器。只供测试使用，不得被生产代码 import。 */
export class FakeFrameScheduler implements FrameScheduler {
  nowMs = 0;
  private nextId = 1;
  private pending = new Map<number, (nowMs: number) => void>();

  request(callback: (nowMs: number) => void): number {
    const id = this.nextId++;
    this.pending.set(id, callback);
    return id;
  }

  cancel(id: number): void {
    this.pending.delete(id);
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  /** 推进一帧并执行当前已排队的回调；回调中新排队的回调留到下一帧。 */
  tick(deltaMs = 1000 / 60): void {
    this.nowMs += deltaMs;
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    for (const callback of callbacks) callback(this.nowMs);
  }

  run(frames: number, deltaMs = 1000 / 60): void {
    for (let i = 0; i < frames; i += 1) this.tick(deltaMs);
  }
}

/** 手动推进的时钟。 */
export class FakeClock implements Clock {
  private current = 0;
  private nextId = 1;
  private timers = new Map<number, { at: number; callback: () => void }>();

  now(): number {
    return this.current;
  }

  setTimeout(callback: () => void, delayMs: number): number {
    const id = this.nextId++;
    this.timers.set(id, { at: this.current + delayMs, callback });
    return id;
  }

  clearTimeout(handle: number): void {
    this.timers.delete(handle);
  }

  get pendingCount(): number {
    return this.timers.size;
  }

  /** 按时间顺序触发到期定时器。回调中新建的定时器若也到期，会在同一次 advance 中触发。 */
  advance(deltaMs: number): void {
    const target = this.current + deltaMs;
    for (;;) {
      let next: [number, { at: number; callback: () => void }] | undefined;
      for (const entry of this.timers) {
        if (entry[1].at <= target && (!next || entry[1].at < next[1].at)) next = entry;
      }
      if (!next) break;
      this.timers.delete(next[0]);
      this.current = next[1].at;
      next[1].callback();
    }
    this.current = target;
  }
}
