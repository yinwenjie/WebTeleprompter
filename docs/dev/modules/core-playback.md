# core-playback：命令总线与播放控制器

**拥有文件**：`src/core/playback/*`（`commands.ts`、`bus.ts`、`controller.ts` 中的接口已定）

**依赖**：`ScrollEngine` 接口、`Clock` 端口、`speed-model`。

**被谁使用**：所有输入源经 `CommandBus` 发命令；playbackStore 订阅状态。

## CommandBus

- `dispatch`：按注册顺序运行拦截器，任一返回 false 就丢弃并返回 false；否则调用 handler 并返回 true。
- 必须同步。全屏命令要保留用户手势，路径上不能有任何 `await`（R-5）。
- 不持有业务逻辑。
- `createEditModeInterceptor` 已实现（D-18）。

## isPlaybackCommand

校验不可信数据：`type` 必须已知，字段类型正确，数值有限（`dir` 只能是 ±1，`axis` 只能是 x/y，`mode` 只能是 edit/prompt）。P1 的 `RemoteTransport` 依赖它，所以要严格。用 `switch` 覆盖全部类型，这样新增命令时 TypeScript 会报错提醒。

## 控制器：通用规则

- **命令同步执行。当前阶段无效的命令是空操作，绝不抛错**（D-12）。命令不要求幂等：`toggle`、`speed.step` 本来就不幂等。
- 只有控制器调用引擎的 `start`、`stop`、`seek`、`nudge`、`setSpeed`、`setMetrics`。
- 控制器构造时订阅引擎，收到 `atEnd` 且 `phase = playing` 时转入 `ended`。
- `handle` 用穷尽 `switch`，新增命令类型时编译报错。

## 状态转换表

这张表替代架构 §4.4 的图（D-10）。“—”表示空操作。

| 当前阶段    | play              | pause                              | toggle          | scrub.begin              | scrub.end | 引擎 atEnd | 倒计时结束 |
| ----------- | ----------------- | ---------------------------------- | --------------- | ------------------------ | --------- | ---------- | ---------- |
| `idle`      | 开始 ¹            | —                                  | 同 play         | → scrubbing ⁴            | —         | —          | —          |
| `countdown` | —                 | → idle ²                           | → idle ²        | 取消倒计时 → scrubbing ⁴ | —         | —          | → playing  |
| `playing`   | —                 | → paused                           | → paused        | 停引擎 → scrubbing ⁵     | —         | → ended    | —          |
| `paused`    | 恢复 ³            | —                                  | 恢复 ³          | → scrubbing ⁴            | —         | —          | —          |
| `scrubbing` | wasPlaying = true | wasPlaying = false，取消恢复定时器 | 翻转 wasPlaying | 取消恢复定时器           | ⁶         | —          | —          |
| `ended`     | 回顶后开始 ¹      | —                                  | 同 play         | → scrubbing ⁴            | —         | —          | —          |

1. **开始**：内容为空（`contentHeightPx = 0` 或 `readingUnits = 0`）时停留在原阶段。否则 `countdownSec > 0` 进入 `countdown`，`= 0` 直接进入 `playing`。`countdownSec` 在此时读取。
2. 保留位置。
3. **恢复**：不再倒计时。若引擎已 `atEnd` 则直接转 `ended`。
4. `wasPlaying = false`。
5. `wasPlaying = true`。
6. **scrub.end**：`wasPlaying = false` 时转 `paused`。`wasPlaying = true` 时启动 `resumeDelayMs` 定时器，期间 `phase` 保持 `scrubbing`，到期转 `playing` 并 `engine.start()`；若此时已 `atEnd` 则转 `ended`。

### 定位和调速

| 命令                                                     | 行为                                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `speed.step`、`speed.set`                                | 任何阶段都执行：`clampSpeedLevel` → 重算 px/s → `engine.setSpeed` → `effects.onSpeedLevelChanged`。不改阶段 |
| `seek.px`、`seek.progress`、`seek.paragraph`、`nudge.px` | 调用引擎。不改阶段，只有 `ended` 转 `paused`                                                                |
| `seek.top`                                               | `engine.seek(0)`。`paused`、`ended` 转 `idle`；其他阶段不变（`playing` 下从头继续播放）                     |

**seek.progress**：`progress`（夹到 0..1）× `contentHeightPx`。

**seek.paragraph**，设当前位置 `p`，`ε = 1px`，偏移来自 `engine.getMetrics().paragraphOffsetsPx`：

- `dir = 1`：跳到第一个 `> p + ε` 的偏移；没有则不动。
- `dir = −1`：跳到最后一个 `< p − ε` 的偏移；没有则跳到 0。

### 模式

| 命令                | 行为                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `mode.set prompt`   | 只改 `mode`。`phase` 保持不变                                                                |
| `mode.set edit`     | `playing`、`scrubbing` 转 `paused` 并停引擎，取消恢复定时器；`countdown` 转 `idle`。其余不变 |
| 与当前相同的 `mode` | 空操作                                                                                       |

### 显示命令

`display.*` 直接转交 `effects.onDisplayCommand`，不改任何状态。保持同步。

### 副作用（PlaybackEffects）

| 回调                  | 时机                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `onSavePoint`         | 进入 `paused`、进入 `ended`（scrubbing → paused 也算）；`seek.top` 回到 `idle` 时也要触发，否则下次打开会跳回旧位置 |
| `onSpeedLevelChanged` | 档位实际变化时（值没变不触发）                                                                                      |
| `onDisplayCommand`    | 收到 `display.*`                                                                                                    |

## 非命令方法

**`updateLayout({ metrics, readingUnits, locale })`**：先 `engine.setMetrics(metrics)`，再用新高度算 `toPxPerSec` 并 `engine.setSpeed`。保存 `readingUnits`、`locale` 供调速时使用。Stage 上报测量结果时触发。

**`resetSession()`**：切换稿件时调用。取消所有定时器，停引擎，`engine.seek(0)`，转 `idle`，`mode` 不变。

**`dispose()`**：取消定时器和订阅。

## 倒计时

用 `Clock` 实现。每 1000ms 更新一次 `countdownRemainingMs` 并通知订阅者，归零时转 `playing`、`engine.start()`。不要依赖帧循环：页面隐藏时 rAF 不会触发。

## 陷阱

- `scrubbing` 下的 `system` 来源 `pause`（页面隐藏）只改 `wasPlaying`，手势层会因 `pointercancel` 发 `scrub.end`，最终落到 `paused`。
- 进入 `playing` 的路径有三条（倒计时结束、恢复、拖拽恢复），都要处理 `atEnd`。把它们收敛到一个私有方法。
- 所有定时器的取消集中到一个地方，否则切模式或换稿后容易“幽灵启动”。

## 验收

`__tests__/DefaultPlaybackController.test.ts`（表中每个非空单元格都要有用例）、`__tests__/DefaultCommandBus.test.ts`。用 `FakeClock` 和真实的 `DefaultScrollEngine` + `FakeFrameScheduler`，对应架构 8-1、8-6、8-7、8-8。
