# WebTeleprompter

打开浏览器即用的网页提词器：免费、无水印、数据留在本地。面向直播、录播创作者和反射式提词器用户。

> 当前状态：项目骨架。接口和模块结构已就绪，功能尚未实现，进度见 [模块开发指南](docs/dev/README.md)。

## 开发

需要 Node.js 22.22 或更高版本（24 需 24.15+）。

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run check
```

## 文档

| 文档                                       | 内容                           |
| ------------------------------------------ | ------------------------------ |
| [产品规划](docs/product-plan.md)           | 定位、P0 功能、路线图          |
| [架构设计](docs/architecture.md)           | 分层、接口、数据模型           |
| [架构 Review](docs/architecture-review.md) | 对架构的修正，优先于架构原文   |
| [模块开发指南](docs/dev/README.md)         | 实现顺序、协作规则、各模块规格 |

## 目录结构

```text
src/
  app/        组合根：唯一可以 new 具体实现的地方
  core/       纯 TypeScript，无 DOM：滚动引擎、播放控制、数据模型、端口
  platform/   浏览器适配器：输入、存储、全屏、Wake Lock、文件
  state/      Zustand stores 和 React hooks
  ui/         React 组件
  i18n/       t() 函数
  locales/    词典
  styles/     CSS 变量和显示模式
e2e/          Playwright 验收测试
docs/         文档
```
