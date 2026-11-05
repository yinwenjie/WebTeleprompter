import { notImplemented } from '@/core/not-implemented';
import type { FileIOPort, PickedTextFile } from '@/core/ports/file-io';

/** 文件选择、编码探测（UTF-8 → GB18030）、下载。经 LazyFileIO 动态加载。 */
export class BrowserFileIO implements FileIOPort {
  pickTextFile(_accept: readonly string[]): Promise<PickedTextFile | null> {
    return notImplemented('BrowserFileIO.pickTextFile');
  }

  saveTextFile(_fileName: string, _mimeType: string, _text: string): Promise<void> {
    return notImplemented('BrowserFileIO.saveTextFile');
  }
}
