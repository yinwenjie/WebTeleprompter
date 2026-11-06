# quality-e2e：端到端验收

**拥有文件**：`e2e/*`、`playwright.config.ts`、`.github/workflows/ci.yml`、`scripts/check-bundle-size.mjs`、`scripts/check-arch-rules.mjs`

**依赖**：全部模块完成后才能跑通。门禁脚本和 CI 已经可用。

## 环境

Playwright 浏览器未随项目安装，首次运行前执行：

```bash
npx playwright install
```

`playwright.config.ts` 用 `VITE_E2E=1` 构建，以开启 `window.__WTP_DEBUG__`。

```bash
npm run test:e2e
```

## 验收标准与方法

`e2e/acceptance.spec.ts` 已列出全部条目。实现后把 `test.fixme` 改为 `test`。

| #    | 方法                                                                                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 8-3  | 播放中依次切换镜像、全屏、纯净。比较前后 `progress` 差值（≤ 1 帧位移对应的比例）和 `speedPxPerSec`。**比较 progress 而不是 positionPx**（D-03） |
| 8-4  | 见下节                                                                                                                                          |
| 8-5  | 输入后等 600ms 刷新，断言内容、设置、进度（误差 < 2%）。再加一次：输入后等 50ms 就刷新，内容也不能丢（D-19）                                    |
| 8-6  | 读 `estimatedRemainingMs`，字号 40 → 80，变化 < 5%                                                                                              |
| 8-7  | 编辑态按空格：`phase` 仍是 idle，textarea 里多了空格。提词态按空格：`phase` 变化，`window.scrollY` 仍为 0                                       |
| 8-8  | 模拟拖拽，每帧记录 `positionPx` 在拖拽方向上单调；松手约 300ms 后 `phase = playing`                                                             |
| 8-9  | `page.addInitScript` 让 `window.indexedDB` 为 undefined，走通编辑、提词、导出，并看到降级提示                                                   |
| 8-10 | `npm run size` + Lighthouse CI（移动模拟）                                                                                                      |
| 8-11 | 模拟 `visibilitychange`，或用 CDP 暂停 30s 后恢复，断言位置增量 ≤ 单帧上限                                                                      |
| D-01 | 播放到中段 → 回编辑 → 刷新 → 进入提词，位置恢复                                                                                                 |
| D-03 | 窄窗口播放到中段 → 改宽窗口，`progress` 不变，阅读线附近的文字基本不变                                                                          |
| D-09 | 播放后 `page.close({ runBeforeUnload: true })`，重开后进度仍在                                                                                  |

8-1、8-6、8-11、8-12 同时有单元测试，分别在对应模块中。

## 8-4 性能测试

**只在本地运行，发版前手动执行。** CI 中已跳过：公共运行器没有 GPU，还与其他 worker 抢 CPU，曾把正常代码测成 P95 30fps。

```bash
npx playwright test -g "8-4" --project=chromium
```

```ts
const client = await page.context().newCDPSession(page);
await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
```

在页面内用 rAF 记录 10 秒的帧间隔，算 P95 对应的 fps，要求 ≥ 55。同时用 Performance trace 确认滚动期间没有 Layout 和 Paint 事件（架构 §1 的目标）。

用 5 档速度跑以下组合（R-2）：

| 视口           | 字号  | 内容             | 说明                          |
| -------------- | ----- | ---------------- | ----------------------------- |
| 桌面 1920×1080 | 48px  | 5 万字，有段落   | 典型                          |
| 桌面 1920×1080 | 120px | 5 万字，有段落   | 大字号                        |
| 手机 375×812   | 120px | 5 万字，有段落   | **最坏：内容层可达数百万 px** |
| 手机 375×812   | 48px  | 5 万字，每句一段 | DOM 节点多                    |

未达标时的处理顺序：先按段分层，再考虑虚拟化（架构 Q4）。把结果和结论记入 review 文档。

## 真机清单

Playwright 的 WebKit 不等于 iOS Safari。以下必须在 iPhone 和 Android 真机上走一遍（规划“质量保障”）：

需要 HTTPS 的功能（Wake Lock）要部署后测，局域网 http 测不了。

| 项目                                             | iPhone | iPad | Android |
| ------------------------------------------------ | ------ | ---- | ------- |
| 全屏：iPhone 走 fallback，其余原生               | ☐      | ☐    | ☐       |
| Wake Lock：提词 5 分钟不熄屏；切后台再回来仍有效 | ☐      | ☐    | ☐       |
| 不支持 Wake Lock 时有提示                        | ☐      | —    | —       |
| 触摸拖拽和惯性手感（R-7）                        | ☐      | ☐    | ☐       |
| 双击暂停，且不触发页面缩放                       | ☐      | ☐    | ☐       |
| 低速滚动无明显抖动（R-6）                        | ☐      | ☐    | ☐       |
| 5 万字 + 大字号无空白或闪烁（R-2）               | ☐      | ☐    | ☐       |
| 横竖屏切换后阅读位置基本不变                     | ☐      | ☐    | ☐       |
| 添加到主屏幕后功能正常                           | ☐      | ☐    | ☐       |
| 导入 GBK 编码的 .txt 不乱码（R-4）               | ☐      | ☐    | ☐       |

桌面 Safari 和 Firefox 走完整流程，确认快捷键在全屏下仍然有效。

## MVP 总验收（规划 §5）

`e2e/smoke.spec.ts` 的完整流程：输入 → 设置 → 全屏提词 → 保存，在 Chromium、Firefox、WebKit 和移动模拟上都通过；滚动稳定；刷新不丢稿。

## 门禁

`npm run check` 包含类型检查（含无 DOM 的 core 配置）、ESLint、依赖规则回归、格式、单元测试、构建和包体。CI 已配置。修改 `eslint.config.js` 后如果 `lint:arch` 报错，说明规则失效了，不要改样例去迁就。
