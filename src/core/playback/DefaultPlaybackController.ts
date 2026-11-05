import type { Locale } from '../models/settings';
import type { Clock } from '../ports/clock';
import type { ScrollEngine, ScrollState } from '../scroll-engine/types';
import { clampSpeedLevel, toPxPerSec } from '../speed-model';
import type { CommandSource, PlaybackCommand } from './commands';
import type {
  LayoutUpdate,
  PlaybackBehavior,
  PlaybackController,
  PlaybackControllerState,
  PlaybackEffects,
} from './controller';
import { INITIAL_CONTROLLER_STATE } from './controller';

export interface PlaybackControllerDeps {
  engine: ScrollEngine;
  clock: Clock;
  effects: PlaybackEffects;
  getBehavior(): PlaybackBehavior;
  initialSpeedLevel: number;
}

const COUNTDOWN_TICK_MS = 1000;
const PARAGRAPH_EPSILON_PX = 1;

/** 完整状态转换表见 docs/dev/modules/core-playback.md */
export class DefaultPlaybackController implements PlaybackController {
  private state: PlaybackControllerState;
  private listeners: Array<(state: PlaybackControllerState) => void> = [];
  private readingUnits = 0;
  private locale: Locale = 'zh-CN';
  /** 进入 scrubbing 前是否在播放；松手后据此决定恢复还是暂停。 */
  private wasPlaying = false;
  /** scrub.begin 与 scrub.end 之间为 true；为 false 且仍在 scrubbing 说明正在等待恢复。 */
  private scrubActive = false;
  private countdownTimer: number | null = null;
  private resumeTimer: number | null = null;
  private readonly unsubscribeEngine: () => void;

  constructor(protected readonly deps: PlaybackControllerDeps) {
    this.state = {
      ...INITIAL_CONTROLLER_STATE,
      speedLevel: clampSpeedLevel(deps.initialSpeedLevel),
    };
    this.unsubscribeEngine = deps.engine.subscribe((scroll) => this.onEngineState(scroll));
  }

  handle(command: PlaybackCommand, _source: CommandSource): void {
    switch (command.type) {
      case 'play':
        this.play();
        return;
      case 'pause':
        this.pause();
        return;
      case 'toggle':
        this.toggle();
        return;
      case 'scrub.begin':
        this.scrubBegin();
        return;
      case 'scrub.end':
        this.scrubEnd();
        return;
      case 'speed.step':
        this.setSpeedLevel(this.state.speedLevel + command.delta);
        return;
      case 'speed.set':
        this.setSpeedLevel(command.level);
        return;
      case 'seek.top':
        this.seekTop();
        return;
      case 'seek.px':
        this.seek(command.positionPx);
        return;
      case 'seek.progress': {
        const progress = Number.isFinite(command.progress)
          ? Math.min(1, Math.max(0, command.progress))
          : 0;
        this.seek(progress * this.deps.engine.getMetrics().contentHeightPx);
        return;
      }
      case 'seek.paragraph':
        this.seekParagraph(command.dir);
        return;
      case 'nudge.px': {
        if (!Number.isFinite(command.deltaPx)) return;
        const wasEnded = this.state.phase === 'ended';
        this.deps.engine.nudge(command.deltaPx);
        this.afterSeek(wasEnded);
        return;
      }
      case 'mode.set':
        this.setMode(command.mode);
        return;
      case 'display.toggleMirror':
      case 'display.toggleFullscreen':
      case 'display.exitFullscreen':
      case 'display.toggleClean':
      case 'display.toggleHelp':
        this.deps.effects.onDisplayCommand(command);
        return;
      default: {
        const exhaustive: never = command;
        void exhaustive;
      }
    }
  }

  updateLayout(update: LayoutUpdate): void {
    this.readingUnits = update.readingUnits;
    this.locale = update.locale;
    this.deps.engine.setMetrics(update.metrics);
    this.applyEngineSpeed();
  }

  resetSession(): void {
    this.cancelTimers();
    this.wasPlaying = false;
    this.scrubActive = false;
    this.deps.engine.stop();
    this.deps.engine.seek(0);
    this.setState({ phase: 'idle', countdownRemainingMs: 0 });
  }

