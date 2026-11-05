import zhCN from '../locales/zh-CN.json';

export type MessageKey = keyof typeof zhCN;

/** 极简 t()：所有界面文案都走这里。{name} 形式的占位符由 params 替换。 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const message = zhCN[key];
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** 列出某个前缀下的全部键，按词典中的顺序。快捷键表等由词典驱动的列表用它。 */
export function messageKeysWithPrefix(prefix: string): MessageKey[] {
  return (Object.keys(zhCN) as MessageKey[]).filter((key) => key.startsWith(prefix));
}
