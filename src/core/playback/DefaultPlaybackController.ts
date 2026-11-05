import { notImplemented } from '../not-implemented';
import type { Clock } from '../ports/clock';
import type { ScrollEngine } from '../scroll-engine/types';
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

/** 完整状态转换表见 docs/dev/modules/core-playback.md */
export class DefaultPlaybackController implements PlaybackController {
  constructor(protected readonly deps: PlaybackControllerDeps) {}

  handle(_command: PlaybackCommand, _source: CommandSource): void {
    notImplemented('PlaybackController.handle');
  }

  updateLayout(_update: LayoutUpdate): void {
    notImplemented('PlaybackController.updateLayout');
  }

  resetSession(): void {
    notImplemented('PlaybackController.resetSession');
  }

  getState(): PlaybackControllerState {
    return { ...INITIAL_CONTROLLER_STATE, speedLevel: this.deps.initialSpeedLevel };
  }

  subscribe(_listener: (state: PlaybackControllerState) => void): () => void {
    return notImplemented('PlaybackController.subscribe');
  }

  dispose(): void {
    notImplemented('PlaybackController.dispose');
  }
}
