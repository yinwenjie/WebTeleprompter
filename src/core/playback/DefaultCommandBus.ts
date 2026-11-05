import { notImplemented } from '../not-implemented';
import type { CommandBus, CommandHandler, CommandInterceptor } from './bus';
import type { CommandSource, PlaybackCommand } from './commands';

/** 规格见 docs/dev/modules/core-playback.md */
export class DefaultCommandBus implements CommandBus {
  constructor(protected readonly handler: CommandHandler) {}

  dispatch(_command: PlaybackCommand, _source: CommandSource): boolean {
    return notImplemented('CommandBus.dispatch');
  }

  use(_interceptor: CommandInterceptor): () => void {
    return notImplemented('CommandBus.use');
  }
}
