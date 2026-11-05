# state-script：稿件 store

**拥有文件**：`src/state/scriptStore.ts`、`src/state/__tests__/scriptStore.test.ts`，以及 `zh-CN.json` 的示例稿件键

**接口**：`ScriptStoreState`（已定）

**依赖**：`ScriptRepository`、`ScratchStore`、`FileIOPort`、`Clock`、core-models。

这是“稿子不丢”的核心模块。下面的每一条都对应一种丢稿路径。

## 启动：load

```text
1. repository.open() → storageDegraded、quarantinedCount
2. repository.list()
3. 未设置 seededSample 且列表为空：创建示例稿件，写 seededSample = true
4. 对每份稿件：
   - scratch.readDraft(id) 非空且不同于 content → 该稿件有未落库的草稿
   - scratch.readProgress(id) 非空 → 合并到 lastProgress / lastPositionPx，落库后删除暂存
5. 确定 activeScriptId：meta 中的值（若仍存在）> 最近更新的稿件 > null
6. draft = 当前稿件的草稿暂存 ?? content
7. 若 draft ≠ content：saveStatus = 'pending'，安排落库
8. ready = true
```

示例稿只预置一次：用户删光稿件后不再出现。文案放在 `zh-CN.json` 的 `sample.title`、`sample.content`。

`load` 内部捕获全部错误，不向外 reject，否则会变成未处理的 Promise 拒绝。

## 编辑：updateDraft（架构 §6.5、D-19）

```text
updateDraft(text)
  ├─ 立即 set({ draft: text, saveStatus: 'pending' })
  ├─ 节流 100ms：scratch.writeDraft(id, draft)   ← 写失败静默，不影响编辑
  └─ 防抖 500ms：写入队列 → withContent + repository.put
        成功：若 draft 没再变化则 removeDraft，saveStatus = 'saved'
        失败：保留暂存，saveStatus = 'error'，记录 lastErrorKind
```

用 `Clock` 实现节流和防抖，不要用 `setTimeout`。

## 写入队列

所有 `put` 必须串行，否则内容保存和进度保存会互相覆盖：内容保存读到旧进度、进度保存读到旧内容。

- 用一个 Promise 链串行化。
- 每个写操作在**执行时**（而不是入队时）读取 store 中最新的稿件，只改自己负责的字段，再 `put`。
- 写失败不能打断队列。

## 其他 Actions

| Action      | 行为                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `flush`     | 取消防抖，立即排队保存，等待完成                                                                                     |
| `setActive` | 先 `flush` 当前稿件，再切换 `activeScriptId`、`draft`，写 meta。bootstrap 监听变化并调用 `controller.resetSession()` |
| `create`    | 新建并切换过去，默认标题来自 `t()`                                                                                   |
| `rename`    | 改标题，更新 `updatedAt`                                                                                             |
| `remove`    | 删除稿件和它的暂存。删的是当前稿件时切到最近更新的一份；没有稿件时 `activeScriptId = null`                           |

### 播放位置（D-09）

| Action              | 行为                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `savePlaybackPoint` | 经写入队列保存 `lastProgress`、`lastPositionPx`，**不改 `updatedAt`**。否则播放一次，稿件库的排序就变了          |
| `persistOnPageHide` | **只做同步写入**：`scratch.writeProgress(...)`，并把节流中尚未写出的草稿写入暂存。IndexedDB 事务在此时不保证完成 |

### 导入导出

| Action              | 行为                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `importTextFile`    | `pickTextFile(['.txt'])` → `createScript`，标题取文件名去扩展名 → 切换过去。超过 5 万字也接受（由编辑区提示）                                                       |
| `exportTextFile`    | 先 `flush`，再保存 `<标题>.txt`                                                                                                                                     |
| `importBundle`      | `pickTextFile(['.json'])` → `JSON.parse` → `parseExportBundle` → `resolveImportConflicts` → 逐条 `put`。文件损坏时设置错误状态，不动现有数据。P0 **不覆盖**当前设置 |
| `exportBundle`      | 先 `flush`，`createExportBundle(scripts, getSettingsForExport(), now)`。这是所有错误路径的兜底，必须在存储已损坏时也能工作：`list` 失败就退回内存中的 `scripts`     |
| `exportQuarantined` | `listQuarantined` 导出原始数据                                                                                                                                      |

## 错误处理

| 情况                  | 处理                                                |
| --------------------- | --------------------------------------------------- |
| `kind: 'quota'`       | `saveStatus = 'error'`，草稿保留在暂存。UI 提示导出 |
| `kind: 'unavailable'` | 同上                                                |
| 暂存写失败            | 静默。内存中的 draft 仍在，防抖落库照常进行         |

## 陷阱

- `draft` 是编辑中的真值，`scripts[].content` 是已落库的值。显示和导出当前稿件前先想清楚用哪个。
- `ScrollEngine` 给出的 `progress` 在 `ended` 时为 1。恢复时不要把用户带到文末：ui-prompter 会把 ≥ 0.999 视为从头开始。
- 不要直接调用 idb，全部经 Repository（架构 §3.2）。

## 验收

`__tests__/scriptStore.test.ts` 全部用例，用内存假仓储、假暂存和 `FakeClock`。对应架构 8-5、8-9。至少覆盖以下时序：

| 时序                                | 期望                       |
| ----------------------------------- | -------------------------- |
| 输入 → 暂存已写 → 落库前崩溃 → load | 草稿恢复，重新落库         |
| 输入 → 落库中再次输入 → 第一次成功  | 暂存不删除，第二次落库     |
| 进度保存和内容保存同时排队          | 两边的字段都不丢           |
| put 失败 → 下次输入 → put 成功      | 状态恢复 `saved`，暂存删除 |
