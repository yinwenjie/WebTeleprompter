# platform-file-io：文件导入导出

**拥有文件**：`src/platform/file-io/*`

**接口**：`src/core/ports/file-io.ts`

`LazyFileIO` 已写好，负责动态加载。实现都放在 `BrowserFileIO` 里，这样文件处理代码不进首屏包。解析业务规则不在这里，这里只管字节和文本。

## pickTextFile(accept)

1. 创建隐藏的 `<input type="file">`，设置 `accept`。
2. 在用户手势内同步调用 `input.click()`。
3. 用户选择后读取为 `ArrayBuffer` 并按下面的规则解码，返回 `{ name, text }`。
4. 用户取消时返回 null。监听 `cancel` 事件；旧版浏览器不支持时，这个 Promise 会一直挂起，调用方不要因此阻塞界面（不要在等待期间显示遮罩）。

## 解码规则（R-4）

导出一个可单独测试的 `decodeText(buffer: ArrayBuffer): string`：

1. 检查 BOM：`EF BB BF` → UTF-8；`FF FE` → UTF-16LE；`FE FF` → UTF-16BE。
2. 无 BOM：`new TextDecoder('utf-8', { fatal: true })`。
3. 抛错时回退：`new TextDecoder('gb18030')`（GBK 的超集）。

Windows 下保存的中文 `.txt` 常是 GBK，`File.text()` 会把它们解成乱码且不报错，所以不能用它。

## saveTextFile(fileName, mimeType, text)

1. 把文件名中的 `/ \ : * ? " < > |` 和控制字符替换为 `_`，长度限制到 100 个字符，空文件名用 `untitled`。
2. `new Blob([text], { type })` → `URL.createObjectURL` → 创建 `<a download>` → `click()`。
3. 延迟后 `revokeObjectURL`（立刻 revoke 在部分浏览器会让下载失败）。

## 文件名约定

由调用方（scriptStore）传入：稿件用 `<标题>.txt`，备份用 `webteleprompter-backup-YYYYMMDD-HHmm.json`。

## 验收

`__tests__/fileIO.test.ts` 全部用例。GBK 测试用硬编码字节，不要依赖外部文件：`new Uint8Array([0xc4, 0xe3, 0xba, 0xc3])` 应解码为“你好”。
