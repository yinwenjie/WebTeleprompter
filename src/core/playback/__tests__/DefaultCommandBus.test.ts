import { describe, expect, it, vi } from 'vitest';
import type { AppMode, PlaybackCommand } from '../commands';
import { isPlaybackCommand } from '../commands';
import { DefaultCommandBus } from '../DefaultCommandBus';
import { createEditModeInterceptor } from '../interceptors';

const toggle: PlaybackCommand = { type: 'toggle' };

// 规格：docs/dev/modules/core-playback.md
describe('DefaultCommandBus', () => {
  it('无拦截器时转发给 handler 并返回 true', () => {
    const handler = vi.fn();
    const bus = new DefaultCommandBus(handler);
    expect(bus.dispatch(toggle, 'keyboard')).toBe(true);
    expect(handler).toHaveBeenCalledWith(toggle, 'keyboard');
  });

  it('任一拦截器返回 false 时丢弃命令并返回 false，handler 不被调用', () => {
    const handler = vi.fn();
    const bus = new DefaultCommandBus(handler);
    bus.use(() => true);
    bus.use(() => false);
    expect(bus.dispatch(toggle, 'button')).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('拦截器按注册顺序执行，遇到 false 即停止', () => {
    const order: string[] = [];
    const bus = new DefaultCommandBus(() => order.push('handler'));
    bus.use(() => (order.push('a'), true));
    bus.use(() => (order.push('b'), false));
    bus.use(() => (order.push('c'), true));
    bus.dispatch(toggle, 'keyboard');
    expect(order).toEqual(['a', 'b']);
  });

  it('拦截器收到命令和来源', () => {
    const interceptor = vi.fn(() => true);
    const bus = new DefaultCommandBus(() => {});
    bus.use(interceptor);
    bus.dispatch(toggle, 'remote');
    expect(interceptor).toHaveBeenCalledWith(toggle, 'remote');
  });

  it('use 返回的函数能移除拦截器', () => {
    const handler = vi.fn();
    const bus = new DefaultCommandBus(handler);
    const remove = bus.use(() => false);
    remove();
    expect(bus.dispatch(toggle, 'keyboard')).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('8-7 / D-18：createEditModeInterceptor 在编辑态只放行 mode.set 和 speed.set', () => {
    let mode: AppMode = 'edit';
    const interceptor = createEditModeInterceptor(() => mode);
    expect(interceptor(toggle, 'keyboard')).toBe(false);
    expect(interceptor({ type: 'speed.step', delta: 1 }, 'keyboard')).toBe(false);
    expect(interceptor({ type: 'display.toggleFullscreen' }, 'keyboard')).toBe(false);
    expect(interceptor({ type: 'mode.set', mode: 'prompt' }, 'button')).toBe(true);
    expect(interceptor({ type: 'speed.set', level: 4 }, 'button')).toBe(true);
    mode = 'prompt';
    expect(interceptor(toggle, 'keyboard')).toBe(true);
  });

  it('isPlaybackCommand 接受全部合法命令', () => {
    const valid: PlaybackCommand[] = [
      { type: 'toggle' },
      { type: 'play' },
      { type: 'pause' },
      { type: 'speed.step', delta: -0.5 },
      { type: 'speed.set', level: 4 },
      { type: 'seek.top' },
      { type: 'seek.paragraph', dir: -1 },
      { type: 'seek.px', positionPx: 10 },
      { type: 'seek.progress', progress: 0.3 },
      { type: 'nudge.px', deltaPx: 3 },
      { type: 'scrub.begin' },
      { type: 'scrub.end' },
      { type: 'mode.set', mode: 'edit' },
      { type: 'display.toggleMirror', axis: 'y' },
      { type: 'display.toggleFullscreen' },
      { type: 'display.exitFullscreen' },
      { type: 'display.toggleClean' },
      { type: 'display.toggleHelp' },
    ];
    for (const command of valid) {
      expect(isPlaybackCommand(JSON.parse(JSON.stringify(command)))).toBe(true);
    }
  });

  it('isPlaybackCommand 拒绝未知 type、缺失字段和非有限数值', () => {
    const invalid: unknown[] = [
      null,
      undefined,
      'toggle',
      [],
      {},
      { type: 'explode' },
      { type: 'speed.step' },
      { type: 'speed.step', delta: '1' },
      { type: 'speed.set', level: Number.NaN },
      { type: 'seek.px', positionPx: Number.POSITIVE_INFINITY },
      { type: 'seek.progress' },
      { type: 'nudge.px', deltaPx: null },
      { type: 'seek.paragraph', dir: 2 },
      { type: 'mode.set', mode: 'watch' },
      { type: 'display.toggleMirror', axis: 'z' },
    ];
    for (const value of invalid) expect(isPlaybackCommand(value)).toBe(false);
  });
});
