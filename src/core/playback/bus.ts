import type { CommandSource, PlaybackCommand } from './commands';

export type CommandInterceptor = (command: PlaybackCommand, source: CommandSource) => boolean;
export type CommandHandler = (command: PlaybackCommand, source: CommandSource) => void;

export interface CommandBus {
  /**
   * 返回命令是否被接受。KeyboardInput 只在返回 true 时 preventDefault，
   * 否则编辑态下空格、方向键会失效（D-07）。
   */
  dispatch(command: PlaybackCommand, source: CommandSource): boolean;
  /** 拦截器按注册顺序执行，任一返回 false 即丢弃命令。 */
  use(interceptor: CommandInterceptor): () => void;
}
