import type { CommandInterceptor } from './bus';
import type { AppMode } from './commands';

/**
 * 编辑态只放行 mode.set 和 speed.set。
 * 架构 §4.4 只放行 mode.set，但设置面板可以在编辑态打开，其语速滑杆也要生效（D-18）。
 * 键盘只产生 speed.step，所以放行 speed.set 不会让按键穿透到编辑区。
 */
export function createEditModeInterceptor(getMode: () => AppMode): CommandInterceptor {
  return (command) =>
    getMode() === 'prompt' || command.type === 'mode.set' || command.type === 'speed.set';
}
