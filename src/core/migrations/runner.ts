/** 第 i 项把 schemaVersion = i + 1 的数据升到 i + 2。迁移链只增不改。 */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * 从数据自身的 schemaVersion 跑到最新版本。纯函数，不做 I/O。
 * 缺失 schemaVersion 按 1 处理；版本高于当前代码时返回错误，绝不降级覆盖数据。
 */
export function runMigrations(
  raw: Record<string, unknown>,
  migrations: readonly Migration[],
): { ok: true; value: Record<string, unknown> } | { ok: false; reason: string } {
  const latest = migrations.length + 1;
  const declared = raw.schemaVersion;
  const version = declared === undefined ? 1 : declared;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, reason: 'invalid-schema-version' };
  }
  if (version > latest) return { ok: false, reason: 'schema-version-too-new' };
  let data: Record<string, unknown> = { ...raw, schemaVersion: version };
  for (let i = version - 1; i < migrations.length; i += 1) {
    data = { ...migrations[i]!(data), schemaVersion: i + 2 };
  }
  return { ok: true, value: data };
}
