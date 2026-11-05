# app-shell：装配根与应用外壳

**拥有文件**：`src/app/*`、`src/i18n/*`、`src/styles/global.css`、`src/styles/themes/*`

**依赖**：全部模块。这是唯一可以 `new` 具体实现的地方（R4）。

`bootstrap.ts` 的接线已经写好，它就是架构 §4.2 数据流的代码形式。这个模块的工作主要是把缺口补上，以及做最后的联调。

## bindRootStyles（`rootStyles.ts`）

订阅 `settings` 和 `display`，写入根节点：

| 来源                            | 写入                                            |
| ------------------------------- | ----------------------------------------------- |
| `settingsToCssVars(settings)`   | 根节点的 CSS 变量                               |
| `fullscreenMode === 'native'`   | class `is-fullscreen`                           |
| `fullscreenMode === 'fallback'` | class `is-fullscreen`、`is-fullscreen-fallback` |
| `isClean`                       | class `is-clean`                                |
| `!controlsVisible`              | class `is-controls-hidden`                      |
| `viewportClass`                 | class `vp-phone`、`vp-tablet`、`vp-desktop`     |

只在值变化时写，避免无谓的样式重算。`presentation` 的 class 留给 P1。**镜像 class 不在根节点**，它只加在舞台的 `mirror` 节点上（ui-prompter）。

## 接线清单

`bootstrap.ts` 已接好：

- 编辑态拦截器、键盘、活动监测。
- 页面隐藏 → `pause` 命令；`pagehide` → `persistOnPageHide`。
- 视口、全屏、Wake Lock 状态回写。
- 进出提词模式 → `setPromptActive`。
- 切换稿件 → `controller.resetSession()`。
- `StageBridge` → `engine.setTarget`、`gesture.attach`、`controller.updateLayout`。

全部模块就绪后要联调确认的点：

| 检查                 | 期望                                                        |
| -------------------- | ----------------------------------------------------------- |
| 初始语速             | 设置恢复后，控制器的 `speedLevel` 是持久化的值              |
| 设置变化 → 速度      | 改字号后，`reportMetrics` 被触发且 px/s 更新                |
| `viewportClass` 初值 | 启动时用 `viewport.current` 写一次，`onChange` 不会补发初值 |
| 全屏、Wake Lock 初值 | 同上                                                        |
| 启动顺序             | `settings.hydrate` 在首次渲染前完成                         |

`display.promptActive` 的订阅每次控制器状态变化都会调用 `setPromptActive`，它内部按值去重。

## 收尾：删除骨架代码

全部模块完成后：

1. 确认控制台不再有 `[skeleton]` 告警。
2. 把 `steps.run('xxx', fn)` 改为直接调用，收集清理函数的逻辑保留。
3. 删除 `stepRunner.ts`、`core/not-implemented.ts`，以及 `AppContainer.unimplementedSteps`。
4. 全局搜索 `notImplemented`、`TODO`，应该都没有结果。

## 调试入口

`window.__WTP_DEBUG__` 提供 `getScrollState`、`getControllerState`。只在开发模式和 `VITE_E2E=1` 的构建中存在，生产包已验证不含此内容。E2E 需要新数据时在这里加读取方法，不要暴露可写的引用。

## i18n

`t()` 已实现。新增文案在 `src/locales/zh-CN.json` 中追加。键名格式 `模块.含义`。键是类型安全的，用错会编译报错。

## ErrorBoundary

`ui/shared/ErrorBoundary.tsx` 已实现，`App.tsx` 里有两层：外层兜底，内层有导出入口。舞台和编辑器各自再包一层，这样其中一个崩溃不影响导出（架构 §7.2）。

## 验收

`__tests__/bootstrap.test.ts` 持续通过；架构 8-2 的扩展点验证见 platform-remote；完整流程见 quality-e2e。
