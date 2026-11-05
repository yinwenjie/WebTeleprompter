# platform-storage：本地存储

**拥有文件**：`src/platform/storage/*`

**接口**：`src/core/ports/repositories.ts`

**依赖**：`idb`、core-models、core-migrations。

**核心目标**：稿子不丢。任何异常都归一化为 `StorageError`，这里不做 UI 提示。

## IdbScriptRepository

### open

```text
openDB(IDB_NAME, IDB_VERSION, { upgrade, blocking })
```

- **upgrade**：v1 创建 `scripts`（keyPath `id`，索引 `updatedAt`）和 `meta`（keyPath `key`）。今后的版本在这里运行 `scriptMigrations`（同一个 versionchange 事务内）。
- **blocking**：收到其他标签页的升级请求时关闭连接，不要阻塞对方。
- **校验**：打开后遍历一次稿件，`validateScript` 失败的移入 `meta` 的 `META_KEY_QUARANTINE` 记录（数组），并从 `scripts` 删除。整个过程在一个读写事务里。返回 `quarantinedCount`。**绝不删除无法解析的数据**（架构 §5.3）。
- 调用 `navigator.storage?.persist?.()`，不等待结果，失败也不影响。这是 Safari 7 天清除的主要防线（R-3）。

### 其他方法

- `list`：按 `updatedAt` 倒序。用 `updatedAt` 索引反向游标。
- `put`、`remove`、`getMeta`、`setMeta`：薄封装。
- 写操作等 `tx.done` 后才 resolve。

### 错误归一化

| 原始错误                                                            | kind                               |
| ------------------------------------------------------------------- | ---------------------------------- |
| `QuotaExceededError`，或 `AbortError` 且 `tx.error` 是配额错误      | `quota`                            |
| `indexedDB` 未定义、`open` 抛 `InvalidStateError` / `SecurityError` | `unavailable`                      |
| `VersionError`（用户打开了比数据更旧的页面）                        | `unavailable`，**不要**尝试删库    |
| 其他                                                                | `unknown`，通过 `cause` 保留原错误 |

Safari 有时报 `Connection to Indexed Database server lost`：这种情况自动重新打开并重试一次。

## FallbackScriptRepository（架构 §7.2）

IndexedDB 不可用时使用。内存 `Map` 为主，每次写操作尽力把全部稿件写到 `LS_KEY_FALLBACK_SCRIPTS`（失败静默）；`open` 时读回。`open` 返回 `degraded: true`。

## ResilientScriptRepository

`open()`：调用 `primary.open()`，失败或超时（3 秒，防止 Safari 的 open 挂起）就切到 `fallback.open()` 并强制 `degraded: true`。之后全部方法转发给选中的实现。未 `open` 就调用其他方法是编程错误，直接抛错。

## LocalSettingsRepository

- `load`：读 `LS_KEY_SETTINGS` → `JSON.parse` → `runMigrations(settingsMigrations)` → `normalizeSettings`。迁移发生变化时回写。**任何一步失败都返回 `DEFAULT_SETTINGS`，永不抛错**：这是首屏路径。
- `save`：`JSON.stringify` 后写入，失败抛 `StorageError`。

## LocalScratchStore

键名由 `lsKeyDraft`、`lsKeyProgress` 生成。读失败返回 null，写失败抛 `StorageError('quota' 或 'unavailable')`，删除失败静默。`readProgress` 要校验结构，数据不合法返回 null。

**localStorage 在部分隐私模式下连访问都会抛错**，所有访问都要放在 try/catch 里，包括读 `window.localStorage` 这个属性本身。

## 陷阱

- 键名和数据库名只在 `schema.ts` 定义。
- 存储层不截断内容，5 万字上限由 UI 提示（架构 §5.2）。
- 保存进度和保存内容都走 `put`，所以调用方要保证传入完整、最新的稿件（见 state-script 的写入队列）。

## 验收

`__tests__/storage.test.ts` 全部用例。在测试文件顶部 `import 'fake-indexeddb/auto'`，并使用 `// @vitest-environment jsdom`。对应架构 8-5、8-9。
