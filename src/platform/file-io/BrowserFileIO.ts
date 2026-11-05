import type { FileIOPort, PickedTextFile } from '@/core/ports/file-io';

const MAX_FILE_NAME_LENGTH = 100;
/** 立刻 revoke 在部分浏览器会让下载失败。 */
const REVOKE_DELAY_MS = 10_000;

/** 解码规则（R-4）：BOM 优先；无 BOM 时严格 UTF-8，失败回退 GB18030。 */
export function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('gb18030').decode(bytes);
  }
}

export function sanitizeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = name.replace(/[/\\:*?"<>|\u0000-\u001f\u007f]/g, '_').trim();
  const match = /^(.*?)(\.[A-Za-z0-9]{1,8})?$/.exec(cleaned);
  const base = match?.[1]?.trim() ?? '';
  const extension = match?.[2] ?? '';
  const limited = [...base].slice(0, MAX_FILE_NAME_LENGTH - extension.length).join('');
  return `${limited.length > 0 ? limited : 'untitled'}${extension}`;
}

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** 文件选择、编码探测（UTF-8 → GB18030）、下载。经 LazyFileIO 动态加载。 */
export class BrowserFileIO implements FileIOPort {
  pickTextFile(accept: readonly string[]): Promise<PickedTextFile | null> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept.join(',');
    input.style.display = 'none';
    document.body.appendChild(input);
    const result = new Promise<PickedTextFile | null>((resolve, reject) => {
      const cleanup = () => input.remove();
      input.addEventListener('cancel', () => {
        cleanup();
        resolve(null);
      });
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        cleanup();
        if (!file) {
          resolve(null);
          return;
        }
        readAsArrayBuffer(file).then(
          (buffer) => resolve({ name: file.name, text: decodeText(buffer) }),
          reject,
        );
      });
    });
    input.click();
    return result;
  }

  saveTextFile(fileName: string, mimeType: string, text: string): Promise<void> {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = sanitizeFileName(fileName);
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
    return Promise.resolve();
  }
}
