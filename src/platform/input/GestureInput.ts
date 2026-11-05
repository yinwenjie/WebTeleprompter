import { notImplemented } from '@/core/not-implemented';
import type { CommandBus } from '@/core/playback/bus';
import type { FrameScheduler } from '@/core/scroll-engine/types';

/** platform 不能读 store（R2），需要的数据由 bootstrap 以函数注入。 */
export interface GestureInputDeps {
  bus: CommandBus;
  scheduler: FrameScheduler;
  getPositionPx(): number;
  getMirror(): { x: boolean; y: boolean };
}

/** 滚轮 / 拖拽 / 触摸 / 双击 → PlaybackCommand。规格见 docs/dev/modules/platform-input.md */
export class GestureInput {
  constructor(protected readonly deps: GestureInputDeps) {}

  /** 绑定到舞台元素，返回解绑函数。元素由 Stage 经 StageBridge 提供。 */
  attach(_stageElement: HTMLElement): () => void {
    return notImplemented('GestureInput.attach');
  }
}
