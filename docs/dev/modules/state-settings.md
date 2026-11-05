# state-settings：设置 store

**拥有文件**：`src/state/settingsStore.ts`、`src/state/__tests__/settingsStore.test.ts`、`index.html` 的内联脚本

**接口**：`SettingsStoreState`（已定）

**依赖**：`SettingsRepository` 端口、core-models。

## Actions

全部同步。

| Action                                      | 行为                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `hydrate`                                   | `repository.load()` 写入 state。bootstrap 在首次渲染前调用                           |
| `setAppearance`、`setDisplay`、`setGuide`   | 合并 → `normalizeSettings` → 写 state → 保存                                         |
| `setAppearance` 改了 `fgColor` 或 `bgColor` | 同时把 `preset` 设为 `custom`（除非 patch 里明确给了 preset）                        |
| `applyColorPreset`                          | 写入 `COLOR_PRESETS[preset]` 和 `preset`                                             |
| `setPlayback`                               | 只接受 `countdownSec`、`resumeDelayMs`。类型上已排除 `speedLevel`（D-08）            |
| `persistSpeedLevel`                         | 只由 `PlaybackEffects.onSpeedLevelChanged` 调用                                      |
| `toggleMirror`                              | 翻转 `mirrorX` 或 `mirrorY`（D-08：镜像归这里所有）                                  |
| `resetToDefaults`                           | 恢复 `DEFAULT_SETTINGS`。控制器的语速由 UI 随后发 `speed.set` 同步（见 ui-settings） |

**保存失败**：捕获 `StorageError`，内存状态仍然生效，下次修改时再试。设置丢了不算事故，不需要提示。

## settingsToCssVars

已实现，是设置到 CSS 变量的唯一映射。变量名和 `styles/tokens.css` 保持一致，写入根节点由 `app/rootStyles.ts` 完成。

## 首屏防闪烁（index.html 内联脚本）

架构 §7.1 要求首屏前写入 CSS 变量。内联脚本不能 import，所以要手写一份精简的映射：

```html
<script>
  try {
    var s = JSON.parse(localStorage.getItem('wtp.settings'));
    if (s && s.appearance) {
      var r = document.documentElement.style;
      r.setProperty('--wtp-font-size', s.appearance.fontSizePx + 'px');
      // …其余变量
    }
  } catch (e) {}
</script>
```

要求：

- 全程 try/catch，任何错误都不能阻断页面加载。
- 输出必须和 `settingsToCssVars` 一致。写一个测试：读取 `index.html`，提取脚本，在 jsdom 中运行，把结果和 `settingsToCssVars` 对比。这是防止两份映射漂移的唯一手段。
- 只影响首屏，之后由 `bindRootStyles` 接管。

## 不要做的事

- 不知道滚动位置（架构 §3.2）。
- 字号变化时不要自己算速度。流程是：字号变 → CSS 变量变 → 内容高度变 → `ResizeObserver` → `reportMetrics` → `controller.updateLayout`。

## 验收

`__tests__/settingsStore.test.ts` 全部用例，用内存假仓储。对应架构 8-5（设置恢复）。
