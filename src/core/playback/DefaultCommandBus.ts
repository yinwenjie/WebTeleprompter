import type { CommandBus, CommandHandler, CommandInterceptor } from './bus';
import type { CommandSource, PlaybackCommand } from './commands';

/** 规格见 docs/dev/modules/core-playback.md */
export class DefaultCommandBus implements CommandBus {
  private interceptors: CommandInterceptor[] = [];

  constructor(protected readonly handler: CommandHandler) {}

  dispatch(command: PlaybackCommand, source: CommandSource): boolean {
    for (const interceptor of this.interceptors) {
      if (!interceptor(command, source)) return false;
    }
    this.handler(command, source);
    return true;
  }

  use(interceptor: CommandInterceptor): () => void {
    this.interceptors = [...this.interceptors, interceptor];
    return () => {
      this.interceptors = this.interceptors.filter((i) => i !== interceptor);
    };
  }
}
