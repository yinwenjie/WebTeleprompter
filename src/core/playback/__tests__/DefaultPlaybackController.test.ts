import { describe, expect, it, vi } from 'vitest';
import { DefaultScrollEngine } from '../../scroll-engine/DefaultScrollEngine';
import { toPxPerSec } from '../../speed-model';
import { FakeClock, FakeFrameScheduler } from '../../testing/fakes';
import type { PlaybackCommand } from '../commands';
import type { PlaybackBehavior, PlaybackEffects } from '../controller';
import { DefaultPlaybackController } from '../DefaultPlaybackController';

const CONTENT = 10_000;
const UNITS = 1_000;

function setup(
  behavior: Partial<PlaybackBehavior> = {},
  options: { content?: number; units?: number } = {},
) {
  const scheduler = new FakeFrameScheduler();
  const clock = new FakeClock();
  const engine = new DefaultScrollEngine({ scheduler });
  const effects = {
    onDisplayCommand: vi.fn<PlaybackEffects['onDisplayCommand']>(),
    onSpeedLevelChanged: vi.fn<PlaybackEffects['onSpeedLevelChanged']>(),
    onSavePoint: vi.fn<PlaybackEffects['onSavePoint']>(),
  };
  const current: PlaybackBehavior = { countdownSec: 0, resumeDelayMs: 300, ...behavior };
  const controller = new DefaultPlaybackController({
    engine,
    clock,
    effects,
    getBehavior: () => current,
    initialSpeedLevel: 3,
  });
  controller.updateLayout({
    metrics: {
      contentHeightPx: options.content ?? CONTENT,
      viewportHeightPx: 800,
      paragraphOffsetsPx: [0, 1000, 2000, 5000],
    },
    readingUnits: options.units ?? UNITS,
    locale: 'zh-CN',
  });
  controller.handle({ type: 'mode.set', mode: 'prompt' }, 'system');
  const send = (command: PlaybackCommand) => controller.handle(command, 'keyboard');
  const phase = () => controller.getState().phase;
  return { scheduler, clock, engine, effects, controller, behavior: current, send, phase };
}

function playing(behavior: Partial<PlaybackBehavior> = {}) {
  const ctx = setup(behavior);
  ctx.send({ type: 'play' });
  ctx.scheduler.run(3);
  return ctx;
}

function paused() {
  const ctx = playing();
  ctx.send({ type: 'pause' });
  ctx.effects.onSavePoint.mockClear();
  return ctx;
}

function ended() {
  const ctx = playing();
  ctx.send({ type: 'seek.px', positionPx: CONTENT });
  ctx.effects.onSavePoint.mockClear();
  return ctx;
}

function scrubbing(fromPlaying: boolean) {
  const ctx = fromPlaying ? playing() : setup();
  ctx.send({ type: 'scrub.begin' });
  return ctx;
}

