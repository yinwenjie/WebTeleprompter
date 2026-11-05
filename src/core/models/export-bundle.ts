import { notImplemented } from '../not-implemented';
import type { Result } from './result';
import type { Script } from './script';
import type { Settings } from './settings';

export const EXPORT_BUNDLE_SCHEMA_VERSION = 1 as const;

export interface ExportBundle {
  app: 'webteleprompter';
  schemaVersion: typeof EXPORT_BUNDLE_SCHEMA_VERSION;
  exportedAt: number;
  scripts: Script[];
  settings?: Settings;
}

export function createExportBundle(
  _scripts: Script[],
  _settings: Settings | undefined,
  _now: number,
): ExportBundle {
  return notImplemented('models.createExportBundle');
}

/** 解析导入文件：校验 app 字段，运行迁移链，逐条校验稿件。 */
export function parseExportBundle(_raw: unknown): Result<ExportBundle> {
  return notImplemented('models.parseExportBundle');
}

/** id 冲突时生成新 id 并在标题后加“(导入)”（架构 §5.3）。 */
export function resolveImportConflicts(
  _incoming: Script[],
  _existingIds: ReadonlySet<string>,
  _generateId: () => string,
): Script[] {
  return notImplemented('models.resolveImportConflicts');
}
