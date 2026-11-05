import { settingsMigrations } from '@/core/migrations/settings';
import { runMigrations } from '@/core/migrations/runner';
import type { Settings } from '@/core/models/settings';
import { normalizeSettings } from '@/core/models/settings';
import type { SettingsRepository } from '@/core/ports/repositories';
import { readItem, writeItem } from './safeStorage';
import { LS_KEY_SETTINGS } from './schema';

export class LocalSettingsRepository implements SettingsRepository {
  /** 首屏路径：任何一步失败都返回默认值，永不抛错。 */
  load(): Settings {
    try {
      const raw = readItem(LS_KEY_SETTINGS);
      if (raw === null) return normalizeSettings(undefined);
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return normalizeSettings(undefined);
      }
      const record = parsed as Record<string, unknown>;
      const migrated = runMigrations(record, settingsMigrations);
      if (!migrated.ok) return normalizeSettings(undefined);
      const settings = normalizeSettings(migrated.value);
      if (migrated.value.schemaVersion !== record.schemaVersion) {
        try {
          this.save(settings);
        } catch {
          // 回写失败不影响本次读取。
        }
      }
      return settings;
    } catch {
      return normalizeSettings(undefined);
    }
  }

  save(settings: Settings): void {
    writeItem(LS_KEY_SETTINGS, JSON.stringify(settings));
  }
}
