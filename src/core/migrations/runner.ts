import { notImplemented } from '../not-implemented';

/** 第 i 项把 schemaVersion = i + 1 的数据升到 i + 2。迁移链只增不改。 */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * 从数据自身的 schemaVersion 跑到最新版本。纯函数，不做 I/O。
 * 缺失 schemaVersion 按 1 处理；版本高于当前代码时返回错误，绝不降级覆盖数据。
 */
export function runMigrations(
  _raw: Record<string, unknown>,
  _migrations: readonly Migration[],
): { ok: true; value: Record<string, unknown> } | { ok: false; reason: string } {
  return notImplemented('migrations.runMigrations');
}
