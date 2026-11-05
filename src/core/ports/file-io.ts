export interface PickedTextFile {
  name: string;
  text: string;
}

/** 文件读写端口。解析业务规则不在此处，交给 core/models。 */
export interface FileIOPort {
  /** 弹出文件选择框并解码为文本；用户取消时返回 null。 */
  pickTextFile(accept: readonly string[]): Promise<PickedTextFile | null>;
  /** 触发浏览器下载。 */
  saveTextFile(fileName: string, mimeType: string, text: string): Promise<void>;
}
