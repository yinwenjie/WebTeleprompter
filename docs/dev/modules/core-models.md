# core-models：数据模型与迁移

**拥有文件**：`src/core/models/*`、`src/core/migrations/*` 及其 `__tests__`

**依赖**：无。纯函数，不做 I/O。

**被谁使用**：platform-storage、所有 state 和 ui 模块。

## 要实现的内容

### Script（`models/script.ts`）

| 函数              | 行为                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `createScript`    | `charCount` 按下面的规则计算；`lastProgress`、`lastPositionPx` 为 0；`createdAt = updatedAt = now` |
| `withContent`     | 返回新对象，更新 `content`、`charCount`、`updatedAt`。不改 `createdAt` 和播放进度                  |
| `validateScript`  | 见“校验规则”                                                                                       |
| `splitParagraphs` | 见“段落规则”                                                                                       |

**字数规则**：`charCount` 是非空白字符的码点数（`[...text]`，这样 emoji 算一个）。`MAX_SCRIPT_CHARS` 与 `content.length` 比较。

**校验规则**：

- 必需字段：`id`（非空字符串）、`content`（字符串）。缺失时返回 `{ ok: false }`，由调用方隔离。
- 可补齐字段：`title` 缺失用空字符串，时间戳缺失用 0，进度缺失用 0，`charCount` 重新计算。
- `lastProgress` 夹到 0..1；非有限数值按缺失处理。
- 不做 `schemaVersion` 迁移，迁移由调用方先跑。

**段落规则（D-16）**：

1. 把 `\r\n` 统一为 `\n`。
2. 以一个或多个空行（可含空白字符）分段，丢弃空段。
3. 如果结果只有一段且其中含 `\n`，改为每个非空行算一段。

段内保留单个换行，由 CSS `white-space: pre-wrap` 呈现。

### Settings（`models/settings.ts`）

类型、`DEFAULT_SETTINGS`、`SETTINGS_LIMITS`、`COLOR_PRESETS` 已写好。

- `normalizeSettings(raw)`：逐字段合并到默认值，数值夹到 `SETTINGS_LIMITS`，`speedLevel` 用 `clampSpeedLevel`，枚举非法时用默认值，颜色非 `#rrggbb` 时用默认值。对任何输入都不抛错。
- `contrastRatio(fg, bg)`：标准 WCAG 相对亮度公式。三个预设都必须 ≥ 7:1（架构 §7.3），写一个测试固定这一点。

### ExportBundle（`models/export-bundle.ts`）

- `createExportBundle`：组装备份。
- `parseExportBundle(raw)`：校验 `app === 'webteleprompter'`；跑 `bundleMigrations`；对每条稿件先跑 `scriptMigrations` 再 `validateScript`。**单条损坏不影响其余**，只有整个文件不合法才返回错误。`settings` 经 `normalizeSettings`。
- `resolveImportConflicts`：id 冲突时生成新 id，标题后加 `(导入)`（文案走参数，core 不依赖 i18n，默认值写成常量）。

### 迁移（`migrations/*`）

`runMigrations(raw, migrations)`：

- 读 `raw.schemaVersion`，缺失按 1。
- 第 `i` 项把版本 `i + 1` 升到 `i + 2`，依次执行到末尾并更新 `schemaVersion`。
- 版本高于代码支持的最新版本时返回 `{ ok: false }`，绝不覆盖数据。这是用户打开旧版页面时的保护。

迁移链当前为空（全部 v1），但运行器要用假迁移测试。验收 8-12 的夹具放在 `migrations/__tests__/fixtures/v1/`，今后每个版本都保留一份。

## 约束

- 手写校验，不引入 zod（D-14）。
- 所有函数都不改入参，返回新对象。

## 验收

`models/__tests__/models.test.ts`、`migrations/__tests__/migrations.test.ts` 的全部用例。对应架构 8-12。
