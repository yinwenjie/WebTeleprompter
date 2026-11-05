import type { CommandBus } from '@/core/playback/bus';
import type { Keymap } from './keymap';
import { DEFAULT_KEYMAP } from './keymap';

export interface KeyboardInputDeps {
  bus: CommandBus;
  keymap?: Keymap;
}

const TEXT_INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const ACTIVATABLE_TAGS = new Set(['BUTTON', 'A', 'SUMMARY']);

function isEditable(element: Element | null): boolean {
  if (!element) return false;
  if (TEXT_INPUT_TAGS.has(element.tagName)) return true;
  return element instanceof HTMLElement && element.isContentEditable;
}

function isActivatable(element: Element | null): boolean {
  if (!element) return false;
  return ACTIVATABLE_TAGS.has(element.tagName) || element.getAttribute('role') === 'button';
}

function normalizeKey(key: string): string {
  return key.length === 1 && /[a-z]/i.test(key) ? key.toLowerCase() : key;
}

/** keydown → PlaybackCommand。过滤规则见 docs/dev/modules/platform-input.md */
export class KeyboardInput {
  constructor(protected readonly deps: KeyboardInputDeps) {}

  /** 在 window 上注册监听，返回解绑函数。 */
  attach(): () => void {
    const keymap = this.deps.keymap ?? DEFAULT_KEYMAP;
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const focused =
        event.target instanceof Element && event.target !== document.body
          ? event.target
          : document.activeElement;
      if (isEditable(focused)) return;
      if ((event.key === ' ' || event.key === 'Enter') && isActivatable(focused)) return;
      const command = keymap[normalizeKey(event.key)];
      if (!command) return;
      if (event.repeat && command.type !== 'speed.step') return;
      if (this.deps.bus.dispatch(command, 'keyboard')) event.preventDefault();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }
}
