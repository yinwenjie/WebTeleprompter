import { describe, it } from 'vitest';

// 规格：docs/dev/modules/core-models.md
describe('runMigrations', () => {
  it.todo('8-12：固定 v1 夹具跑完迁移链后与快照一致');
  it.todo('按顺序逐条执行并递增 schemaVersion');
  it.todo('缺失 schemaVersion 按 1 处理');
  it.todo('版本高于当前代码时返回错误，不改动数据');
});
