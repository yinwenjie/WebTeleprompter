# 模块开发指南

给实现各模块的 coding agent 看。先读完本页，再读你负责的模块文档。

## 文档优先级

冲突时按此顺序为准：

1. **代码里的接口和类型**（`src/core/**/types.ts`、`src/core/ports/*`、各 store 的 `*State`）：接口以代码为准，模块文档不重复抄写。
2. **[architecture-review.md](../architecture-review.md)**：决议编号 `D-xx`、风险编号 `R-x` 出自这里，优先于架构原文。
3. **模块文档**（`docs/dev/modules/`）。
4. **[architecture.md](../architecture.md)** 和 **[product-plan.md](../product-plan.md)**：背景与原始需求。

## 模块与实现顺序

同一批内的模块可以并行，互不阻塞。各模块已经有接口和桩，所以后面的批次也可以先用假实现提前开工，联调放到最后。

| 批次 | 模块                                                          | 依赖                            | 规划功能            |
| ---- | ------------------------------------------------------------- | ------------------------------- | ------------------- |
| 1    | [core-models](./modules/core-models.md)                       | 无                              | 数据模型、迁移      |
| 1    | [core-speed-model](./modules/core-speed-model.md)             | 无                              | 3.2 语速            |
| 1    | [core-scroll-engine](./modules/core-scroll-engine.md)         | 无                              | 3.3 滚动            |
| 1    | [platform-display](./modules/platform-display.md)             | 无                              | P0-4、P0-9          |
| 1    | [platform-file-io](./modules/platform-file-io.md)             | 无                              | P0-7                |
| 2    | [core-playback](./modules/core-playback.md)                   | speed-model、scroll-engine 接口 | P0-1、P0-6、P0-8    |
| 2    | [platform-input](./modules/platform-input.md)                 | 命令总线接口                    | P0-1、P0-8、P0-9    |
| 2    | [platform-storage](./modules/platform-storage.md)             | core-models                     | P0-7                |
| 3    | [state-settings](./modules/state-settings.md)                 | core-models                     | P0-2                |
| 3    | [state-script](./modules/state-script.md)                     | core-models                     | P0-7                |
| 3    | [state-display-playback](./modules/state-display-playback.md) | core-playback 接口              | P0-4、P0-9          |
| 4    | [app-shell](./modules/app-shell.md)                           | 第 1–3 批                       | 装配                |
| 4    | [ui-prompter](./modules/ui-prompter.md)                       | state                           | P0-1、3、4、5、6、9 |
| 4    | [ui-editor](./modules/ui-editor.md)                           | state                           | 3.1                 |
| 4    | [ui-settings](./modules/ui-settings.md)                       | state                           | P0-2、P0-3、P0-5    |
| 4    | [ui-library](./modules/ui-library.md)                         | state                           | P0-7                |
| 5    | [quality-e2e](./modules/quality-e2e.md)                       | 全部                            | 架构 §8 验收        |
| 预留 | [platform-remote](./modules/platform-remote.md)               | P0 不实现                       | P1                  |

## 骨架约定

- 未实现的方法调用 `notImplemented('Xxx.method')`。实现时删除这个调用，不要留下任何 TODO。
- `app/bootstrap.ts` 的 `steps.run` 会捕获 `NotImplementedError`，因此应用在任何进度下都能启动。控制台的 `[skeleton]` 告警列出尚未实现的启动步骤，做完一个模块后，它对应的条目应该消失。
- 每个模块的 `__tests__` 里已有 `it.todo`，它们就是该模块的最低验收清单。实现时把 `it.todo` 改成真实测试；发现清单之外的边界情况就继续加。
- 测试用 `src/core/testing/fakes.ts` 的 `FakeFrameScheduler` 和 `FakeClock`，不要用真实定时器。需要 DOM 的测试在文件第一行写 `// @vitest-environment jsdom`。

## 协作规则

**文件归属。** 每份模块文档开头列出它拥有的文件，只改这些文件。下面几个是共享文件：

| 文件                                         | 规则                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/locales/zh-CN.json`                     | 只追加键，不改别人的键                                                        |
| `src/styles/tokens.css`、`settingsToCssVars` | 两边同步修改                                                                  |
| `src/app/bootstrap.ts`                       | 归 app-shell。其他模块需要接线时，写在自己文档的“接线”一节，由 app-shell 落地 |

**修改接口。** core 的接口是模块之间的合同。确实需要改时，先在 `docs/architecture-review.md` 追加决议并说明原因，再改代码，并更新所有实现者和调用方。不要为了自己方便悄悄加字段。

**依赖方向。** 由 `npm run lint`、`npm run lint:arch` 和 `tsconfig.core.json` 强制。遇到报错时要调整设计，不要关规则：

- `core` 只依赖标准库。没有 `window`、`setTimeout`、`console`，这些能力经 `core/ports` 注入。
- `platform` 只依赖 `core`。需要的数据由 bootstrap 以函数形式注入。
- `state` 依赖 `core` 的接口和类型，不依赖 `platform`。
- `ui` 只经 `state/hooks` 访问数据和发命令。可以 import `core` 的类型和纯函数，不能 import `Default*` 实现。
- 只有 `app/bootstrap.ts` 可以 `new` 具体实现。
- 只有 `ui/prompter/Stage.tsx` 可以写滚动位置相关的 DOM 样式。

**跨模块通信。** 用户意图走命令，读状态走 store 订阅，依赖走接口注入，详见架构 §4.3。设置修改不走命令，唯一例外是语速（D-08）。

**代码风格。**

- 界面文案都走 `t()`，日期和数字用 `Intl`。
- 不引入未在架构 §2 列出的依赖。确有需要时先记入 review 文档。
- 首屏 JS 上限 120KB（gzip），由 `npm run size` 检查。非首屏模块用动态 import。

## 完成标准

一个模块完成时必须满足：

- [ ] `npm run check` 全部通过（类型、lint、依赖规则、格式、测试、构建、包体）。
- [ ] 模块文件中没有 `notImplemented` 和 `TODO`，`it.todo` 都已变成真实测试。
- [ ] 模块文档“验收”一节的每一条都有对应测试，或者说明了如何人工验证。
- [ ] 涉及 UI 的模块，已在 `npm run dev` 启动的页面中实际操作过，包括手机宽度。
- [ ] 全部模块完成后，由 app-shell 删除 `stepRunner.ts` 和 `not-implemented.ts`。

```bash
npm run check
```

```bash
npm run dev
```
