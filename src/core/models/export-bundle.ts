import { bundleMigrations } from '../migrations/bundle';
import { runMigrations } from '../migrations/runner';
import { scriptMigrations } from '../migrations/script';
import type { Result } from './result';
import type { Script } from './script';
import { validateScript } from './script';
import type { Settings } from './settings';
import { normalizeSettings } from './settings';

export const EXPORT_BUNDLE_SCHEMA_VERSION = 1 as const;

/** 导入时 id 冲突的标题后缀默认值。core 不依赖 i18n，调用方可传入本地化文案。 */
export const DEFAULT_IMPORT_TITLE_SUFFIX = '(导入)';

export interface ExportBundle {
  app: 'webteleprompter';
  schemaVersion: typeof EXPORT_BUNDLE_SCHEMA_VERSION;
  exportedAt: number;
  scripts: Script[];
  settings?: Settings;
}

export function createExportBundle(
  scripts: Script[],
  settings: Settings | undefined,
  now: number,
): ExportBundle {
  const bundle: ExportBundle = {
    app: 'webteleprompter',
    schemaVersion: EXPORT_BUNDLE_SCHEMA_VERSION,
    exportedAt: now,
    scripts: scripts.map((script) => ({ ...script })),
  };
  if (settings) bundle.settings = settings;
  return bundle;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 解析导入文件：校验 app 字段，运行迁移链，逐条校验稿件。 */
export function parseExportBundle(raw: unknown): Result<ExportBundle> {
  if (!isRecord(raw) || raw.app !== 'webteleprompter') return { ok: false, reason: 'not-a-bundle' };
  const migrated = runMigrations(raw, bundleMigrations);
  if (!migrated.ok) return migrated;
  const data = migrated.value;
  if (!Array.isArray(data.scripts)) return { ok: false, reason: 'missing-scripts' };

  const scripts: Script[] = [];
  for (const item of data.scripts) {
    if (!isRecord(item)) continue;
    const upgraded = runMigrations(item, scriptMigrations);
    if (!upgraded.ok) continue;
    const valid = validateScript(upgraded.value);
    if (valid.ok) scripts.push(valid.value);
  }

  const bundle: ExportBundle = {
    app: 'webteleprompter',
    schemaVersion: EXPORT_BUNDLE_SCHEMA_VERSION,
    exportedAt:
      typeof data.exportedAt === 'number' && Number.isFinite(data.exportedAt) ? data.exportedAt : 0,
    scripts,
  };
  if (data.settings !== undefined) bundle.settings = normalizeSettings(data.settings);
  return { ok: true, value: bundle };
}

/** id 冲突时生成新 id 并在标题后加“(导入)”（架构 §5.3）。 */
export function resolveImportConflicts(
  incoming: Script[],
  existingIds: ReadonlySet<string>,
  generateId: () => string,
  titleSuffix: string = DEFAULT_IMPORT_TITLE_SUFFIX,
): Script[] {
  const taken = new Set(existingIds);
  return incoming.map((script) => {
    if (!taken.has(script.id)) {
      taken.add(script.id);
      return { ...script };
    }
    let id = generateId();
    while (taken.has(id)) id = generateId();
    taken.add(id);
    const title = script.title ? `${script.title} ${titleSuffix}` : titleSuffix;
    return { ...script, id, title };
  });
}
