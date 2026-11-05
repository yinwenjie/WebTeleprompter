# platform-input：键盘与手势

**拥有文件**：`src/platform/input/*`

**依赖**：`CommandBus` 接口、`FrameScheduler` 接口。只产生命令，不读写 store（R2）。

## KeyboardInput

`attach()` 在 `window` 上监听 `keydown`。按以下顺序过滤，任一条命中就直接返回，**不 preventDefault**：

1. `event.defaultPrevented`。
2. 带 `ctrlKey`、`metaKey`、`altKey`（`Cmd+R`、`Ctrl+F` 必须留给浏览器）。
3. 焦点在 `input`、`textarea`、`select` 或 `isContentEditable` 元素上（范围滑杆的方向键、编辑区打字都依赖这条）。
4. 按键是空格或 Enter，且焦点在 `button`、`a`、`summary` 或 `[role=button]` 上（否则会和按钮的点击重复触发）。
5. `event.repeat` 为真且命令不是 `speed.step`（长按方向键可以连续调速，长按空格不能反复切换）。

通过后查 `keymap`：字母键转小写再查，`?` 按 `event.key` 匹配。没有命中就返回。命中则：

```ts
if (bus.dispatch(command, 'keyboard')) event.preventDefault();
```

只有被接受的命令才阻止默认行为（D-07）。这保证编辑态的按键不受影响，提词态的空格又不会滚动页面（8-7）。

键位表已在 `keymap.ts`。P2 的蓝牙遥控只需换表，不要把键名写进其他地方。

## GestureInput

`attach(stageElement)` 在舞台元素上监听。舞台 CSS 已设 `touch-action: none`。

### 拖拽

只跟踪第一个按下的主指针（`button === 0`），其他指针忽略。

| 事件                                  | 行为                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `pointerdown`                         | 记录 `y0`、`pointerId`。**不发命令**                                                                                           |
| `pointermove` 累计超过 8px            | 首次超过时：`setPointerCapture`，发 `scrub.begin`，记录 `pos0 = getPositionPx()`                                               |
| 之后的 `pointermove`                  | `delta = (y0 − y) × (mirrorY ? −1 : 1)`，只保存目标位置，在 `scheduler.request` 回调里发 `seek.px(pos0 + delta)`，每帧最多一次 |
| `pointerup`                           | 未进入拖拽：按“双击”处理。已拖拽：按“惯性”处理                                                                                 |
| `pointercancel`、`lostpointercapture` | 已拖拽时直接发 `scrub.end`，没有惯性                                                                                           |

8px 阈值很重要：不能一按下就 `scrub.begin`，否则每次点击都打断播放（D-17）。

### 惯性

用最后约 100ms 的移动计算速度 `v`（px/ms）。

- `|v| < 0.3`：直接发 `scrub.end`。
- 否则进入惯性：每帧按摩擦系数衰减 `v`，发 `nudge.px`（方向同样受 `mirrorY` 影响），直到 `|v| < 0.02`，**然后才发 `scrub.end`**（D-17）。

惯性期间再次 `pointerdown`：停止惯性，不发 `scrub.end`，直接接续这次拖拽（`pos0` 重新读取，已经在 `scrubbing` 里）。若这次按下没有拖动就松开，发 `scrub.end`。

### 滚轮

`wheel` 用 `{ passive: false }` 注册并 `preventDefault`。按 `deltaMode` 换算为像素（line 乘 16，page 乘视口高度）。同一帧内累加，每帧发一次 `nudge.px`。`mirrorY` 时取反。带 `ctrlKey` 时不处理（触控板捏合会产生这种事件）。

### 双击

两次未进入拖拽的 `pointerup`，间隔 ≤ 300ms 且距离 ≤ 24px：发 `toggle`（规划 P0-9）。单击不发任何命令。

### 解绑

`attach` 返回的函数要：移除所有监听、取消排队的帧；如果正在拖拽或惯性中，发 `scrub.end`，避免控制器卡在 `scrubbing`。

## ActivityMonitor

监听 `pointermove`、`pointerdown`、`keydown`，节流到每 250ms 最多通知一次。

## 陷阱

- 镜像只影响 Y 方向的映射。`mirrorX` 不影响垂直拖拽。
- `getPositionPx`、`getMirror` 每次用时都调用，不要缓存。
- 高频命令的节流在这里做（架构 §4.3），控制器不节流。
- 触摸手感是已知风险（R-7），惯性参数集中为文件顶部的常量，便于真机调参。

## 验收

`__tests__/input.test.ts` 全部用例，使用 jsdom、假 `CommandBus`、`FakeFrameScheduler`。对应架构 8-7、8-8。
