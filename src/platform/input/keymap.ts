import type { PlaybackCommand } from '@/core/playback/commands';
import { SPEED_LEVEL_STEP } from '@/core/speed-model';

/** 键位表，按 KeyboardEvent.key 匹配（字母统一转小写）。P2 蓝牙遥控只需替换此表。 */
export type Keymap = Readonly<Record<string, PlaybackCommand>>;

export const DEFAULT_KEYMAP: Keymap = {
  ' ': { type: 'toggle' },
  ArrowUp: { type: 'speed.step', delta: SPEED_LEVEL_STEP },
  ArrowDown: { type: 'speed.step', delta: -SPEED_LEVEL_STEP },
  Home: { type: 'seek.top' },
  PageUp: { type: 'seek.paragraph', dir: -1 },
  PageDown: { type: 'seek.paragraph', dir: 1 },
  f: { type: 'display.toggleFullscreen' },
  m: { type: 'display.toggleMirror', axis: 'x' },
  c: { type: 'display.toggleClean' },
  '?': { type: 'display.toggleHelp' },
  Escape: { type: 'display.exitFullscreen' },
};
