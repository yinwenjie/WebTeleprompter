# ui-editor：稿件编辑

**拥有文件**：`src/ui/editor/*`

**依赖**：`state/hooks`、`core/speed-model`（纯函数）、`core/models`（常量）。

## 布局

| 区域 | 内容                                         |
| ---- | -------------------------------------------- |
| 顶部 | 当前稿件标题（可编辑）、稿件库入口、设置入口 |
| 中部 | 大号 `textarea`，占满剩余高度                |
| 底部 | 字数、预估时长、保存状态、“开始提词”按钮     |

手机上全屏单页，“开始提词”常驻可见（规划 P0-9）。

## 行为

| 功能     | 实现                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| 输入     | 受控，`value = useScripts(s => s.draft)`，`onChange` 调 `updateDraft`                                         |
| 字数     | 用 `useDeferredValue(draft)` 计算，不阻塞输入                                                                 |
| 预估时长 | `estimateReadingMs(countReadingUnits(deferred, locale), speedLevel, locale)`，`speedLevel` 取自 `usePlayback` |
| 保存状态 | `saveStatus` 映射为文案，放在 `aria-live="polite"` 区域                                                       |
| 超长提示 | `draft.length > MAX_SCRIPT_CHARS` 时提示，**不截断**（规划 §3.1）                                             |
| 开始提词 | `dispatch({ type: 'mode.set', mode: 'prompt' })`。Stage 负责后续的测量和恢复（D-01）                          |
| 未就绪   | `ready === false` 时显示加载状态并禁用输入，否则用户可能在稿件加载前开始打字                                  |
| 无稿件   | `activeScriptId === null` 时显示新建入口                                                                      |

## 注意

- **中文输入法**：不要在 `compositionstart` 和 `compositionend` 之间做任何改写值的操作。受控 textarea 只原样回写即可。
- 设 `spellCheck={false}`，长文本的拼写检查很慢。
- 不要自己处理空格、方向键。`KeyboardInput` 在焦点位于 textarea 时已经不处理（8-7）。
- 5 万字粘贴后要在真机上试输入是否跟手。`draft` 变化只应该让这个组件重渲染。
- 保留上次光标位置不是 P0 需求。

## 验收

`src/ui/__tests__/ui.test.tsx` 的 EditorView 部分。对应架构 8-7（编辑态空格不触发播放）。

人工检查：粘贴 5 万字后打字不卡；中文输入法正常；刷新不丢内容。
