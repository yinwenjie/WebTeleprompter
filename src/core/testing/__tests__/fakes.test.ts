import { describe, expect, it, vi } from 'vitest';
import { FakeClock, FakeFrameScheduler } from '../fakes';

describe('FakeFrameScheduler', () => {
  it('把回调留到下一次 tick，并传入累计时间', () => {
    const scheduler = new FakeFrameScheduler();
    const callback = vi.fn();
    scheduler.request(callback);
    expect(callback).not.toHaveBeenCalled();
    scheduler.tick(16);
    expect(callback).toHaveBeenCalledWith(16);
    expect(scheduler.pendingCount).toBe(0);
  });

  it('回调内新排队的回调不在当前帧执行', () => {
    const scheduler = new FakeFrameScheduler();
    const inner = vi.fn();
    scheduler.request(() => scheduler.request(inner));
    scheduler.tick();
    expect(inner).not.toHaveBeenCalled();
    scheduler.tick();
    expect(inner).toHaveBeenCalledOnce();
  });

  it('cancel 后不再触发', () => {
    const scheduler = new FakeFrameScheduler();
    const callback = vi.fn();
    scheduler.cancel(scheduler.request(callback));
    scheduler.tick();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('FakeClock', () => {
  it('按到期顺序触发定时器，回调内看到的 now 是到期时间', () => {
    const clock = new FakeClock();
    const seen: [string, number][] = [];
    clock.setTimeout(() => seen.push(['b', clock.now()]), 200);
    clock.setTimeout(() => seen.push(['a', clock.now()]), 100);
    clock.advance(250);
    expect(seen).toEqual([
      ['a', 100],
      ['b', 200],
    ]);
    expect(clock.now()).toBe(250);
  });

  it('同一次 advance 内触发回调中新建且已到期的定时器', () => {
    const clock = new FakeClock();
    const callback = vi.fn();
    clock.setTimeout(() => clock.setTimeout(callback, 50), 100);
    clock.advance(200);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('clearTimeout 后不再触发', () => {
    const clock = new FakeClock();
    const callback = vi.fn();
    clock.clearTimeout(clock.setTimeout(callback, 10));
    clock.advance(20);
    expect(callback).not.toHaveBeenCalled();
  });
});
