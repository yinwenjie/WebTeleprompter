# platform-display：浏览器能力适配器

**拥有文件**：`src/platform/raf/*`、`src/platform/lifecycle/*`、`src/platform/viewport/*`、`src/platform/fullscreen/*`、`src/platform/wake-lock/*`、`src/platform/ids.ts`、`src/platform/__tests__/adapters.test.ts`

**接口**：`src/core/ports/display.ts`、`src/core/ports/clock.ts`、`FrameScheduler`

这些适配器都很薄：只负责把浏览器 API 变成接口，不含业务判断。

## RafScheduler / BrowserClock

直接转发 `requestAnimationFrame`、`cancelAnimationFrame`、`performance.now`（或 `Date.now`）、`setTimeout`、`clearTimeout`。**dt 截断不在这里**，在引擎内（D-06）。

## generateId

优先 `crypto.randomUUID`，否则用 `crypto.getRandomValues` 拼 UUID v4。前者只在安全上下文可用，且要求 Safari 15.4+；手机经局域网 http 访问开发机时必然走回退路径。

## PageLifecycle

- `visibilitychange`：`document.visibilityState` 为 `hidden` 时触发 `onHidden`，`visible` 时触发 `onVisible`。
- `pagehide`：触发 `onPageHide`。回调必须同步完成。

bootstrap 把 hidden 接到 `pause` 命令（D-06）。

## ViewportMonitor

用 `matchMedia` 和 `VIEWPORT_BREAKPOINTS` 分档：`< 600` 为 phone，`< 1024` 为 tablet，其余为 desktop。监听 `change` 事件，不用 `resize`。

## FullscreenAdapter

| 环境                                          | 行为                                                          |
| --------------------------------------------- | ------------------------------------------------------------- |
| 有 `requestFullscreen`                        | 原生，`mode = 'native'`                                       |
| 只有 `webkitRequestFullscreen`（iPad Safari） | 用带前缀的 API 和 `webkitfullscreenchange`，`mode = 'native'` |
| 都没有（iPhone Safari）                       | `mode = 'fallback'`：不调用任何 API，由 CSS class 铺满视口    |
| 调用被拒绝（reject）                          | 同样切 `fallback`                                             |

- **`enter()` 必须在进入函数后立即同步调用 `requestFullscreen`**，前面不能有 `await`，否则丢失用户手势（R-5）。
- 监听 `fullscreenchange`：用户按系统 `Esc` 退出时，`mode` 变 `none` 并通知。
- `exit()`：native 调用 `exitFullscreen`；fallback 直接转 `none` 并通知；已经是 `none` 时为空操作。
- fallback 全屏下 `Esc` 由 keymap 的 `display.exitFullscreen` 处理。

class 的写入不在这里，由 `app/rootStyles.ts` 根据 `displayStore.fullscreenMode` 完成。

## WakeLockAdapter

| 情况                             | status        |
| -------------------------------- | ------------- |
| `navigator.wakeLock` 不存在      | `unsupported` |
| 请求成功                         | `active`      |
| 请求失败（`NotAllowedError` 等） | `denied`      |
| 未持有                           | `inactive`    |

- 内部记录“持有意图”。`acquire` 设为 true，`release` 设为 false。
- 监听 sentinel 的 `release` 事件：系统释放时 status 转 `inactive`。
- 监听 `visibilitychange`：回到前台且持有意图为 true 时重新申请（页面隐藏后系统必然释放锁）。
- 所有方法都不抛错。

### iOS 风险（R-1）

iOS 16.4 以下没有这个 API，提词中屏幕会熄灭。P0 的处理是 `unsupported` 时由 ui-prompter 给出可见提示（是否放弃这些版本见 review Q-B）。不要自行加隐藏视频循环的 hack，除非已决定要支持这些版本并通过真机验证。

## 验收

`__tests__/adapters.test.ts` 全部用例（jsdom + stub 浏览器 API）。真机验证清单见 quality-e2e。
