import { notImplemented } from '@/core/not-implemented';

/**
 * 生成 UUID v4。优先用 crypto.randomUUID，否则回退到 crypto.getRandomValues：
 * 前者只在安全上下文可用（手机经局域网 http 访问开发机时没有），且要求 Safari 15.4+。
 */
export function generateId(): string {
  return notImplemented('platform.generateId');
}
