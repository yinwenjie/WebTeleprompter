import { describe, expect, it } from 'vitest';
import { parseExportBundle } from '../../models/export-bundle';
import { validateScript } from '../../models/script';
import { normalizeSettings } from '../../models/settings';
import { bundleMigrations } from '../bundle';
import type { Migration } from '../runner';
import { runMigrations } from '../runner';
import { scriptMigrations } from '../script';
import { settingsMigrations } from '../settings';
import bundleV1 from './fixtures/v1/bundle.json';
import scriptV1 from './fixtures/v1/script.json';
import settingsV1 from './fixtures/v1/settings.json';

// 规格：docs/dev/modules/core-models.md
describe('runMigrations', () => {
  it('8-12：固定 v1 夹具跑完迁移链后与快照一致', () => {
    const script = runMigrations(structuredClone(scriptV1), scriptMigrations);
    expect(script.ok).toBe(true);
    if (!script.ok) return;
    const validated = validateScript(script.value);
    expect(validated).toEqual({ ok: true, value: scriptV1 });

    const settings = runMigrations(structuredClone(settingsV1), settingsMigrations);
    expect(settings.ok && normalizeSettings(settings.value)).toEqual(settingsV1);

    const bundle = runMigrations(structuredClone(bundleV1), bundleMigrations);
    expect(bundle.ok).toBe(true);
    expect(parseExportBundle(structuredClone(bundleV1))).toEqual({ ok: true, value: bundleV1 });
  });

  it('按顺序逐条执行并递增 schemaVersion', () => {
    const seen: number[] = [];
    const migrations: Migration[] = [
      (d) => (seen.push(d.schemaVersion as number), { ...d, a: 1 }),
      (d) => (seen.push(d.schemaVersion as number), { ...d, b: (d.a as number) + 1 }),
    ];
    const input = { schemaVersion: 1, x: 'keep' };
    const result = runMigrations(input, migrations);
    expect(seen).toEqual([1, 2]);
    expect(result).toEqual({ ok: true, value: { schemaVersion: 3, x: 'keep', a: 1, b: 2 } });
    expect(input).toEqual({ schemaVersion: 1, x: 'keep' });

    const fromTwo = runMigrations({ schemaVersion: 2, a: 5 }, migrations);
    expect(fromTwo).toEqual({ ok: true, value: { schemaVersion: 3, a: 5, b: 6 } });
  });

  it('缺失 schemaVersion 按 1 处理', () => {
    const result = runMigrations({ x: 1 }, [(d) => ({ ...d, y: 2 })]);
    expect(result).toEqual({ ok: true, value: { x: 1, y: 2, schemaVersion: 2 } });
    expect(runMigrations({ x: 1 }, [])).toEqual({ ok: true, value: { x: 1, schemaVersion: 1 } });
  });

  it('版本高于当前代码时返回错误，不改动数据', () => {
    const input = { schemaVersion: 3, x: 1 };
    const result = runMigrations(input, [(d) => d]);
    expect(result.ok).toBe(false);
    expect(input).toEqual({ schemaVersion: 3, x: 1 });
    expect(runMigrations({ schemaVersion: 'x' }, []).ok).toBe(false);
    expect(runMigrations({ schemaVersion: 0 }, []).ok).toBe(false);
  });
});
