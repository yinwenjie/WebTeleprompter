# state-display-playback：显示与播放 store

**拥有文件**：`src/state/displayStore.ts`、`src/state/playbackStore.ts`、`src/state/stageBridge.ts`、`src/state/hooks/*`、`src/state/__tests__/displayPlaybackStore.test.ts`

**接口**：`DisplayStoreState`、`PlaybackStoreState`、`StageBridge`（已定）。`hooks` 已实现。

## playbackStore

只读镜像，不改位置（架构 §3.2）。`createPlaybackStore` 已写好，要实现的是：

**`connectPlaybackStore(store, { controller, engine })`**

- `controller.subscribe` → `store.setState(controllerState)`。
- `engine.subscribe` → `store.setState({ scroll })`。引擎已节流到 10Hz，这里不再节流。
- 连接时先同步一次当前值，避免启动窗口内的状态丢失。
- 返回取消两个订阅的函数。

`dispatch` 已实现，默认 source 为 `button`。

## displayStore

| Action                                  | 行为                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `toggleFullscreen`                      | `mode === 'none'` 时进入，否则退出。进入时记录当前 `isClean`，并设 `isClean = true`（架构 §6.4） |
| `exitFullscreen`                        | `mode === 'none'` 时空操作，否则退出                                                             |
| `setFullscreenMode`                     | 由适配器回写。转为 `none` 时把 `isClean` 恢复为进入前的值。这样用户按系统 `Esc` 退出也能恢复     |
| `toggleClean`                           | 翻转 `isClean`                                                                                   |
| `toggleHelp`、`setActivePanel`          | 改字段                                                                                           |
| `noteActivity`                          | `controlsVisible = true`，重置 `CONTROLS_AUTO_HIDE_MS` 定时器                                    |
| 定时器到期                              | 面板打开（`activePanel !== 'none'`）或帮助打开时不隐藏，否则 `controlsVisible = false`           |
| `setViewportClass`、`setWakeLockStatus` | 由适配器回写                                                                                     |
| `setPromptActive`                       | 值变化时才执行：true → `wakeLock.acquire()`，false → `wakeLock.release()`                        |

**用户手势（R-5）**：从按键到 `requestFullscreen` 全链路必须同步：

```text
keydown → bus.dispatch → controller.handle → effects.onDisplayCommand
       → displayStore.toggleFullscreen → fullscreen.enter() → requestFullscreen()
```

`toggleFullscreen` 里不能有 `await` 出现在调用 `enter()` 之前。写一个测试：用假端口断言 `enter` 在 `toggleFullscreen` 返回前已被调用。

**异步结果**：`enter()` 的 Promise resolve 后用 `setFullscreenMode` 写入结果。reject 不会发生（适配器内部已转 fallback）。

## StageBridge

接口定义在这里，实现在 `app/bootstrap.ts`。

## hooks 使用约定

要写进代码审查清单：

- 总是传选择器，不要返回整个 state。
- 选择器返回新对象时，配合 `useShallow`。
- `scroll` 字段以 10Hz 更新，只有进度和时间的 overlay 可以订阅。`Stage` 和段落内容绝不能订阅它。

## 验收

`__tests__/displayPlaybackStore.test.ts` 全部用例，用假端口和 `FakeClock`。
