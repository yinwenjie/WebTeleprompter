# ui-prompter：提词舞台与覆盖层

**拥有文件**：`src/ui/prompter/*`、`src/ui/shared/ShortcutHelp.tsx`、`src/styles/modes.css`

**依赖**：只用 `state/hooks`。

这是最重要、也最容易写坏性能的模块。滚动路径上不能有 React 渲染。

## DOM 结构（契约）

```text
stage     手势绑定、裁剪、背景
└ mirror  镜像 transform 只在这一层
  ├ anchor    top: var(--wtp-guide-position)
  │ └ content   will-change: transform ← 引擎每帧只写这里
  │   └ <p data-paragraph>…
  ├ GuideOverlay
  ├ ProgressOverlay
  ├ CountdownOverlay
  └ 暂停 / 结束提示
ControlBar（在 stage 之外，不受镜像影响）
StatusAnnouncer
```

- `anchor` 让 `translate3d(0, -position, 0)` 的 0 点正好落在阅读线上，所以改引导线位置不影响引擎。
- 倒计时和提示放在 `mirror` 内，否则在反射式提词器上读不了。
- `content` 需要 `position: relative`，这样段落的 `offsetTop` 相对于它。

## Stage

```text
挂载：
  const detach = bridge.attachStage({
    element: stageRef.current,
    target: { apply: (y) => { contentRef.current.style.transform = `translate3d(0, ${-y}px, 0)`; } },
  })
测量：
  ResizeObserver(content, stage) → 读高度和段落 offsetTop → bridge.reportMetrics(...)
恢复位置（D-01）：
  这份稿件的首次 reportMetrics 之后 → dispatch({ type: 'seek.progress', progress }, 'system')
卸载：
  detach()
```

### 必须遵守

| 规则                                                       | 原因                      |
| ---------------------------------------------------------- | ------------------------- |
| `Stage` 和段落绝不订阅 `scroll`                            | 每次重渲染 5 万字都会掉帧 |
| 段落用 `useMemo` 按 `draft` 缓存                           | 其他状态变化时不重建      |
| `apply` 只写 `transform`，不读任何布局属性                 | 架构 §7.1                 |
| 只在 `ResizeObserver` 回调里读 `offsetTop`、`offsetHeight` | 帧循环内读布局会强制重排  |
| **不用 `content-visibility: auto`**                        | 会让实测高度不准（D-11）  |
| 全仓库只有 `Stage.tsx` 可以写 `style.transform`            | R5，lint 强制             |

### 恢复位置（D-01）

进入提词的顺序：`mode.set prompt` → Stage 挂载 → 测量 → `reportMetrics` → `seek.progress`。

- 用 `useRef` 记录已恢复的 `scriptId`，每份稿件只恢复一次。之后的 `reportMetrics` 不要重新恢复（否则改字号就跳回去了）。
- `lastProgress ≥ 0.999` 视为从头开始，否则看完一遍的稿件打开就在结尾。
- 切换稿件时 `resetSession` 已把位置归零，`draft` 变化后 `ResizeObserver` 自然触发，走同一条路径。

### 段落（`renderParagraphs.tsx`）

`splitParagraphs(content).map(...)`，每段一个 `<p data-paragraph>`。段间距用 `margin`，它算在 `offsetTop` 里。这是 P1 文本格式化的唯一接入点（架构 §3.5）。

### 镜像

`useSettings(s => s.settings.display.mirrorX)`，在 `mirror` 节点上加 `styles.mirrorX`、`styles.mirrorY`。切换时引擎完全无感（架构 §6.4、8-3）。

## 覆盖层

**GuideOverlay**：`pointer-events: none`，读 `settings.display.guide`。

| style  | 呈现                                                                          |
| ------ | ----------------------------------------------------------------------------- |
| `line` | 阅读线位置的一条横线                                                          |
| `band` | 一行高的高亮带：`height: calc(var(--wtp-font-size) * var(--wtp-line-height))` |
| `mask` | 高亮带之外渐隐（用渐变，不要用 `backdrop-filter`，它代价高）                  |

**ProgressOverlay**：订阅 `scroll`（这是唯一允许的地方）。

- 进度条用 `transform: scaleX(progress)`，不要改 `width`。
- 剩余时间 = `estimatedRemainingMs`。已用时间 = `positionPx ÷ speedPxPerSec`（D-21），速度为 0 时显示 `--:--`。
- 选择器把时间取整到秒，避免 10Hz 重渲染。
- 纯净模式下只留 2px 细线，由 `settings.display.showProgressInClean` 控制。

**CountdownOverlay**：`phase === 'countdown'` 时居中显示 `ceil(countdownRemainingMs / 1000)`。

**暂停 / 结束提示**：阅读线处显示 `t('prompter.paused')` 或 `t('prompter.ended')`。

**StatusAnnouncer**：`aria-live="polite"` 的隐藏区域，播报倒计时、已暂停、已结束（架构 §7.3）。

## ControlBar

按钮：播放 / 暂停、减速、速度显示、加速、上一段、下一段、回顶、全屏、镜像、设置、返回编辑。

- 每个按钮都发命令（设置面板用 `setActivePanel`），都有 `aria-label` 和可见焦点环。
- **点击后不保留焦点**：`onMouseDown={(e) => e.preventDefault()}`。否则点过“返回编辑”后按空格会再次触发它，而不是切换播放。键盘 Tab 用户不受影响。
- `controlsVisible` 为 false 时淡出并设 `pointer-events: none`。
- 手机上触控目标 ≥ 44px，并避开 `env(safe-area-inset-bottom)`。

## 模式样式（`modes.css`）

| class                             | 效果                                                          |
| --------------------------------- | ------------------------------------------------------------- |
| `is-clean` + `is-controls-hidden` | 隐藏控件和光标（`cursor: none`）                              |
| `is-fullscreen-fallback`          | 舞台 `position: fixed; inset: 0`，`overscroll-behavior: none` |

`prefers-reduced-motion` 只影响控件淡入淡出，**不影响提词滚动**（架构 §7.3）。

## 提示

只显示一次，用 `localStorage` 记住：

| 情况                                    | 提示                                    |
| --------------------------------------- | --------------------------------------- |
| `fullscreenMode === 'fallback'`         | 建议添加到主屏幕以获得全屏              |
| `wakeLock` 为 `unsupported` 或 `denied` | 屏幕可能自动熄灭，请关闭自动锁屏（R-1） |

## ShortcutHelp

按 `?` 显示。键位从同一份定义生成，不要手写第二份。UI 不能 import platform，所以把展示用的键位说明放进 `zh-CN.json`，由 quality-e2e 或单测校验与 `DEFAULT_KEYMAP` 一致。

## 真机注意事项

- **长文本（R-2）**：手机窄屏 + 120px 字号是最坏情况，单层可达数百万 px。如果 iOS 上出现空白或闪烁，改为按段分层（每段一个独立层，只写外层 transform）。先测再改。
- **低速抖动（R-6）**：默认档约 14px/s，要在真机上看。

## 验收

`src/ui/__tests__/ui.test.tsx` 的 Stage、Overlays 部分。对应架构 8-3、8-4、8-5、8-8，由 quality-e2e 验证。

人工检查：播放中切换镜像、全屏、纯净模式，文字不跳；改字号后阅读位置基本不变；手机横竖屏都能用。
