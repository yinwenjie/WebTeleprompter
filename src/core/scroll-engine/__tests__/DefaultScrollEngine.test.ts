import { describe, expect, it, vi } from 'vitest';
import { FakeFrameScheduler } from '../../testing/fakes';
import { DefaultScrollEngine } from '../DefaultScrollEngine';
import type { ScrollState } from '../types';

function setup(contentHeightPx = 100_000, options: { stateEmitIntervalMs?: number } = {}) {
  const scheduler = new FakeFrameScheduler();
  const engine = new DefaultScrollEngine({ scheduler, ...options });
  engine.setMetrics({ contentHeightPx, viewportHeightPx: 800, paragraphOffsetsPx: [] });
  const target = { apply: vi.fn<(y: number) => void>() };
  engine.setTarget(target);
  target.apply.mockClear();
  return { scheduler, engine, target };
}

// 规格：docs/dev/modules/core-scroll-engine.md。实现时用 FakeFrameScheduler 驱动。
describe('DefaultScrollEngine', () => {
  it('8-1：100px/s 驱动 1000 帧，位置误差 < 1px', () => {
    const { scheduler, engine } = setup();
    engine.setSpeed(100);
    engine.start();
    scheduler.run(1001);
    const expected = (100 * 1000 * (1000 / 60)) / 1000;
    expect(Math.abs(engine.getState().positionPx - expected)).toBeLessThan(1);
  });

  it('start 后第一帧只记录时间戳，不推进位置', () => {
    const { scheduler, engine, target } = setup();
    engine.setSpeed(100);
    engine.start();
    scheduler.tick(16);
    expect(engine.getState().positionPx).toBe(0);
    expect(target.apply).not.toHaveBeenCalled();
    scheduler.tick(16);
    expect(engine.getState().positionPx).toBeCloseTo(1.6);
  });

  it('8-11：单帧 dt 被截断到 maxFrameDtMs，后台 30s 恢复不跳跃', () => {
    const { scheduler, engine } = setup();
    engine.setSpeed(100);
    engine.start();
    scheduler.tick(16);
    scheduler.tick(30_000);
    expect(engine.getState().positionPx).toBeCloseTo(10);
  });

  it('stop 后取消已排队的帧，不再推进也不再写 target', () => {
    const { scheduler, engine, target } = setup();
    engine.setSpeed(100);
    engine.start();
    scheduler.run(3);
    engine.stop();
    expect(scheduler.pendingCount).toBe(0);
    target.apply.mockClear();
    const pos = engine.getState().positionPx;
    scheduler.run(10);
    expect(engine.getState().positionPx).toBe(pos);
    expect(target.apply).not.toHaveBeenCalled();
    expect(engine.getState().running).toBe(false);
  });

  it('未运行时不向调度器请求帧', () => {
    const { scheduler, engine } = setup();
    engine.setSpeed(100);
    engine.seek(50);
    engine.nudge(5);
    expect(scheduler.pendingCount).toBe(0);
  });

  it('运行中修改速度不中断滚动，下一帧即按新速度推进', () => {
    const { scheduler, engine } = setup();
    engine.setSpeed(60);
    engine.start();
    scheduler.run(2, 1000 / 60);
    const before = engine.getState().positionPx;
    engine.setSpeed(600);
    expect(engine.getState().running).toBe(true);
    scheduler.tick(1000 / 60);
    expect(engine.getState().positionPx - before).toBeCloseTo(10);
  });

  it('seek / nudge 夹到 [0, contentHeightPx]，并立即写 target', () => {
    const { engine, target } = setup(1000);
    engine.seek(-5);
    expect(target.apply).toHaveBeenLastCalledWith(0);
    engine.seek(5000);
    expect(target.apply).toHaveBeenLastCalledWith(1000);
    engine.seek(400);
    engine.nudge(50);
    expect(target.apply).toHaveBeenLastCalledWith(450);
    engine.nudge(-10_000);
    expect(engine.getState().positionPx).toBe(0);
  });

  it('运行中 seek 后下一帧从新位置继续', () => {
    const { scheduler, engine } = setup();
    engine.setSpeed(60);
    engine.start();
    scheduler.run(3);
    engine.seek(500);
    scheduler.tick(1000 / 60);
    expect(engine.getState().positionPx).toBeCloseTo(501);
  });

  it('到达 contentHeightPx 时自动停止、atEnd 为 true，并立即通知订阅者', () => {
    const { scheduler, engine } = setup(100, { stateEmitIntervalMs: 10_000 });
    const states: ScrollState[] = [];
    engine.subscribe((s) => states.push(s));
    engine.setSpeed(1000);
    engine.start();
    scheduler.run(20);
    const last = states.at(-1)!;
    expect(last.atEnd).toBe(true);
    expect(last.running).toBe(false);
    expect(last.positionPx).toBe(100);
    expect(last.progress).toBe(1);
    expect(scheduler.pendingCount).toBe(0);
    engine.start();
    expect(engine.getState().running).toBe(false);
  });

  it('D-03：内容高度变化时按比例缩放位置，progress 不变', () => {
    const { engine, target } = setup(1000);
    engine.seek(250);
    engine.setMetrics({
      contentHeightPx: 4000,
      viewportHeightPx: 800,
      paragraphOffsetsPx: [0, 100],
    });
    expect(engine.getState().positionPx).toBe(1000);
    expect(engine.getState().progress).toBe(0.25);
    expect(target.apply).toHaveBeenLastCalledWith(1000);
    expect(engine.getMetrics().paragraphOffsetsPx).toEqual([0, 100]);
  });

  it('D-03：仅视口高度变化时位置不变', () => {
    const { engine } = setup(1000);
    engine.seek(250);
    engine.setMetrics({ contentHeightPx: 1000, viewportHeightPx: 300, paragraphOffsetsPx: [] });
    expect(engine.getState().positionPx).toBe(250);
  });

  it('首次测量（旧高度为 0）时位置不变', () => {
    const scheduler = new FakeFrameScheduler();
    const engine = new DefaultScrollEngine({ scheduler });
    engine.setMetrics({ contentHeightPx: 1000, viewportHeightPx: 800, paragraphOffsetsPx: [] });
    expect(engine.getState().positionPx).toBe(0);
  });

  it('内容高度为 0 时 progress 为 0，atEnd 为 true，start 不启动循环', () => {
    const scheduler = new FakeFrameScheduler();
    const engine = new DefaultScrollEngine({ scheduler });
    const state = engine.getState();
    expect(state.progress).toBe(0);
    expect(state.atEnd).toBe(true);
    engine.setSpeed(100);
    engine.start();
    expect(engine.getState().running).toBe(false);
    expect(scheduler.pendingCount).toBe(0);
  });

  it('D-15：运行中按 stateEmitIntervalMs 节流，但 target 每帧都写', () => {
    const { scheduler, engine, target } = setup();
    const listener = vi.fn();
    engine.setSpeed(60);
    engine.subscribe(listener);
    engine.start();
    expect(listener).toHaveBeenCalledTimes(1);
    listener.mockClear();
    scheduler.run(61, 1000 / 60);
    expect(target.apply).toHaveBeenCalledTimes(60);
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(9);
    expect(listener.mock.calls.length).toBeLessThanOrEqual(11);
  });

  it('setTarget(null) 后不再写 target；重新注册时立即写当前位置', () => {
    const { engine, target } = setup(1000);
    engine.seek(10);
    engine.setTarget(null);
    target.apply.mockClear();
    engine.seek(20);
    expect(target.apply).not.toHaveBeenCalled();
    const next = { apply: vi.fn() };
    engine.setTarget(next);
    expect(next.apply).toHaveBeenCalledWith(20);
  });

  it('estimatedRemainingMs 在速度变化后重算，速度为 0 时为 null', () => {
    const { engine } = setup(1000);
    engine.seek(500);
    expect(engine.getState().estimatedRemainingMs).toBeNull();
    engine.setSpeed(50);
    expect(engine.getState().estimatedRemainingMs).toBe(10_000);
    engine.setSpeed(100);
    expect(engine.getState().estimatedRemainingMs).toBe(5000);
    engine.setSpeed(-1);
    expect(engine.getState().speedPxPerSec).toBe(0);
    engine.setSpeed(Number.NaN);
    expect(engine.getState().estimatedRemainingMs).toBeNull();
  });

  it('监听器在通知中取消订阅或调用 stop 不出错', () => {
    const { scheduler, engine } = setup();
    const second = vi.fn();
    engine.setSpeed(60);
    const unsubscribe = engine.subscribe(() => {
      unsubscribe();
      engine.stop();
    });
    engine.subscribe(second);
    engine.start();
    scheduler.run(3);
    expect(engine.getState().running).toBe(false);
    expect(second).toHaveBeenCalled();
  });

  it('dispose 后取消排队的帧并清空订阅者', () => {
    const { scheduler, engine, target } = setup();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.setSpeed(60);
    engine.start();
    listener.mockClear();
    target.apply.mockClear();
    engine.dispose();
    expect(scheduler.pendingCount).toBe(0);
    engine.seek(10);
    expect(listener).not.toHaveBeenCalled();
    expect(target.apply).not.toHaveBeenCalled();
  });
});
