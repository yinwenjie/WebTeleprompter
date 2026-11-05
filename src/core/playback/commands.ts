import { notImplemented } from '../not-implemented';

export type AppMode = 'edit' | 'prompt';

/** 显示类命令不经状态机，由 PlaybackEffects.onDisplayCommand 转交（D-04、D-07）。 */
export type DisplayCommand =
  | { type: 'display.toggleMirror'; axis: 'x' | 'y' }
  | { type: 'display.toggleFullscreen' }
  | { type: 'display.exitFullscreen' }
  | { type: 'display.toggleClean' }
  | { type: 'display.toggleHelp' };

/** 全部字段可 JSON 序列化，P1 远程控制直接传输。 */
export type PlaybackCommand =
  | { type: 'toggle' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'speed.step'; delta: number }
  | { type: 'speed.set'; level: number }
  | { type: 'seek.top' }
  | { type: 'seek.paragraph'; dir: 1 | -1 }
  | { type: 'seek.px'; positionPx: number }
  /** 按比例定位：恢复上次位置、点击进度条。D-13 */
  | { type: 'seek.progress'; progress: number }
  | { type: 'nudge.px'; deltaPx: number }
  | { type: 'scrub.begin' }
  | { type: 'scrub.end' }
  | { type: 'mode.set'; mode: AppMode }
  | DisplayCommand;

export type CommandSource = 'keyboard' | 'button' | 'gesture' | 'remote' | 'voice' | 'system';

/** 校验不可信来源（远程消息等）的命令结构，P1 的 RemoteTransport 必须经过它。 */
export function isPlaybackCommand(_value: unknown): _value is PlaybackCommand {
  return notImplemented('commands.isPlaybackCommand');
}
