// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserFileIO, decodeText, sanitizeFileName } from '../BrowserFileIO';

const buf = (bytes: number[]) => new Uint8Array(bytes).buffer;

// 规格：docs/dev/modules/platform-file-io.md
describe('decodeText', () => {
  it('UTF-8（含或不含 BOM）解码正确', () => {
    const utf8 = [...new TextEncoder().encode('你好 world')];
    expect(decodeText(buf(utf8))).toBe('你好 world');
    expect(decodeText(buf([0xef, 0xbb, 0xbf, ...utf8]))).toBe('你好 world');
    expect(decodeText(buf([]))).toBe('');
  });

  it('Windows 记事本保存的 GB18030 / GBK 中文不乱码', () => {
    expect(decodeText(buf([0xc4, 0xe3, 0xba, 0xc3]))).toBe('你好');
    expect(decodeText(buf([0x41, 0x0d, 0x0a, 0xc4, 0xe3]))).toBe('A\r\n你');
  });

  it('UTF-16 LE / BE BOM 解码正确', () => {
    expect(decodeText(buf([0xff, 0xfe, 0x60, 0x4f, 0x7d, 0x59]))).toBe('你好');
    expect(decodeText(buf([0xfe, 0xff, 0x4f, 0x60, 0x59, 0x7d]))).toBe('你好');
  });
});

describe('sanitizeFileName', () => {
  it('替换非法字符、限制长度、保留扩展名，空名用 untitled', () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j\u0001.txt')).toBe('a_b_c_d_e_f_g_h_i_j_.txt');
    expect(sanitizeFileName('.txt')).toBe('untitled.txt');
    expect(sanitizeFileName('')).toBe('untitled');
    const long = sanitizeFileName(`${'长'.repeat(300)}.json`);
    expect([...long].length).toBe(100);
    expect(long.endsWith('.json')).toBe(true);
  });
});

describe('BrowserFileIO', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('用户取消选择时返回 null', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const pending = new BrowserFileIO().pickTextFile(['.txt']);
    const input = click.mock.contexts[0] as HTMLInputElement;
    expect(input.accept).toBe('.txt');
    input.dispatchEvent(new Event('cancel'));
    await expect(pending).resolves.toBeNull();
    expect(document.querySelector('input[type=file]')).toBeNull();
  });

  it('选择文件后按编码规则解码并返回文件名', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      const file = new File([new Uint8Array([0xc4, 0xe3, 0xba, 0xc3])], '稿件.txt');
      Object.defineProperty(this, 'files', { value: [file] });
      this.dispatchEvent(new Event('change'));
    });
    await expect(new BrowserFileIO().pickTextFile(['.txt'])).resolves.toEqual({
      name: '稿件.txt',
      text: '你好',
    });
  });

  it('saveTextFile 用 Blob URL 下载，并在之后 revoke', async () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await new BrowserFileIO().saveTextFile('a/b.txt', 'text/plain', 'hi');
    const clicked = click.mock.contexts[0] as HTMLAnchorElement;
    expect(create).toHaveBeenCalledWith(expect.any(Blob));
    expect(clicked.download).toBe('a_b.txt');
    expect(clicked.href).toBe('blob:x');
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});
