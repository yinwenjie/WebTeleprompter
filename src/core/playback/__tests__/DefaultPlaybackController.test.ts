import { describe, it } from 'vitest';

// 规格：docs/dev/modules/core-playback.md 的状态转换表。表中每个单元格都要有用例。
describe('DefaultPlaybackController', () => {
  it.todo('idle + play：countdownSec > 0 进入 countdown，= 0 直接 playing');
  it.todo('countdown 结束进入 playing 并启动引擎；期间每秒更新 countdownRemainingMs');
  it.todo('countdown + pause / toggle 回到 idle 并取消定时器');
  it.todo('playing ⇄ paused，且恢复播放时不再倒计时');
  it.todo('playing + 引擎 atEnd → ended，并触发 onSavePoint');
  it.todo('D-10：ended + play / toggle 从头开始');
  it.todo('D-10：idle / paused / ended + scrub.begin → scrubbing，scrub.end → paused');
  it.todo('playing + scrub.begin 停止引擎，scrub.end 在 resumeDelayMs 后恢复');
  it.todo('8-8：恢复等待期间再次 scrub.begin 取消定时器');
  it.todo('scrubbing 期间 pause 让松手后不再恢复');
  it.todo('seek.* / nudge.* 在 playing 下不改 phase；ended 下变 paused；seek.top 例外回 idle');
  it.todo('speed.* 在任何阶段都生效且不改 phase，并触发 onSpeedLevelChanged');
  it.todo('speed.step 夹到 1–10 且步进 0.5');
  it.todo('8-6：updateLayout 后按新内容高度重算 px/s，全文时长不变');
  it.todo('mode.set edit：playing / scrubbing → paused，countdown → idle，并停止引擎');
  it.todo('display.* 转交 onDisplayCommand，不改 phase');
  it.todo('D-10：内容为空时 play 不启动，停留在 idle');
  it.todo('resetSession 回到 idle、位置归零、取消所有定时器，mode 不变');
  it.todo('seek.paragraph 依据 paragraphOffsetsPx 找到相邻段，边界处不越界');
  it.todo('seek.progress 按当前内容高度换算为 px');
  it.todo('seek.top 回到 idle 时触发 onSavePoint');
});
