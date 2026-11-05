import { notImplemented } from '@/core/not-implemented';
import type { DisplayStore } from '@/state/displayStore';
import type { SettingsStore } from '@/state/settingsStore';

/**
 * 把 settingsToCssVars 的结果和显示模式 class 写到根节点，返回取消订阅函数。
 * state 层不碰 DOM，所以放在 app 层。规格见 docs/dev/modules/app-shell.md
 */
export function bindRootStyles(
  _root: HTMLElement,
  _settings: SettingsStore,
  _display: DisplayStore,
): () => void {
  return notImplemented('bindRootStyles');
}
