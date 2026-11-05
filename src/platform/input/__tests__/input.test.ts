// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommandBus } from '@/core/playback/bus';
import type { PlaybackCommand } from '@/core/playback/commands';
import { FakeFrameScheduler } from '@/core/testing/fakes';
import { GestureInput } from '../GestureInput';
import { KeyboardInput } from '../KeyboardInput';

class FakeBus implements CommandBus {
  accept = true;
  commands: PlaybackCommand[] = [];
  dispatch(command: PlaybackCommand): boolean {
    this.commands.push(command);
    return this.accept;
  }
  use(): () => void {
    return () => {};
  }
  types() {
    return this.commands.map((c) => c.type);
  }
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

// 规格：docs/dev/modules/platform-input.md。用 jsdom 环境和假 CommandBus。
describe('KeyboardInput', () => {
  let bus: FakeBus;
  let detach: () => void;

  beforeEach(() => {
    bus = new FakeBus();
    detach = new KeyboardInput({ bus }).attach();
  });

  afterEach(() => {
    detach();
    document.body.innerHTML = '';
  });

  it('8-7：焦点在 textarea / input / select / contenteditable 时不发命令、不 preventDefault', () => {
    for (const html of [
      '<textarea></textarea>',
      '<input>',
      '<select></select>',
      '<div contenteditable="true"></div>',
    ]) {
      document.body.innerHTML = html;
      const element = document.body.firstElementChild as HTMLElement;
      if (element.tagName === 'DIV')
        Object.defineProperty(element, 'isContentEditable', { value: true });
      element.focus();
      const event = press(' ', {}, element);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(bus.commands).toEqual([]);
  });

  it('8-7：提词态空格发 toggle 并 preventDefault', () => {
    const event = press(' ');
    expect(bus.commands).toEqual([{ type: 'toggle' }]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('D-07：bus 返回 false 时不 preventDefault', () => {
    bus.accept = false;
    const event = press(' ');
    expect(bus.commands).toHaveLength(1);
    expect(event.defaultPrevented).toBe(false);
  });

  it('已被处理（defaultPrevented）的事件不处理', () => {
    const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(bus.commands).toEqual([]);
  });

  it('焦点在按钮上时不拦截空格，避免与按钮点击重复触发', () => {
    document.body.innerHTML =
      '<button>b</button><a href="#">a</a><div role="button" tabindex="0"></div>';
    for (const element of Array.from(document.body.children) as HTMLElement[]) {
      element.focus();
      expect(press(' ', {}, element).defaultPrevented).toBe(false);
      expect(press('Enter', {}, element).defaultPrevented).toBe(false);
    }
    expect(bus.commands).toEqual([]);
    const button = document.querySelector('button')!;
    press('ArrowUp', {}, button);
    expect(bus.types()).toEqual(['speed.step']);
  });

  it('带 Ctrl / Cmd / Alt 的组合键不处理', () => {
    press('f', { ctrlKey: true });
    press('r', { metaKey: true });
    press(' ', { altKey: true });
    expect(bus.commands).toEqual([]);
  });

  it('方向键长按（event.repeat）可连续调速，其他键忽略 repeat', () => {
    press('ArrowUp', { repeat: true });
    press('ArrowDown', { repeat: true });
    press(' ', { repeat: true });
    press('f', { repeat: true });
    expect(bus.commands).toEqual([
      { type: 'speed.step', delta: 0.5 },
      { type: 'speed.step', delta: -0.5 },
    ]);
  });

  it('字母键不区分大小写，? 按 key 匹配，未映射的键不处理', () => {
    press('F');
    press('m');
    press('?', { shiftKey: true });
    const unmapped = press('x');
    expect(bus.commands).toEqual([
      { type: 'display.toggleFullscreen' },
      { type: 'display.toggleMirror', axis: 'x' },
      { type: 'display.toggleHelp' },
    ]);
    expect(unmapped.defaultPrevented).toBe(false);
  });

  it('自定义键位表替换默认表', () => {
    detach();
    detach = new KeyboardInput({ bus, keymap: { b: { type: 'play' } } }).attach();
    press(' ');
    press('B');
    expect(bus.commands).toEqual([{ type: 'play' }]);
  });
});

describe('GestureInput', () => {
  let bus: FakeBus;
  let scheduler: FakeFrameScheduler;
  let stage: HTMLElement;
  let mirrorY: boolean;
  let position: number;
  let detach: () => void;
  let time: number;

  const pointer = (type: string, y: number, init: PointerEventInit = {}) => {
    const event = new PointerEvent(type, {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: y,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    Object.defineProperty(event, 'timeStamp', { value: time });
    stage.dispatchEvent(event);
    return event;
  };

  const drag = (from: number, to: number, steps: number, stepMs = 16) => {
    pointer('pointerdown', from);
    for (let i = 1; i <= steps; i += 1) {
      time += stepMs;
      pointer('pointermove', from + ((to - from) * i) / steps);
    }
  };

  beforeEach(() => {
    bus = new FakeBus();
    scheduler = new FakeFrameScheduler();
    stage = document.createElement('div');
    document.body.appendChild(stage);
    mirrorY = false;
    position = 1000;
    time = 1000;
    detach = new GestureInput({
      bus,
      scheduler,
      getPositionPx: () => position,
      getMirror: () => ({ x: false, y: mirrorY }),
    }).attach(stage);
  });

  afterEach(() => {
    detach();
    stage.remove();
  });

  it('移动未超过阈值时不发 scrub.begin，单击不影响播放', () => {
    pointer('pointerdown', 300);
    time += 10;
    pointer('pointermove', 306);
    time += 10;
    pointer('pointerup', 306);
    scheduler.run(3);
    expect(bus.commands).toEqual([]);
  });

  it('D-17：双击发 toggle，不产生 scrub', () => {
    pointer('pointerdown', 300);
    pointer('pointerup', 300);
    time += 200;
    pointer('pointerdown', 305);
    pointer('pointerup', 305);
    expect(bus.commands).toEqual([{ type: 'toggle' }]);
    time += 500;
    pointer('pointerdown', 300);
    pointer('pointerup', 300);
    time += 400;
    pointer('pointerdown', 300);
    pointer('pointerup', 300);
    expect(bus.commands).toHaveLength(1);
  });

  it('两次点击距离过远不算双击', () => {
    pointer('pointerdown', 300);
    pointer('pointerup', 300);
    time += 100;
    pointer('pointerdown', 400);
    pointer('pointerup', 400);
    expect(bus.commands).toEqual([]);
  });

  it('拖拽：scrub.begin → seek.px（每帧最多一次）→ scrub.end', () => {
    drag(500, 400, 5, 40);
    expect(bus.types()).toEqual(['scrub.begin']);
    scheduler.tick();
    expect(bus.commands[1]).toEqual({ type: 'seek.px', positionPx: 1100 });
    time += 200;
    pointer('pointerup', 400);
    expect(bus.types()).toEqual(['scrub.begin', 'seek.px', 'scrub.end']);
  });

  it('同一帧内多次移动只发一次 seek.px，且位置单调', () => {
    drag(500, 300, 10, 4);
    scheduler.tick();
    pointer('pointermove', 250);
    pointer('pointermove', 200);
    scheduler.tick();
    const seeks = bus.commands.filter((c) => c.type === 'seek.px');
    expect(seeks).toEqual([
      { type: 'seek.px', positionPx: 1200 },
      { type: 'seek.px', positionPx: 1300 },
    ]);
  });

  it('mirrorY 下拖拽方向反向', () => {
    mirrorY = true;
    drag(500, 400, 5, 40);
    scheduler.tick();
    expect(bus.commands[1]).toEqual({ type: 'seek.px', positionPx: 900 });
  });

  it('滚轮发 nudge.px，mirrorY 下方向反向', () => {
    const wheel = (deltaY: number, deltaMode = 0, ctrlKey = false) => {
      const event = new WheelEvent('wheel', { deltaY, deltaMode, ctrlKey, cancelable: true });
      stage.dispatchEvent(event);
      return event;
    };
    const first = wheel(30);
    wheel(20);
    expect(first.defaultPrevented).toBe(true);
    scheduler.tick();
    wheel(2, 1);
    scheduler.tick();
    mirrorY = true;
    wheel(10);
    scheduler.tick();
    const pinch = wheel(10, 0, true);
    scheduler.tick();
    expect(pinch.defaultPrevented).toBe(false);
    expect(bus.commands).toEqual([
      { type: 'nudge.px', deltaPx: 50 },
      { type: 'nudge.px', deltaPx: 32 },
      { type: 'nudge.px', deltaPx: -10 },
    ]);
  });

  it('pointercancel 等同松手，必定发 scrub.end', () => {
    drag(500, 400, 5, 10);
    pointer('pointercancel', 400);
    expect(bus.types()).toEqual(['scrub.begin', 'seek.px', 'scrub.end']);
    scheduler.run(5);
    expect(bus.types()).toHaveLength(3);
  });

  it('松手速度超阈值时先走惯性再发 scrub.end', () => {
    drag(600, 400, 4, 10);
    pointer('pointerup', 400);
    const afterUp = bus.types();
    expect(afterUp).toEqual(['scrub.begin', 'seek.px']);
    scheduler.run(5);
    const nudges = bus.commands.filter((c) => c.type === 'nudge.px');
    expect(nudges.length).toBeGreaterThan(0);
    expect(nudges.every((c) => c.type === 'nudge.px' && c.deltaPx > 0)).toBe(true);
    expect(bus.types()).not.toContain('scrub.end');
    scheduler.run(400);
    expect(bus.types().at(-1)).toBe('scrub.end');
    expect(bus.types().filter((t) => t === 'scrub.end')).toHaveLength(1);
  });

  it('惯性中按下：停止惯性、不发 scrub.end；没有拖动就松开时发 scrub.end', () => {
    drag(600, 400, 4, 10);
    pointer('pointerup', 400);
    scheduler.run(3);
    time += 10;
    pointer('pointerdown', 400);
    const count = bus.commands.length;
    scheduler.run(10);
    expect(bus.commands).toHaveLength(count);
    pointer('pointerup', 400);
    expect(bus.types().at(-1)).toBe('scrub.end');
    expect(bus.types().filter((t) => t === 'scrub.begin')).toHaveLength(1);
  });

  it('惯性中按下后继续拖动：接续拖拽，不再发 scrub.begin', () => {
    drag(600, 400, 4, 10);
    pointer('pointerup', 400);
    scheduler.run(2);
    position = 2000;
    time += 10;
    drag(400, 350, 2, 50);
    scheduler.tick();
    expect(bus.commands.at(-1)).toEqual({ type: 'seek.px', positionPx: 2050 });
    expect(bus.types().filter((t) => t === 'scrub.begin')).toHaveLength(1);
  });

  it('只跟踪主指针，忽略其他按键和第二个指针', () => {
    pointer('pointerdown', 300, { button: 2 });
    pointer('pointermove', 100, { button: 2 });
    pointer('pointerdown', 300);
    pointer('pointerdown', 300, { pointerId: 2 });
    pointer('pointermove', 100, { pointerId: 2 });
    scheduler.tick();
    expect(bus.commands).toEqual([]);
  });

  it('解绑后不再发命令，并取消排队的帧', () => {
    drag(500, 400, 5, 10);
    expect(scheduler.pendingCount).toBe(1);
    detach();
    expect(bus.types()).toEqual(['scrub.begin', 'scrub.end']);
    expect(scheduler.pendingCount).toBe(0);
    pointer('pointermove', 300);
    pointer('pointerup', 300);
    scheduler.run(3);
    expect(bus.types()).toEqual(['scrub.begin', 'scrub.end']);
    detach = () => {};
  });
});
