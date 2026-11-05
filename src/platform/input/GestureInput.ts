import type { CommandBus } from '@/core/playback/bus';
import type { PlaybackCommand } from '@/core/playback/commands';
import type { FrameScheduler } from '@/core/scroll-engine/types';

/** 手感参数集中于此，便于真机调参（R-7）。 */
export const DRAG_THRESHOLD_PX = 8;
export const VELOCITY_WINDOW_MS = 100;
export const INERTIA_MIN_START_VELOCITY = 0.3; // px/ms
export const INERTIA_STOP_VELOCITY = 0.02; // px/ms
/** 每 16.67ms 保留的速度比例。 */
export const INERTIA_FRICTION_PER_FRAME = 0.95;
export const DOUBLE_TAP_MAX_INTERVAL_MS = 300;
export const DOUBLE_TAP_MAX_DISTANCE_PX = 24;
const WHEEL_LINE_PX = 16;
const FRAME_MS = 1000 / 60;

/** platform 不能读 store（R2），需要的数据由 bootstrap 以函数注入。 */
export interface GestureInputDeps {
  bus: CommandBus;
  scheduler: FrameScheduler;
  getPositionPx(): number;
  getMirror(): { x: boolean; y: boolean };
}

interface Tap {
  time: number;
  x: number;
  y: number;
}

/** 滚轮 / 拖拽 / 触摸 / 双击 → PlaybackCommand。规格见 docs/dev/modules/platform-input.md */
export class GestureInput {
  constructor(protected readonly deps: GestureInputDeps) {}

