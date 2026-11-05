// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FullscreenAdapter } from '../fullscreen/FullscreenAdapter';
import { generateId } from '../ids';
import { ActivityMonitor } from '../input/ActivityMonitor';
import { PageLifecycle } from '../lifecycle/PageLifecycle';
import { BrowserClock } from '../raf/BrowserClock';
import { RafScheduler } from '../raf/RafScheduler';
import { ViewportMonitor } from '../viewport/ViewportMonitor';
import { WakeLockAdapter } from '../wake-lock/WakeLockAdapter';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

function setFullscreenElement(element: Element | null) {
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => element });
}

afterEach(() => {
  delete (document as unknown as Record<string, unknown>).fullscreenElement;
  delete (document as unknown as Record<string, unknown>).exitFullscreen;
  delete (navigator as unknown as Record<string, unknown>).wakeLock;
  vi.unstubAllGlobals();
});

describe('FullscreenAdapter', () => {
  it('支持原生 API 时进入 native，并随 fullscreenchange 回写', async () => {
    const element = document.createElement('div');
    const request = vi.fn(() => {
      setFullscreenElement(element);
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    });
    Object.assign(element, { requestFullscreen: request });
    Object.assign(document, {
      exitFullscreen: vi.fn(() => {
        setFullscreenElement(null);
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      }),
    });
    const adapter = new FullscreenAdapter(element);
    const changes: string[] = [];
    adapter.onChange((mode) => changes.push(mode));
    const pending = adapter.enter();
    expect(request).toHaveBeenCalledTimes(1);
    expect(await pending).toBe('native');
    expect(adapter.mode).toBe('native');

    // 用户按系统 Esc 退出
    setFullscreenElement(null);
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(adapter.mode).toBe('none');
    expect(changes).toEqual(['native', 'none']);

    await adapter.enter();
    await adapter.exit();
    expect(adapter.mode).toBe('none');
  });

  it('webkit 前缀 API 同样可用（iPad Safari）', async () => {
    const element = document.createElement('div');
    const request = vi.fn();
    Object.assign(element, { requestFullscreen: undefined, webkitRequestFullscreen: request });
    const adapter = new FullscreenAdapter(element);
    expect(await adapter.enter()).toBe('native');
    expect(request).toHaveBeenCalledOnce();
    document.dispatchEvent(new Event('webkitfullscreenchange'));
    expect(adapter.mode).toBe('none');
  });

  it('API 缺失或 requestFullscreen 被拒时进入 fallback', async () => {
    const bare = document.createElement('div');
    Object.assign(bare, { requestFullscreen: undefined });
    expect(await new FullscreenAdapter(bare).enter()).toBe('fallback');

    const rejecting = document.createElement('div');
    Object.assign(rejecting, { requestFullscreen: () => Promise.reject(new Error('denied')) });
    const adapter = new FullscreenAdapter(rejecting);
    expect(await adapter.enter()).toBe('fallback');
    expect(adapter.mode).toBe('fallback');
  });

  it('fallback 模式下 exit 回到 none', async () => {
    const element = document.createElement('div');
    Object.assign(element, { requestFullscreen: undefined });
    const adapter = new FullscreenAdapter(element);
    const listener = vi.fn();
    adapter.onChange(listener);
    await adapter.enter();
    await adapter.exit();
    expect(adapter.mode).toBe('none');
    expect(listener.mock.calls).toEqual([['fallback'], ['none']]);
    await adapter.exit();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('WakeLockAdapter', () => {
  function stubWakeLock(request: () => Promise<unknown>) {
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  }

  function makeSentinel() {
    const target = new EventTarget();
    return Object.assign(target, {
      released: false,
      release: vi.fn(async () => {
        target.dispatchEvent(new Event('release'));
      }),
    });
  }

  const created: WakeLockAdapter[] = [];
  const make = () => {
    const adapter = new WakeLockAdapter();
    created.push(adapter);
    return adapter;
  };

  beforeEach(() => setVisibility('visible'));
  afterEach(async () => {
    await Promise.all(created.splice(0).map((adapter) => adapter.release()));
  });

  it('API 缺失时 status 为 unsupported，acquire 不抛错', async () => {
    const adapter = make();
    expect(adapter.status).toBe('unsupported');
    await expect(adapter.acquire()).resolves.toBe('unsupported');
    await expect(adapter.release()).resolves.toBeUndefined();
  });

  it('请求成功时 active，release 后 inactive', async () => {
    const sentinel = makeSentinel();
    stubWakeLock(async () => sentinel);
    const adapter = make();
    expect(adapter.status).toBe('inactive');
    await expect(adapter.acquire()).resolves.toBe('active');
    await adapter.release();
    expect(adapter.status).toBe('inactive');
    expect(sentinel.release).toHaveBeenCalled();
  });

  it('请求被拒时 status 为 denied', async () => {
    stubWakeLock(() => Promise.reject(new DOMException('no', 'NotAllowedError')));
    const adapter = make();
    await expect(adapter.acquire()).resolves.toBe('denied');
    expect(adapter.status).toBe('denied');
  });

  it('系统释放锁后，回到前台且仍处于持有意图时重新申请', async () => {
    const sentinels = [makeSentinel(), makeSentinel()];
    const request = vi.fn(async () => sentinels[request.mock.calls.length - 1]);
    stubWakeLock(request);
    const adapter = make();
    const statuses: string[] = [];
    adapter.onChange((s) => statuses.push(s));
    await adapter.acquire();
    setVisibility('hidden');
    sentinels[0]!.dispatchEvent(new Event('release'));
    expect(adapter.status).toBe('inactive');
    setVisibility('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
    expect(adapter.status).toBe('active');
    expect(statuses).toEqual(['active', 'inactive', 'active']);
  });

  it('release 后回到前台不再申请', async () => {
    const request = vi.fn(async () => makeSentinel());
    stubWakeLock(request);
    const adapter = make();
    await adapter.acquire();
    await adapter.release();
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('RafScheduler / BrowserClock / PageLifecycle / ViewportMonitor / ActivityMonitor', () => {
  it('RafScheduler 转发到 requestAnimationFrame / cancelAnimationFrame', () => {
    const raf = vi.fn(() => 7);
    const caf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', caf);
    const scheduler = new RafScheduler();
    const callback = () => {};
    expect(scheduler.request(callback)).toBe(7);
    expect(raf).toHaveBeenCalledWith(callback);
    scheduler.cancel(7);
    expect(caf).toHaveBeenCalledWith(7);
  });

  it('BrowserClock 转发 setTimeout / clearTimeout，now 单调', () => {
    vi.useFakeTimers();
    try {
      const clock = new BrowserClock();
      const callback = vi.fn();
      const cancelled = vi.fn();
      clock.setTimeout(callback, 100);
      clock.clearTimeout(clock.setTimeout(cancelled, 50));
      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledOnce();
      expect(cancelled).not.toHaveBeenCalled();
      expect(typeof clock.now()).toBe('number');
    } finally {
      vi.useRealTimers();
    }
  });

  it('PageLifecycle 分别触发 hidden、visible、pagehide', () => {
    const lifecycle = new PageLifecycle();
    const hidden = vi.fn();
    const visible = vi.fn();
    const pagehide = vi.fn();
    const offs = [
      lifecycle.onHidden(hidden),
      lifecycle.onVisible(visible),
      lifecycle.onPageHide(pagehide),
    ];
    setVisibility('hidden');
    expect(hidden).toHaveBeenCalledOnce();
    expect(visible).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(visible).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('pagehide'));
    expect(pagehide).toHaveBeenCalledOnce();
    offs.forEach((off) => off());
    setVisibility('hidden');
    window.dispatchEvent(new Event('pagehide'));
    expect(hidden).toHaveBeenCalledOnce();
    expect(pagehide).toHaveBeenCalledOnce();
  });

  it('ViewportMonitor 按断点分档并在变化时通知', () => {
    let width = 400;
    const lists: Array<{ query: string; listeners: Set<() => void> }> = [];
    vi.stubGlobal('matchMedia', (query: string) => {
      const min = Number(/min-width: (\d+)px/.exec(query)![1]);
      const entry = { query, listeners: new Set<() => void>() };
      lists.push(entry);
      return {
        get matches() {
          return width >= min;
        },
        addEventListener: (_: string, l: () => void) => entry.listeners.add(l),
        removeEventListener: (_: string, l: () => void) => entry.listeners.delete(l),
      };
    });
    const monitor = new ViewportMonitor();
    expect(monitor.current).toBe('phone');
    const listener = vi.fn();
    const off = monitor.onChange(listener);
    const fire = () => lists.forEach((l) => l.listeners.forEach((fn) => fn()));
    width = 800;
    fire();
    expect(listener).toHaveBeenLastCalledWith('tablet');
    width = 1500;
    fire();
    expect(listener).toHaveBeenLastCalledWith('desktop');
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    expect(lists.every((l) => l.listeners.size === 0)).toBe(true);
  });

  it('ActivityMonitor 节流到每 250ms 最多一次', () => {
    let now = 0;
    const monitor = new ActivityMonitor(() => now);
    const listener = vi.fn();
    const off = monitor.onActivity(listener);
    window.dispatchEvent(new Event('pointermove'));
    now = 100;
    window.dispatchEvent(new Event('keydown'));
    expect(listener).toHaveBeenCalledTimes(1);
    now = 260;
    window.dispatchEvent(new Event('pointerdown'));
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    now = 1000;
    window.dispatchEvent(new Event('pointermove'));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('generateId 生成 UUID v4，crypto.randomUUID 缺失时回退', () => {
    const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(generateId()).toMatch(pattern);
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: (b: Uint8Array<ArrayBuffer>) => real.getRandomValues(b),
    });
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(pattern);
  });
});