  getState(): PlaybackControllerState {
    return this.state;
  }

  subscribe(listener: (state: PlaybackControllerState) => void): () => void {
    this.listeners = [...this.listeners, listener];
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  dispose(): void {
    this.cancelTimers();
    this.unsubscribeEngine();
    this.listeners = [];
  }

  private play(): void {
    switch (this.state.phase) {
      case 'idle':
        this.begin();
        return;
      case 'paused':
        this.enterPlaying();
        return;
      case 'scrubbing':
        this.wasPlaying = true;
        return;
      case 'ended':
        if (!this.hasContent()) return;
        this.deps.engine.seek(0);
        this.begin();
        return;
      case 'countdown':
      case 'playing':
        return;
    }
  }

  private pause(): void {
    switch (this.state.phase) {
      case 'countdown':
        this.cancelTimers();
        this.setState({ phase: 'idle', countdownRemainingMs: 0 });
        return;
      case 'playing':
        this.deps.engine.stop();
        this.enterPaused();
        return;
      case 'scrubbing':
        this.setWasPlaying(false);
        return;
      case 'idle':
      case 'paused':
      case 'ended':
        return;
    }
  }

  private toggle(): void {
    switch (this.state.phase) {
      case 'idle':
      case 'paused':
      case 'ended':
        this.play();
        return;
      case 'countdown':
      case 'playing':
        this.pause();
        return;
      case 'scrubbing':
        this.setWasPlaying(!this.wasPlaying);
        return;
    }
  }

  /**
   * scrubbing 下修改 wasPlaying。若手指已松开、正在等待恢复（scrubActive = false），
   * 取消恢复就意味着拖拽已结束，此时直接落到 paused，避免卡在 scrubbing。
   */
  private setWasPlaying(value: boolean): void {
    this.wasPlaying = value;
    if (!value && !this.scrubActive) {
      this.cancelTimers();
      this.enterPaused();
    }
  }

  private scrubBegin(): void {
    const phase = this.state.phase;
    this.scrubActive = true;
    if (phase === 'scrubbing') {
      this.cancelTimers();
      return;
    }
    this.cancelTimers();
    this.wasPlaying = phase === 'playing';
    this.deps.engine.stop();
    this.setState({ phase: 'scrubbing', countdownRemainingMs: 0 });
  }

  private scrubEnd(): void {
    if (this.state.phase !== 'scrubbing' || !this.scrubActive) return;
    this.scrubActive = false;
    if (!this.wasPlaying) {
      this.enterPaused();
      return;
    }
    const delay = Math.max(0, this.deps.getBehavior().resumeDelayMs);
    this.resumeTimer = this.deps.clock.setTimeout(() => {
      this.resumeTimer = null;
      this.enterPlaying();
    }, delay);
  }

  private seek(positionPx: number): void {
    if (!Number.isFinite(positionPx)) return;
    const wasEnded = this.state.phase === 'ended';
    this.deps.engine.seek(positionPx);
    this.afterSeek(wasEnded);
  }

  private seekParagraph(dir: 1 | -1): void {
    const offsets = this.deps.engine.getMetrics().paragraphOffsetsPx;
    const p = this.deps.engine.getState().positionPx;
    let target: number | null = null;
    if (dir === 1) {
      for (const offset of offsets) {
        if (offset > p + PARAGRAPH_EPSILON_PX) {
          target = offset;
          break;
        }
      }
    } else {
      target = 0;
      for (const offset of offsets) {
        if (offset < p - PARAGRAPH_EPSILON_PX) target = offset;
        else break;
      }
    }
    if (target === null) return;
    this.seek(target);
  }

  /** 只有命令执行前就处于 ended 才转 paused；本次 seek 导致的 atEnd 由引擎通知转入 ended。 */
  private afterSeek(wasEnded: boolean): void {
    if (wasEnded && this.state.phase === 'ended') this.enterPaused();
  }

  private seekTop(): void {
    this.deps.engine.seek(0);
    const phase = this.state.phase;
    if (phase === 'paused' || phase === 'ended') {
      this.setState({ phase: 'idle' });
      this.savePoint();
    }
  }

  private setMode(mode: PlaybackControllerState['mode']): void {
    if (mode === this.state.mode) return;
    if (mode === 'prompt') {
      this.setState({ mode });
      return;
    }
    const phase = this.state.phase;
    if (phase === 'playing' || phase === 'scrubbing') {
      this.cancelTimers();
      this.scrubActive = false;
      this.wasPlaying = false;
      this.deps.engine.stop();
      this.setState({ mode, phase: 'paused' });
      this.savePoint();
    } else if (phase === 'countdown') {
      this.cancelTimers();
      this.setState({ mode, phase: 'idle', countdownRemainingMs: 0 });
    } else {
      this.setState({ mode });
    }
  }

  private setSpeedLevel(raw: number): void {
    const level = clampSpeedLevel(raw);
    if (level === this.state.speedLevel) return;
    this.setState({ speedLevel: level });
    this.applyEngineSpeed();
    this.deps.effects.onSpeedLevelChanged(level);
  }

  private applyEngineSpeed(): void {
    this.deps.engine.setSpeed(
      toPxPerSec(this.state.speedLevel, {
        contentHeightPx: this.deps.engine.getMetrics().contentHeightPx,
        readingUnits: this.readingUnits,
        locale: this.locale,
      }),
    );
  }

  private hasContent(): boolean {
    return this.deps.engine.getMetrics().contentHeightPx > 0 && this.readingUnits > 0;
  }

  /** idle / ended 的“开始”：空稿件不动，否则按设置倒计时或直接播放。 */
  private begin(): void {
    if (!this.hasContent()) return;
    const countdownSec = this.deps.getBehavior().countdownSec;
    if (!(countdownSec > 0)) {
      this.enterPlaying();
      return;
    }
    this.cancelTimers();
    this.setState({ phase: 'countdown', countdownRemainingMs: countdownSec * COUNTDOWN_TICK_MS });
    this.scheduleCountdownTick();
  }

  private scheduleCountdownTick(): void {
    this.countdownTimer = this.deps.clock.setTimeout(
      () => {
        this.countdownTimer = null;
        const remaining = this.state.countdownRemainingMs - COUNTDOWN_TICK_MS;
        if (remaining <= 0) {
          this.enterPlaying();
          return;
        }
        this.setState({ countdownRemainingMs: remaining });
        this.scheduleCountdownTick();
      },
      Math.min(COUNTDOWN_TICK_MS, this.state.countdownRemainingMs),
    );
  }

  /** 进入 playing 的唯一路径（倒计时结束、恢复、拖拽恢复），统一处理 atEnd。 */
  private enterPlaying(): void {
    this.cancelTimers();
    this.scrubActive = false;
    this.wasPlaying = false;
    if (this.deps.engine.getState().atEnd) {
      this.enterEnded();
      return;
    }
    this.applyEngineSpeed();
    this.setState({ phase: 'playing', countdownRemainingMs: 0 });
    this.deps.engine.start();
  }

  private enterPaused(): void {
    this.scrubActive = false;
    this.wasPlaying = false;
    this.setState({ phase: 'paused', countdownRemainingMs: 0 });
    this.savePoint();
  }

  private enterEnded(): void {
    this.deps.engine.stop();
    this.setState({ phase: 'ended', countdownRemainingMs: 0 });
    this.savePoint();
  }

  private onEngineState(scroll: ScrollState): void {
    if (scroll.atEnd && this.state.phase === 'playing') this.enterEnded();
  }

  private savePoint(): void {
    const { progress, positionPx } = this.deps.engine.getState();
    this.deps.effects.onSavePoint({ progress, positionPx });
  }

  private cancelTimers(): void {
    if (this.countdownTimer !== null) {
      this.deps.clock.clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.resumeTimer !== null) {
      this.deps.clock.clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
  }

  private setState(patch: Partial<PlaybackControllerState>): void {
    const next = { ...this.state, ...patch };
    const changed = (Object.keys(next) as Array<keyof PlaybackControllerState>).some(
      (key) => next[key] !== this.state[key],
    );
    if (!changed) return;
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }
}
