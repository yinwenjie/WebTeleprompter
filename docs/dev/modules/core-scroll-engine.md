# core-scroll-engine：滚动引擎

**拥有文件**：`src/core/scroll-engine/DefaultScrollEngine.ts`、`src/core/scroll-engine/__tests__/*`

**接口（已定，不要改）**：`src/core/scroll-engine/types.ts`

**依赖**：只依赖注入的 `FrameScheduler`。

**被谁使用**：只有 `PlaybackController` 调用会改变状态的方法。`setTarget` 例外，由 bootstrap 的 `StageBridge` 调用。

## 位置的语义

- `positionPx = 0`：首行顶部对准阅读线。
- `positionPx = contentHeightPx`：文末越过阅读线，此时 `atEnd = true`。
- 取值范围 `[0, contentHeightPx]`。不用 `viewportHeightPx` 计算边界，文末自然留白（规划 §3.3）。

引擎只认这一个数字。阅读线在屏幕上的位置由 CSS 决定（见 ui-prompter 的 `anchor` 节点），改变引导线位置不会影响引擎。

## 帧循环

```text
frame(now):
  若 lastFrameMs 为空：lastFrameMs = now，排下一帧，返回     ← 第一帧不推进
  dt = min(now − lastFrameMs, maxFrameDtMs)                  ← 截断，默认 100ms（D-06）
  lastFrameMs = now
  position = min(position + speed × dt ÷ 1000, contentHeight)
  target?.apply(position)
  若到达末尾：running = false，通知订阅者，不再排帧
  否则：距上次通知 ≥ stateEmitIntervalMs 时通知；排下一帧
```

**性能要求**（这是滚动路径，会被 8-4 度量）：

- 帧循环中不分配对象。`ScrollState` 只在通知或 `getState()` 时才构造。
- 未运行时不向调度器请求帧。
- 位置保持浮点，亚像素滚动是低速平滑的前提（默认档约 14px/s）。

## 方法规格

| 方法         | 行为                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------- |
| `start`      | 已在运行时为空操作。`atEnd` 时为空操作（`running` 保持 false）。清空 `lastFrameMs` 后排帧 |
| `stop`       | 取消已排的帧，`running = false`。已停止时为空操作                                         |
| `setSpeed`   | 负数和非有限值按 0 处理。运行中改速不中断循环                                             |
| `seek`       | 夹到范围内，立即 `target.apply`，立即通知。运行中调用后，下一帧从新位置继续               |
| `nudge`      | 等价于 `seek(position + delta)`                                                           |
| `setMetrics` | 见下                                                                                      |
| `setTarget`  | 注册时立即 `apply` 当前位置（舞台重新挂载后位置正确）；传 null 后不再写                   |
| `getState`   | 按当前值构造。`progress` 在内容为空时为 0                                                 |
| `subscribe`  | 返回取消函数。遍历时允许监听器取消订阅或调用 `stop`                                       |
| `dispose`    | 取消帧，清空订阅者和 target                                                               |

### setMetrics（D-03）

```text
若旧 contentHeight > 0 且新 contentHeight ≠ 旧值：
  position = position × 新 contentHeight ÷ 旧 contentHeight       ← 保持 progress
否则：
  position 不变                                                    ← 仅视口变化时
再把 position 夹到新范围，立即 target.apply，立即通知
```

这样进入全屏导致重新换行时，读者仍停留在大致相同的文字处；只有高度变化时位置完全不变。

旧高度为 0（首次测量）时位置不变。恢复上次位置由 Stage 另外发 `seek.progress` 完成。

### 派生字段

| 字段                   | 规则                                               |
| ---------------------- | -------------------------------------------------- |
| `atStart`              | `position ≤ 0`                                     |
| `atEnd`                | `contentHeight = 0`，或 `position ≥ contentHeight` |
| `progress`             | `contentHeight > 0 ? position ÷ contentHeight : 0` |
| `estimatedRemainingMs` | 用 `estimateRemainingMs`                           |

### 通知频率（D-15）

立即通知：`start`、`stop`、`seek`、`nudge`、`setSpeed`、`setMetrics`、到达末尾。运行中的其余更新按 `stateEmitIntervalMs`（默认 100ms）节流。

控制器靠 `atEnd` 的立即通知转入 `ended`，所以这个通知不能被节流吞掉。

## 陷阱

- 不要在引擎内监听页面可见性，也不要因为后台自行停止。页面隐藏由 `pause` 命令处理（D-06）。这里只负责 dt 截断。
- 引擎不知道镜像、字号和全屏（架构 §1.1 第 5 条）。
- 不要 import speed-model 以外的任何东西，speed-model 也只用于算剩余时间。

## 验收

`__tests__/DefaultScrollEngine.test.ts` 的全部用例，对应架构 8-1、8-11。用 `FakeFrameScheduler`：

```ts
const scheduler = new FakeFrameScheduler();
const engine = new DefaultScrollEngine({ scheduler });
engine.setMetrics({ contentHeightPx: 100_000, viewportHeightPx: 800, paragraphOffsetsPx: [] });
engine.setSpeed(100);
engine.start();
scheduler.run(1001); // 第一帧只记时间，所以 1001 帧产生 1000 个 dt
```
