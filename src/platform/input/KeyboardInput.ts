import { notImplemented } from '@/core/not-implemented';
import type { CommandBus } from '@/core/playback/bus';
import type { Keymap } from './keymap';

export interface KeyboardInputDeps {
  bus: CommandBus;
  keymap?: Keymap;
}

/** keydown → PlaybackCommand。过滤规则见 docs/dev/modules/platform-input.md */
export class KeyboardInput {
  constructor(protected readonly deps: KeyboardInputDeps) {}

  /** 在 window 上注册监听，返回解绑函数。 */
  attach(): () => void {
    return notImplemented('KeyboardInput.attach');
  }
}
