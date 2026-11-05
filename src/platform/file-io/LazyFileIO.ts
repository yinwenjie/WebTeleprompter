import type { FileIOPort, PickedTextFile } from '@/core/ports/file-io';

/** 首次使用时才加载实现，让文件处理代码不进首屏包（架构 §7.1）。 */
export class LazyFileIO implements FileIOPort {
  private loaded: Promise<FileIOPort> | null = null;

  private load(): Promise<FileIOPort> {
    this.loaded ??= import('./BrowserFileIO').then(({ BrowserFileIO }) => new BrowserFileIO());
    return this.loaded;
  }

  async pickTextFile(accept: readonly string[]): Promise<PickedTextFile | null> {
    return (await this.load()).pickTextFile(accept);
  }

  async saveTextFile(fileName: string, mimeType: string, text: string): Promise<void> {
    return (await this.load()).saveTextFile(fileName, mimeType, text);
  }
}
