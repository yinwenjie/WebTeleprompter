import { describe, it } from 'vitest';

// 规格：docs/dev/modules/core-scroll-engine.md。实现时用 FakeFrameScheduler 驱动。
describe('DefaultScrollEngine', () => {
  it.todo('8-1：100px/s 驱动 1000 帧，位置误差 < 1px');
  it.todo('start 后第一帧只记录时间戳，不推进位置');
  it.todo('8-11：单帧 dt 被截断到 maxFrameDtMs，后台 30s 恢复不跳跃');
  it.todo('stop 后取消已排队的帧，不再推进也不再写 target');
  it.todo('未运行时不向调度器请求帧');
  it.todo('运行中修改速度不中断滚动，下一帧即按新速度推进');
  it.todo('seek / nudge 夹到 [0, contentHeightPx]，并立即写 target');
  it.todo('到达 contentHeightPx 时自动停止、atEnd 为 true，并立即通知订阅者');
  it.todo('D-03：内容高度变化时按比例缩放位置，progress 不变');
  it.todo('D-03：仅视口高度变化时位置不变');
  it.todo('内容高度为 0 时 progress 为 0，atEnd 为 true，start 不启动循环');
  it.todo('D-15：运行中按 stateEmitIntervalMs 节流，但 target 每帧都写');
  it.todo('setTarget(null) 后不再写 target；重新注册时立即写当前位置');
  it.todo('estimatedRemainingMs 在速度变化后重算，速度为 0 时为 null');
  it.todo('dispose 后取消排队的帧并清空订阅者');
});
