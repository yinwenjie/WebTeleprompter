import { describe, it } from 'vitest';

// 规格：docs/dev/modules/core-models.md
describe('Script', () => {
  it.todo('createScript 计算 charCount，初始进度为 0');
  it.todo('withContent 更新 charCount 与 updatedAt，不改 createdAt 和播放进度');
  it.todo('validateScript 补齐缺失字段，拒绝缺 id 或 content 不是字符串的数据');
  it.todo('splitParagraphs：空行分段，多个连续空行不产生空段');
  it.todo('splitParagraphs：全文没有空行时每个非空行算一段');
  it.todo('splitParagraphs：兼容 \\r\\n');
});

describe('Settings', () => {
  it.todo('normalizeSettings 补齐缺失字段，非法输入返回默认值，永不抛错');
  it.todo('normalizeSettings 把越界数值夹到 SETTINGS_LIMITS');
  it.todo('contrastRatio：黑白为 21，三个预设都 ≥ 7:1');
});

describe('ExportBundle', () => {
  it.todo('parseExportBundle 拒绝 app 字段不匹配的文件');
  it.todo('损坏的单条稿件不影响其余稿件');
  it.todo('resolveImportConflicts：id 冲突时换新 id 并在标题后加“(导入)”');
});
