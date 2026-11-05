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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 校验不可信来源（远程消息等）的命令结构，P1 的 RemoteTransport 必须经过它。 */
export function isPlaybackCommand(value: unknown): value is PlaybackCommand {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const type = v.type as PlaybackCommand['type'];
  switch (type) {
    case 'toggle':
    case 'play':
    case 'pause':
    case 'seek.top':
    case 'scrub.begin':
    case 'scrub.end':
    case 'display.toggleFullscreen':
    case 'display.exitFullscreen':
    case 'display.toggleClean':
    case 'display.toggleHelp':
      return true;
    case 'speed.step':
      return isFiniteNumber(v.delta);
    case 'speed.set':
      return isFiniteNumber(v.level);
    case 'seek.paragraph':
      return v.dir === 1 || v.dir === -1;
    case 'seek.px':
      return isFiniteNumber(v.positionPx);
    case 'seek.progress':
      return isFiniteNumber(v.progress);
    case 'nudge.px':
      return isFiniteNumber(v.deltaPx);
    case 'mode.set':
      return v.mode === 'edit' || v.mode === 'prompt';
    case 'display.toggleMirror':
      return v.axis === 'x' || v.axis === 'y';
    default: {
      const exhaustive: never = type;
      void exhaustive;
      return false;
    }
  }
}
