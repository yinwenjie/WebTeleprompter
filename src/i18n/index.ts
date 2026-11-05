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
