# WebTeleprompter

纯前端、免安装的网页提词器。技术栈：Vite + TypeScript（strict）+ React + Zustand，无后端。

## 开始工作前

实现模块时，先读 [docs/dev/README.md](docs/dev/README.md)，再读你负责的模块文档 `docs/dev/modules/<模块>.md`。

| 文档                                           | 用途                                                        |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `docs/architecture-review.md`                  | 对架构的修正（`D-xx` 决议、`R-x` 风险），**优先于架构原文** |
| `docs/architecture.md`、`docs/product-plan.md` | 原始架构和需求，保持原样不修改                              |

## 常用命令

```bash
npm run dev
```

```bash
npm run check
```

提交前必须通过 `npm run check`（类型、lint、依赖规则、格式、测试、构建、包体）。

## 不可违反的规则

依赖方向由工具强制：`core` ← `platform`、`state` ← `ui`，只有 `app/bootstrap.ts` 可以 `new` 具体实现。

- 遇到依赖规则报错时要调整设计，不要关规则。
- 滚动路径上不能有 React 渲染，只有 `ui/prompter/Stage.tsx` 可以写滚动相关样式。
- `core` 没有 `window`、`setTimeout`、`console`，这些能力经 `core/ports` 注入。
- 修改 core 接口前，先在 review 文档追加决议。
