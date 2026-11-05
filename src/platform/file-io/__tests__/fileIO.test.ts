import { describe, it } from 'vitest';

// 规格：docs/dev/modules/platform-file-io.md
describe('decodeText', () => {
  it.todo('UTF-8（含或不含 BOM）解码正确');
  it.todo('Windows 记事本保存的 GB18030 / GBK 中文不乱码');
  it.todo('UTF-16 LE / BE BOM 解码正确');
});

describe('BrowserFileIO', () => {
  it.todo('用户取消选择时返回 null');
  it.todo('saveTextFile 用 Blob URL 下载，并在之后 revoke');
});
