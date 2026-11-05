import { describe, it } from 'vitest';

// 规格：docs/dev/modules/platform-display.md。用 jsdom 环境并 stub 浏览器 API。
describe('FullscreenAdapter', () => {
  it.todo('支持原生 API 时进入 native，并随 fullscreenchange 回写');
  it.todo('webkit 前缀 API 同样可用（iPad Safari）');
  it.todo('API 缺失或 requestFullscreen 被拒时进入 fallback');
  it.todo('fallback 模式下 exit 回到 none');
});

describe('WakeLockAdapter', () => {
  it.todo('API 缺失时 status 为 unsupported，acquire 不抛错');
  it.todo('请求被拒时 status 为 denied');
  it.todo('系统释放锁后，回到前台且仍处于持有意图时重新申请');
  it.todo('release 后回到前台不再申请');
});

describe('RafScheduler / BrowserClock / PageLifecycle / ViewportMonitor / ActivityMonitor', () => {
  it.todo('RafScheduler 转发到 requestAnimationFrame / cancelAnimationFrame');
  it.todo('PageLifecycle 分别触发 hidden、visible、pagehide');
  it.todo('ViewportMonitor 按断点分档并在变化时通知');
  it.todo('ActivityMonitor 节流到每 250ms 最多一次');
});