// 规格：docs/dev/modules/core-playback.md 的状态转换表。表中每个单元格都要有用例。
describe('DefaultPlaybackController', () => {
  it('idle + play：countdownSec > 0 进入 countdown，= 0 直接 playing', () => {
    const a = setup({ countdownSec: 3 });
    a.send({ type: 'play' });
    expect(a.phase()).toBe('countdown');
    expect(a.controller.getState().countdownRemainingMs).toBe(3000);
    expect(a.engine.getState().running).toBe(false);

    const b = setup({ countdownSec: 0 });
    b.send({ type: 'play' });
    expect(b.phase()).toBe('playing');
    expect(b.engine.getState().running).toBe(true);
  });

  it('idle + toggle 同 play；idle 下 pause、scrub.end 为空操作', () => {
    const a = setup();
    a.send({ type: 'pause' });
    a.send({ type: 'scrub.end' });
    expect(a.phase()).toBe('idle');
    a.send({ type: 'toggle' });
    expect(a.phase()).toBe('playing');
  });

  it('countdown 结束进入 playing 并启动引擎；期间每秒更新 countdownRemainingMs', () => {
    const { clock, engine, controller, send, phase } = setup({ countdownSec: 3 });
    const seen: number[] = [];
    controller.subscribe((s) => seen.push(s.countdownRemainingMs));
    send({ type: 'play' });
    send({ type: 'play' });
    expect(phase()).toBe('countdown');
    clock.advance(1000);
    expect(controller.getState().countdownRemainingMs).toBe(2000);
    clock.advance(1000);
    expect(controller.getState().countdownRemainingMs).toBe(1000);
    clock.advance(1000);
    expect(phase()).toBe('playing');
    expect(engine.getState().running).toBe(true);
    expect(seen).toEqual([3000, 2000, 1000, 0]);
  });

  it('countdown 读取开始时的 countdownSec', () => {
    const ctx = setup({ countdownSec: 1 });
    ctx.send({ type: 'play' });
    ctx.behavior.countdownSec = 10;
    ctx.clock.advance(1000);
    expect(ctx.phase()).toBe('playing');
  });

  it('countdown + pause / toggle 回到 idle 并取消定时器', () => {
    for (const type of ['pause', 'toggle'] as const) {
      const { clock, engine, send, phase, effects } = setup({ countdownSec: 3 });
      engine.seek(500);
      send({ type: 'play' });
      send({ type });
      expect(phase()).toBe('idle');
      expect(clock.pendingCount).toBe(0);
      expect(engine.getState().positionPx).toBe(500);
      clock.advance(5000);
      expect(phase()).toBe('idle');
      expect(effects.onSavePoint).not.toHaveBeenCalled();
    }
  });

  it('countdown + scrub.begin 取消倒计时 → scrubbing，松手后 paused', () => {
    const { clock, send, phase } = setup({ countdownSec: 3 });
    send({ type: 'play' });
    send({ type: 'scrub.begin' });
    expect(phase()).toBe('scrubbing');
    expect(clock.pendingCount).toBe(0);
    send({ type: 'scrub.end' });
    expect(phase()).toBe('paused');
  });

  it('playing ⇄ paused，且恢复播放时不再倒计时', () => {
    const { send, phase, engine, effects, clock } = setup({ countdownSec: 2 });
    send({ type: 'play' });
    clock.advance(2000);
    expect(phase()).toBe('playing');
    send({ type: 'play' });
    expect(phase()).toBe('playing');
    send({ type: 'toggle' });
    expect(phase()).toBe('paused');
    expect(engine.getState().running).toBe(false);
    expect(effects.onSavePoint).toHaveBeenCalledTimes(1);
    send({ type: 'pause' });
    expect(phase()).toBe('paused');
    send({ type: 'toggle' });
    expect(phase()).toBe('playing');
    expect(engine.getState().running).toBe(true);
    send({ type: 'pause' });
    send({ type: 'play' });
    expect(phase()).toBe('playing');
  });

  it('paused + 恢复时引擎已 atEnd 直接转 ended', () => {
    const ctx = paused();
    ctx.engine.seek(CONTENT);
    ctx.send({ type: 'play' });
    expect(ctx.phase()).toBe('ended');
    expect(ctx.effects.onSavePoint).toHaveBeenCalled();
  });

  it('playing + 引擎 atEnd → ended，并触发 onSavePoint', () => {
    const { send, phase, scheduler, effects } = setup({}, { content: 100, units: 1 });
    send({ type: 'play' });
    scheduler.run(600);
    expect(phase()).toBe('ended');
    expect(effects.onSavePoint).toHaveBeenLastCalledWith({ progress: 1, positionPx: 100 });
  });

  it('D-10：ended + play / toggle 从头开始', () => {
    for (const type of ['play', 'toggle'] as const) {
      const ctx = ended();
      expect(ctx.phase()).toBe('ended');
      ctx.send({ type });
      expect(ctx.phase()).toBe('playing');
      expect(ctx.engine.getState().positionPx).toBe(0);
    }
    const ctx = ended();
    ctx.behavior.countdownSec = 3;
    ctx.send({ type: 'play' });
    expect(ctx.phase()).toBe('countdown');
    ctx.send({ type: 'pause' });
    expect(ctx.phase()).toBe('idle');
  });

  it('ended 下 pause、scrub.end 为空操作', () => {
    const ctx = ended();
    ctx.send({ type: 'pause' });
    ctx.send({ type: 'scrub.end' });
    expect(ctx.phase()).toBe('ended');
  });

  it('D-10：idle / paused / ended + scrub.begin → scrubbing，scrub.end → paused', () => {
    for (const make of [() => setup(), paused, ended]) {
      const ctx = make();
      ctx.send({ type: 'scrub.begin' });
      expect(ctx.phase()).toBe('scrubbing');
      ctx.send({ type: 'seek.px', positionPx: 300 });
      expect(ctx.phase()).toBe('scrubbing');
      ctx.send({ type: 'scrub.end' });
      expect(ctx.phase()).toBe('paused');
      expect(ctx.effects.onSavePoint).toHaveBeenCalledWith({ progress: 0.03, positionPx: 300 });
      ctx.clock.advance(1000);
      expect(ctx.phase()).toBe('paused');
    }
  });

  it('playing + scrub.begin 停止引擎，scrub.end 在 resumeDelayMs 后恢复', () => {
    const { send, phase, engine, clock } = scrubbing(true);
    expect(phase()).toBe('scrubbing');
    expect(engine.getState().running).toBe(false);
    send({ type: 'scrub.end' });
    expect(phase()).toBe('scrubbing');
    clock.advance(299);
    expect(phase()).toBe('scrubbing');
    clock.advance(1);
    expect(phase()).toBe('playing');
    expect(engine.getState().running).toBe(true);
  });

  it('拖拽恢复时已 atEnd 转 ended', () => {
    const ctx = scrubbing(true);
    ctx.send({ type: 'seek.px', positionPx: CONTENT });
    ctx.send({ type: 'scrub.end' });
    ctx.clock.advance(300);
    expect(ctx.phase()).toBe('ended');
  });

  it('8-8：恢复等待期间再次 scrub.begin 取消定时器', () => {
    const { send, phase, clock } = scrubbing(true);
    send({ type: 'scrub.end' });
    clock.advance(100);
    send({ type: 'scrub.begin' });
    expect(clock.pendingCount).toBe(0);
    clock.advance(1000);
    expect(phase()).toBe('scrubbing');
    send({ type: 'scrub.end' });
    clock.advance(300);
    expect(phase()).toBe('playing');
  });

  it('scrubbing 期间 pause 让松手后不再恢复', () => {
    const ctx = scrubbing(true);
    ctx.controller.handle({ type: 'pause' }, 'system');
    expect(ctx.phase()).toBe('scrubbing');
    ctx.send({ type: 'scrub.end' });
    expect(ctx.phase()).toBe('paused');
  });

  it('等待恢复时 pause / toggle 取消定时器并落到 paused', () => {
    for (const type of ['pause', 'toggle'] as const) {
      const ctx = scrubbing(true);
      ctx.send({ type: 'scrub.end' });
      ctx.send({ type });
      expect(ctx.phase()).toBe('paused');
      expect(ctx.clock.pendingCount).toBe(0);
    }
  });

  it('scrubbing + play 让松手后恢复；toggle 翻转 wasPlaying', () => {
    const a = scrubbing(false);
    a.send({ type: 'play' });
    a.send({ type: 'scrub.end' });
    a.clock.advance(300);
    expect(a.phase()).toBe('playing');

    const b = scrubbing(false);
    b.send({ type: 'toggle' });
    b.send({ type: 'toggle' });
    b.send({ type: 'toggle' });
    b.send({ type: 'scrub.end' });
    b.clock.advance(300);
    expect(b.phase()).toBe('playing');
  });

  it('seek.* / nudge.* 在 playing 下不改 phase；ended 下变 paused；seek.top 例外回 idle', () => {
    const commands: PlaybackCommand[] = [
      { type: 'seek.px', positionPx: 100 },
      { type: 'seek.progress', progress: 0.5 },
      { type: 'seek.paragraph', dir: -1 },
      { type: 'nudge.px', deltaPx: -40 },
    ];
    for (const command of commands) {
      const p = playing();
      p.send(command);
      expect(p.phase()).toBe('playing');
      const e = ended();
      e.send(command);
      expect(e.phase()).toBe('paused');
      expect(e.effects.onSavePoint).toHaveBeenCalled();
    }
    const p = playing();
    p.send({ type: 'seek.top' });
    expect(p.phase()).toBe('playing');
    expect(p.engine.getState().positionPx).toBe(0);
    const e = ended();
    e.send({ type: 'seek.top' });
    expect(e.phase()).toBe('idle');
    const q = paused();
    q.send({ type: 'seek.top' });
    expect(q.phase()).toBe('idle');
    const c = setup({ countdownSec: 3 });
    c.send({ type: 'play' });
    c.send({ type: 'seek.top' });
    expect(c.phase()).toBe('countdown');
  });

  it('speed.* 在任何阶段都生效且不改 phase，并触发 onSpeedLevelChanged', () => {
    for (const make of [() => setup(), playing, paused, ended, () => scrubbing(true)]) {
      const ctx = make();
      const before = ctx.phase();
      ctx.send({ type: 'speed.step', delta: 1 });
      expect(ctx.phase()).toBe(before);
      expect(ctx.controller.getState().speedLevel).toBe(4);
      expect(ctx.effects.onSpeedLevelChanged).toHaveBeenLastCalledWith(4);
      ctx.send({ type: 'speed.set', level: 6 });
      expect(ctx.controller.getState().speedLevel).toBe(6);
      expect(ctx.engine.getState().speedPxPerSec).toBeCloseTo(
        toPxPerSec(6, { contentHeightPx: CONTENT, readingUnits: UNITS, locale: 'zh-CN' }),
      );
    }
    const ctx = setup();
    ctx.send({ type: 'speed.set', level: 3 });
    expect(ctx.effects.onSpeedLevelChanged).not.toHaveBeenCalled();
  });

  it('countdown 下 speed.* 生效且不改 phase', () => {
    const ctx = setup({ countdownSec: 3 });
    ctx.send({ type: 'play' });
    ctx.send({ type: 'speed.step', delta: -0.5 });
    expect(ctx.phase()).toBe('countdown');
    expect(ctx.controller.getState().speedLevel).toBe(2.5);
  });

  it('运行中调速不中断滚动', () => {
    const ctx = playing();
    ctx.send({ type: 'speed.step', delta: 0.5 });
    expect(ctx.engine.getState().running).toBe(true);
  });

  it('speed.step 夹到 1–10 且步进 0.5', () => {
    const ctx = setup();
    ctx.send({ type: 'speed.step', delta: 100 });
    expect(ctx.controller.getState().speedLevel).toBe(10);
    ctx.send({ type: 'speed.step', delta: -100 });
    expect(ctx.controller.getState().speedLevel).toBe(1);
    ctx.send({ type: 'speed.step', delta: 0.3 });
    expect(ctx.controller.getState().speedLevel).toBe(1.5);
  });

  it('8-6：updateLayout 后按新内容高度重算 px/s，全文时长不变', () => {
    const ctx = setup();
    const before = ctx.engine.getState().estimatedRemainingMs!;
    ctx.controller.updateLayout({
      metrics: { contentHeightPx: CONTENT * 2, viewportHeightPx: 800, paragraphOffsetsPx: [] },
      readingUnits: UNITS,
      locale: 'zh-CN',
    });
    const after = ctx.engine.getState().estimatedRemainingMs!;
    expect(Math.abs(after - before) / before).toBeLessThan(0.05);
    expect(after).toBeCloseTo(before, 6);
  });

  it('mode.set edit：playing / scrubbing → paused，countdown → idle，并停止引擎', () => {
    for (const make of [playing, () => scrubbing(true)]) {
      const ctx = make();
      ctx.send({ type: 'scrub.end' });
      ctx.send({ type: 'mode.set', mode: 'edit' });
      expect(ctx.phase()).toBe('paused');
      expect(ctx.controller.getState().mode).toBe('edit');
      expect(ctx.engine.getState().running).toBe(false);
      ctx.clock.advance(1000);
      expect(ctx.phase()).toBe('paused');
    }
    const c = setup({ countdownSec: 3 });
    c.send({ type: 'play' });
    c.send({ type: 'mode.set', mode: 'edit' });
    expect(c.phase()).toBe('idle');
    c.clock.advance(5000);
    expect(c.phase()).toBe('idle');
    const p = paused();
    p.send({ type: 'mode.set', mode: 'edit' });
    expect(p.phase()).toBe('paused');
  });

  it('mode.set prompt 只改 mode；相同 mode 为空操作', () => {
    const ctx = paused();
    ctx.send({ type: 'mode.set', mode: 'edit' });
    const listener = vi.fn();
    ctx.controller.subscribe(listener);
    ctx.send({ type: 'mode.set', mode: 'edit' });
    expect(listener).not.toHaveBeenCalled();
    ctx.send({ type: 'mode.set', mode: 'prompt' });
    expect(ctx.controller.getState()).toMatchObject({ mode: 'prompt', phase: 'paused' });
  });

  it('display.* 转交 onDisplayCommand，不改 phase', () => {
    const ctx = playing();
    const commands: PlaybackCommand[] = [
      { type: 'display.toggleMirror', axis: 'x' },
      { type: 'display.toggleFullscreen' },
      { type: 'display.exitFullscreen' },
      { type: 'display.toggleClean' },
      { type: 'display.toggleHelp' },
    ];
    for (const command of commands) ctx.send(command);
    expect(ctx.effects.onDisplayCommand.mock.calls.map((c) => c[0])).toEqual(commands);
    expect(ctx.phase()).toBe('playing');
    expect(ctx.engine.getState().running).toBe(true);
  });

  it('D-10：内容为空时 play 不启动，停留在 idle', () => {
    for (const options of [{ content: 0 }, { units: 0 }]) {
      const ctx = setup({}, options);
      ctx.send({ type: 'play' });
      ctx.send({ type: 'toggle' });
      expect(ctx.phase()).toBe('idle');
    }
  });

  it('resetSession 回到 idle、位置归零、取消所有定时器，mode 不变', () => {
    const a = scrubbing(true);
    a.send({ type: 'seek.px', positionPx: 500 });
    a.send({ type: 'scrub.end' });
    a.controller.resetSession();
    expect(a.controller.getState()).toMatchObject({ phase: 'idle', mode: 'prompt' });
    expect(a.engine.getState().positionPx).toBe(0);
    expect(a.clock.pendingCount).toBe(0);
    a.clock.advance(1000);
    expect(a.phase()).toBe('idle');

    const b = setup({ countdownSec: 3 });
    b.send({ type: 'play' });
    b.controller.resetSession();
    expect(b.clock.pendingCount).toBe(0);
    expect(b.controller.getState().countdownRemainingMs).toBe(0);
  });

  it('seek.paragraph 依据 paragraphOffsetsPx 找到相邻段，边界处不越界', () => {
    const ctx = setup();
    const pos = () => ctx.engine.getState().positionPx;
    ctx.send({ type: 'seek.paragraph', dir: 1 });
    expect(pos()).toBe(1000);
    ctx.send({ type: 'seek.paragraph', dir: 1 });
    expect(pos()).toBe(2000);
    ctx.engine.seek(2000.5);
    ctx.send({ type: 'seek.paragraph', dir: 1 });
    expect(pos()).toBe(5000);
    ctx.send({ type: 'seek.paragraph', dir: 1 });
    expect(pos()).toBe(5000);
    ctx.engine.seek(3000);
    ctx.send({ type: 'seek.paragraph', dir: -1 });
    expect(pos()).toBe(2000);
    ctx.engine.seek(500);
    ctx.send({ type: 'seek.paragraph', dir: -1 });
    expect(pos()).toBe(0);
    ctx.send({ type: 'seek.paragraph', dir: -1 });
    expect(pos()).toBe(0);
  });

  it('seek.progress 按当前内容高度换算为 px', () => {
    const ctx = setup();
    ctx.send({ type: 'seek.progress', progress: 0.25 });
    expect(ctx.engine.getState().positionPx).toBe(2500);
    ctx.send({ type: 'seek.progress', progress: 7 });
    expect(ctx.engine.getState().positionPx).toBe(CONTENT);
    ctx.send({ type: 'seek.progress', progress: -1 });
    expect(ctx.engine.getState().positionPx).toBe(0);
  });

  it('seek.top 回到 idle 时触发 onSavePoint', () => {
    const ctx = paused();
    ctx.send({ type: 'seek.top' });
    expect(ctx.effects.onSavePoint).toHaveBeenCalledWith({ progress: 0, positionPx: 0 });
  });

  it('dispose 取消定时器和订阅', () => {
    const ctx = setup({ countdownSec: 3 });
    const listener = vi.fn();
    ctx.controller.subscribe(listener);
    ctx.send({ type: 'play' });
    listener.mockClear();
    ctx.controller.dispose();
    expect(ctx.clock.pendingCount).toBe(0);
    ctx.engine.seek(CONTENT);
    expect(listener).not.toHaveBeenCalled();
  });
});
