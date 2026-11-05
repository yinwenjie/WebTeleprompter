# core-speed-model：语速换算

**拥有文件**：`src/core/speed-model/*`

**依赖**：无。全部是纯函数。

**被谁使用**：core-playback（算 px/s）、ui-editor（预估时长）、app-shell（统计阅读单位）。

## 核心思路（D-02）

速度不靠估算字宽，而是用实测内容高度反推：

```text
总阅读秒数 = readingUnits ÷ 每分钟单位数(level, locale) × 60
px/s       = contentHeightPx ÷ 总阅读秒数
```

因此全文时长只取决于字数和档位，与字号、行距、边距、换行完全无关。**不要改回按字宽估算**：短句稿件上那种公式的误差可达 50%，原因见 [review D-02](../../architecture-review.md)。

## 要实现的函数

| 函数                                             | 行为                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `clampSpeedLevel(level)`                         | 夹到 [1, 10]，吸附到最近的 0.5。非有限数值返回默认档                                                          |
| `levelToUnitsPerMinute(level, locale)`           | `UNITS_PER_MINUTE_AT_DEFAULT_LEVEL[locale] × level ÷ 3`，与档位成正比。1 档约 67 字/分钟，10 档约 667 字/分钟 |
| `countReadingUnits(text, locale)`                | 见下                                                                                                          |
| `toPxPerSec(level, context)`                     | 上面的公式。`readingUnits` 或 `contentHeightPx` 为 0 时返回 0                                                 |
| `estimateReadingMs(units, level, locale)`        | 编辑区显示用，不依赖布局                                                                                      |
| `estimateRemainingMs(contentH, position, speed)` | `(contentH − position) ÷ speed × 1000`，下限为 0。`speed` 为 0 时返回 `null`                                  |

### 阅读单位

- CJK（`\p{Script=Han}`、平假名、片假名、谚文）每字 1 个单位。
- 其余字母和数字序列（`[\p{L}\p{N}]+`）每个连续序列 1 个单位。
- 空白和标点不计。

```text
"你好，world 2024！" → 你、好、world、2024 = 4
```

5 万字符要在几毫秒内算完，只扫描一遍，不要 `split` 再 `filter` 多轮。

## 关于校准

`UNITS_PER_MINUTE_AT_DEFAULT_LEVEL` 中 `zh-CN` 为 200，是规划 §3.2 区间（180–220）的中值。常量可调，公式结构不变。新增语言时加一行即可（架构 §7.4）。

## 已知局限

速度按全文平均。短行多的段落、大量空行，局部读起来会比平均快或慢。P0 接受。如果用户反馈明显，改为分段速度时改引擎，接口不变。

## 验收

`speed-model/__tests__/speedModel.test.ts` 的全部用例。两个 8-6 用例都要写，这是防止公式被改回去的回归测试：

| 场景                 | 字号 40 → 80 时内容高度 | 期望全文时长变化 |
| -------------------- | ----------------------- | ---------------- |
| 长段落连续换行       | ×4                      | 0                |
| 短句每行一句，不换行 | ×2                      | 0                |
