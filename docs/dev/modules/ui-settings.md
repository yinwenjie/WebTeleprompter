# ui-settings：设置抽屉

**拥有文件**：`src/ui/settings/*`

**依赖**：`state/hooks`、`core/models`（常量、`contrastRatio`）。

组件默认导出，由 `App.tsx` 动态加载（架构 §7.1），所以不要被首屏模块静态 import。

## 布局

桌面是侧边抽屉，手机是全屏页。可以在编辑和提词两种模式下打开。提词时打开不要暂停播放，用户需要边看边调。调整即时预览（规划 P0-2）。

## 设置项

范围取自 `SETTINGS_LIMITS`，不要硬编码。

| 分组 | 项                 | 控件                      | 写入                                         |
| ---- | ------------------ | ------------------------- | -------------------------------------------- |
| 外观 | 字号               | 滑杆                      | `setAppearance`                              |
|      | 行距               | 滑杆                      | `setAppearance`                              |
|      | 字体               | 单选（sans、serif、mono） | `setAppearance`                              |
|      | 左右边距           | 滑杆                      | `setAppearance`                              |
|      | 配色预设           | 三个色块                  | `applyColorPreset`                           |
|      | 自定义颜色         | `<input type="color">`    | `setAppearance`（preset 自动变 custom）      |
| 显示 | 水平、垂直镜像     | 开关                      | `setDisplay`                                 |
|      | 引导线样式         | 单选                      | `setGuide`                                   |
|      | 引导线位置、透明度 | 滑杆                      | `setGuide`                                   |
|      | 纯净模式保留进度条 | 开关                      | `setDisplay`                                 |
| 播放 | **语速**           | 滑杆，步进 0.5            | **`dispatch({ type: 'speed.set', level })`** |
|      | 倒计时             | 滑杆，0–10 秒             | `setPlayback`                                |

## 关键规则

**语速必须发命令（D-08）。** 控制器才是运行时真值，直接写 store 不会让滚动变速。滑杆的值从 `usePlayback(s => s.speedLevel)` 读。编辑态拦截器放行了 `speed.set`（D-18），所以两种模式下都能调。

**其他设置不发命令。** 设置修改不是播放意图（架构 §4.3）。

**恢复默认**：

```ts
settings.resetToDefaults();
dispatch({ type: 'speed.set', level: DEFAULT_SETTINGS.playback.speedLevel });
```

## 提示

| 情况                                    | 提示                      |
| --------------------------------------- | ------------------------- |
| 自定义配色 `contrastRatio < 4.5`        | 对比度不足（架构 §7.3）   |
| `wakeLock` 为 `unsupported` 或 `denied` | 无法阻止熄屏（架构 §7.2） |

## 可访问性和键盘

- 焦点限制在抽屉内，关闭后焦点回到触发按钮。
- `Esc` 关闭抽屉。在抽屉的 `onKeyDown` 中调用 `stopPropagation`，否则事件会传到 `window`，同时退出全屏。
- 滑杆的方向键不受影响：`KeyboardInput` 在焦点位于 `input` 时不处理（已测试）。

## 验收

`src/ui/__tests__/ui.test.tsx` 的 SettingsDrawer 部分。规划 P0-2、P0-3、P0-5。

人工检查：提词中拖字号滑杆，文字即时变化且阅读位置基本不变，滚动不中断、整体时长不变（D-02）；打开镜像后控件不翻转。
