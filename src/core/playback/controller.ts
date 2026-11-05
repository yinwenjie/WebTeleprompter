import type { Locale } from '../models/settings';
import type { ScrollMetrics, ScrollState } from '../scroll-engine/types';
import type { AppMode, CommandSource, DisplayCommand, PlaybackCommand } from './commands';

export type PlaybackPhase = 'idle' | 'countdown' | 'playing' | 'paused' | 'scrubbing' | 'ended';

export interface PlaybackControllerState {
  mode: AppMode;
  phase: PlaybackPhase;
  speedLevel: number;
  countdownRemainingMs: number;
}

/** playbackStore 对 UI 暴露的快照（派生，不持久化）。 */
export interface PlaybackState extends PlaybackControllerState {
  scroll: ScrollState;
}

export const INITIAL_CONTROLLER_STATE: PlaybackControllerState = {
  mode: 'edit',
  phase: 'idle',
  speedLevel: 3,
  countdownRemainingMs: 0,
};

/** 控制器对外产生的副作用。core 不能 import store，由 bootstrap 接到 store（D-04）。 */
export interface PlaybackEffects {
  onDisplayCommand(command: DisplayCommand): void;
  /** 持久化 speedLevel。 */
  onSpeedLevelChanged(level: number): void;
  /** 进入 paused / ended 时触发：保存播放位置。 */
  onSavePoint(point: { progress: number; positionPx: number }): void;
}

/** 每次读取最新设置，用户在倒计时中改设置也能生效。 */
export interface PlaybackBehavior {
  countdownSec: number;
  resumeDelayMs: number;
}

/** 影响语速和位置的布局输入。 */
export interface LayoutUpdate {
  metrics: ScrollMetrics;
  readingUnits: number;
  locale: Locale;
}

export interface PlaybackController {
  handle(command: PlaybackCommand, source: CommandSource): void;
  /** 转发 metrics 给引擎并重算 px/s（D-02、D-04）。不是用户意图，所以不走命令总线。 */
  updateLayout(update: LayoutUpdate): void;
  /** 切换稿件：回到 idle、位置归零、取消倒计时和恢复定时器；mode 不变。 */
  resetSession(): void;
  getState(): PlaybackControllerState;
  subscribe(listener: (state: PlaybackControllerState) => void): () => void;
  dispose(): void;
}