  /** 绑定到舞台元素，返回解绑函数。元素由 Stage 经 StageBridge 提供。 */
  attach(stageElement: HTMLElement): () => void {
    const { bus, scheduler } = this.deps;
    const send = (command: PlaybackCommand) => bus.dispatch(command, 'gesture');
    const ySign = () => (this.deps.getMirror().y ? -1 : 1);

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    /** 已发出 scrub.begin 且尚未发 scrub.end。 */
    let inScrub = false;
    let pos0 = 0;
    let samples: Array<{ t: number; y: number }> = [];
    let pendingSeek: number | null = null;
    let seekFrame: number | null = null;
    let velocity = 0;
    let inertiaFrame: number | null = null;
    let inertiaLast: number | null = null;
    let wheelDelta = 0;
    let wheelFrame: number | null = null;
    let lastTap: Tap | null = null;

    const flushSeek = () => {
      if (seekFrame !== null) scheduler.cancel(seekFrame);
      seekFrame = null;
      if (pendingSeek !== null) send({ type: 'seek.px', positionPx: pendingSeek });
      pendingSeek = null;
    };

    const endScrub = () => {
      if (!inScrub) return;
      inScrub = false;
      send({ type: 'scrub.end' });
    };

    const stopInertia = () => {
      if (inertiaFrame !== null) scheduler.cancel(inertiaFrame);
      inertiaFrame = null;
      inertiaLast = null;
    };

    const inertiaStep = (now: number) => {
      inertiaFrame = null;
      const dt = inertiaLast === null ? FRAME_MS : Math.max(0, now - inertiaLast);
      inertiaLast = now;
      velocity *= INERTIA_FRICTION_PER_FRAME ** (dt / FRAME_MS);
      if (Math.abs(velocity) < INERTIA_STOP_VELOCITY) {
        inertiaLast = null;
        endScrub();
        return;
      }
      send({ type: 'nudge.px', deltaPx: velocity * dt });
      inertiaFrame = scheduler.request(inertiaStep);
    };

    const releasePointer = (event: PointerEvent) => {
      pointerId = null;
      dragging = false;
      samples = [];
      if (typeof stageElement.hasPointerCapture === 'function') {
        try {
          if (stageElement.hasPointerCapture(event.pointerId)) {
            stageElement.releasePointerCapture(event.pointerId);
          }
        } catch {
          // 指针已失效时忽略。
        }
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (pointerId !== null || event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      dragging = false;
      samples = [{ t: event.timeStamp, y: event.clientY }];
      if (inertiaFrame !== null) stopInertia();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      samples.push({ t: event.timeStamp, y: event.clientY });
      while (samples.length > 2 && event.timeStamp - samples[0]!.t > VELOCITY_WINDOW_MS) {
        samples.shift();
      }
      if (!dragging) {
        if (Math.hypot(event.clientX - startX, event.clientY - startY) <= DRAG_THRESHOLD_PX) return;
        dragging = true;
        lastTap = null;
        if (typeof stageElement.setPointerCapture === 'function') {
          try {
            stageElement.setPointerCapture(event.pointerId);
          } catch {
            // jsdom 或指针已失效时忽略。
          }
        }
        if (!inScrub) {
          inScrub = true;
          send({ type: 'scrub.begin' });
        }
        pos0 = this.deps.getPositionPx();
      }
      pendingSeek = pos0 + (startY - event.clientY) * ySign();
      seekFrame ??= scheduler.request(() => {
        seekFrame = null;
        if (pendingSeek !== null) send({ type: 'seek.px', positionPx: pendingSeek });
        pendingSeek = null;
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const wasDragging = dragging;
      const recent = samples.filter((s) => event.timeStamp - s.t <= VELOCITY_WINDOW_MS);
      releasePointer(event);
      if (!wasDragging) {
        if (inScrub) {
          endScrub();
          return;
        }
        handleTap(event);
        return;
      }
      flushSeek();
      const first = recent[0];
      const last = recent[recent.length - 1];
      const span = first && last ? last.t - first.t : 0;
      const v = span > 0 ? ((first!.y - last!.y) / span) * ySign() : 0;
      if (Math.abs(v) < INERTIA_MIN_START_VELOCITY) {
        endScrub();
        return;
      }
      velocity = v;
      inertiaLast = null;
      inertiaFrame = scheduler.request(inertiaStep);
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const wasDragging = dragging;
      releasePointer(event);
      if (wasDragging) flushSeek();
      endScrub();
    };

    const handleTap = (event: PointerEvent) => {
      const tap: Tap = { time: event.timeStamp, x: event.clientX, y: event.clientY };
      if (
        lastTap &&
        tap.time - lastTap.time <= DOUBLE_TAP_MAX_INTERVAL_MS &&
        Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) <= DOUBLE_TAP_MAX_DISTANCE_PX
      ) {
        lastTap = null;
        send({ type: 'toggle' });
        return;
      }
      lastTap = tap;
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      const scale =
        event.deltaMode === 1 ? WHEEL_LINE_PX : event.deltaMode === 2 ? window.innerHeight : 1;
      wheelDelta += event.deltaY * scale;
      wheelFrame ??= scheduler.request(() => {
        wheelFrame = null;
        const delta = wheelDelta * ySign();
        wheelDelta = 0;
        if (delta !== 0) send({ type: 'nudge.px', deltaPx: delta });
      });
    };

    const onDblClick = (event: MouseEvent) => event.preventDefault();

    stageElement.addEventListener('pointerdown', onPointerDown);
    stageElement.addEventListener('pointermove', onPointerMove);
    stageElement.addEventListener('pointerup', onPointerUp);
    stageElement.addEventListener('pointercancel', onPointerCancel);
    stageElement.addEventListener('lostpointercapture', onPointerCancel);
    stageElement.addEventListener('wheel', onWheel, { passive: false });
    stageElement.addEventListener('dblclick', onDblClick);

    return () => {
      stageElement.removeEventListener('pointerdown', onPointerDown);
      stageElement.removeEventListener('pointermove', onPointerMove);
      stageElement.removeEventListener('pointerup', onPointerUp);
      stageElement.removeEventListener('pointercancel', onPointerCancel);
      stageElement.removeEventListener('lostpointercapture', onPointerCancel);
      stageElement.removeEventListener('wheel', onWheel);
      stageElement.removeEventListener('dblclick', onDblClick);
      if (seekFrame !== null) scheduler.cancel(seekFrame);
      if (wheelFrame !== null) scheduler.cancel(wheelFrame);
      seekFrame = null;
      wheelFrame = null;
      pendingSeek = null;
      stopInertia();
      pointerId = null;
      dragging = false;
      endScrub();
    };
  }
}
