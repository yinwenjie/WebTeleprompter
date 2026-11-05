import type { PlaybackCommand } from '@/core/playback/commands';
import type { PlaybackPhase } from '@/core/playback/controller';
import type { ScrollState } from '@/core/scroll-engine/types';

/** P1 预留：P0 只定义接口，不提供实现。收到的消息必须先经 isPlaybackCommand 校验。 */
export type RemoteMessage =
  | { kind: 'command'; cmd: PlaybackCommand }
  | { kind: 'state'; state: ScrollState; phase: PlaybackPhase };

export interface RemoteTransport {
  send(message: RemoteMessage): void;
  onMessage(callback: (message: unknown) => void): () => void;
  readonly status: 'disconnected' | 'connecting' | 'connected';
}
