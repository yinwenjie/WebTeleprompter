import { describe, it } from 'vitest';

// 规格：docs/dev/modules/platform-storage.md。用 fake-indexeddb/auto 和 jsdom 环境。
describe('IdbScriptRepository', () => {
  it.todo('put / get / list / remove 往返一致，list 按 updatedAt 倒序');
  it.todo('校验失败的稿件移入隔离区，其余稿件正常返回');
  it.todo('隔离的数据可通过 listQuarantined 读回，不被删除');
  it.todo('QuotaExceededError 归一化为 StorageError(quota)');
  it.todo('收到 versionchange 时关闭连接，不阻塞其他标签页升级');
});

describe('ResilientScriptRepository', () => {
  it.todo('8-9：indexedDB 不可用时切到 fallback，open 返回 degraded: true');
  it.todo('primary 正常时 degraded 为 false');
});

describe('LocalSettingsRepository', () => {
  it.todo('load 在无数据、JSON 损坏、localStorage 抛错时都返回默认值');
  it.todo('load 迁移旧版本并回写');
  it.todo('save 配额超限时抛 StorageError(quota)');
});

describe('LocalScratchStore', () => {
  it.todo('草稿和进度的读写删往返一致');
  it.todo('localStorage 抛错时读返回 null，写抛 StorageError');
});
