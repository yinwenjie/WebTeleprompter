import { createStore, type StoreApi } from 'zustand/vanilla';
import { notImplemented } from '@/core/not-implemented';
import type { CommandBus } from '@/core/playback/bus';
import type { CommandSource, PlaybackCommand } from '@/core/playback/commands';
import type { PlaybackController, PlaybackState } from '@/core/playback/controller';
import type { ScrollEngine } from '@/core/scroll-engine/types';

export interface PlaybackStoreState extends PlaybackState {
  /** UI 发命令的唯一入口。source 默认 button。 */
  dispatch(command: PlaybackCommand, source?: CommandSource): boolean;
}

export type PlaybackStore = StoreApi<PlaybackStoreState>;

export interface PlaybackStoreDeps {
  bus: CommandBus;
  controller: PlaybackController;
  engine: ScrollEngine;
}

export function createPlaybackStore({ bus, controller, engine }: PlaybackStoreDeps): PlaybackStore {
  return createStore<PlaybackStoreState>(() => ({
    ...controller.getState(),
    scroll: engine.getState(),
    dispatch: (command, source = 'button') => bus.dispatch(command, source),
  }));
}

/** 把 controller 和 engine 的状态同步进 store，返回取消订阅函数。store 只读镜像，不改位置。 */
export function connectPlaybackStore(
  _store: PlaybackStore,
  _deps: Pick<PlaybackStoreDeps, 'controller' | 'engine'>,
): () => void {
  return notImplemented('connectPlaybackStore');
}
