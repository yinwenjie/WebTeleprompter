# ui-library：稿件库

**拥有文件**：`src/ui/library/*`、`src/ui/shared/StorageBanner.tsx`

**依赖**：`state/hooks`。

组件默认导出，动态加载（架构 §7.1）。

## 稿件列表

按 `updatedAt` 倒序（store 已排好）。每行显示：标题、字数、更新时间（`Intl.DateTimeFormat`）、当前稿件标记。

| 操作      | 调用                 | 注意                                                  |
| --------- | -------------------- | ----------------------------------------------------- |
| 切换      | `setActive(id)`      | 切换后关闭面板                                        |
| 新建      | `create()`           | 切换到新稿件并进入编辑                                |
| 重命名    | `rename(id, title)`  | 行内编辑，`Enter` 确认，`Esc` 取消                    |
| 删除      | `remove(id)`         | **必须二次确认**（规划 P0-7），确认框写明稿件标题     |
| 导入 .txt | `importTextFile()`   | 必须在点击事件内同步调用，否则文件选择框被拦截        |
| 导出 .txt | `exportTextFile(id)` |                                                       |
| 备份全部  | `exportBundle()`     | 放在明显的位置，这是 Safari 7 天清除的最后防线（R-3） |
| 恢复备份  | `importBundle()`     | 解析失败时显示错误                                    |

确认框用组件内的对话框实现，不要用 `window.confirm`（全屏和移动端表现不一致）。也不要用 `<dialog>`，它要求 Safari 15.4+。

## 隔离的稿件

`quarantinedCount > 0` 时显示说明和“导出损坏数据”按钮（`exportQuarantined`）。不提供删除入口，数据要留给用户处理（架构 §7.2）。

## StorageBanner

在 `App.tsx` 中常驻渲染（不在动态加载的分包内，否则出错时可能加载不到）。

| 条件                     | 文案                                                       | 按钮     |
| ------------------------ | ---------------------------------------------------------- | -------- |
| `storageDegraded`        | `storage.degraded`                                         | 导出备份 |
| `saveStatus === 'error'` | `storage.quota`（`lastErrorKind` 为 `quota` 时）或通用文案 | 导出备份 |

它不能遮挡提词舞台。提词模式 + 纯净模式下隐藏；退出纯净模式后再显示。

## 空状态

无稿件时显示新建和导入入口。删除最后一份稿件后也走这里，不重新预置示例稿。

## 验收

`src/ui/__tests__/ui.test.tsx` 的 ScriptLibrary 部分。规划 P0-7，架构 8-9。

人工检查：删除当前稿件后界面切到另一份；存储被禁用时 banner 出现，备份仍能导出。
