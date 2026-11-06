# WebTeleprompter

纯前端、免安装的网页提词器：打开浏览器即用，免费、无水印，数据留在本地。面向直播、录播创作者与反射式提词器用户。

## 功能

基于产品规划中的 P0（MVP）能力：

- 播放控制与快捷键（空格暂停/继续、上下键调速、Home 回顶等）
- 外观设置（字号、行距、字体、前景/背景配色、边距）
- 镜像翻转（水平 / 垂直，适配反射式硬件）
- 全屏与纯净模式
- 阅读引导线 / 焦点区域
- 倒计时与进度指示
- 稿件本地持久化与多稿管理（自动保存、导入导出）
- 手动滚动 / 拖拽定位
- 响应式与移动端适配（含屏幕防休眠）

> **说明**：远程控制（手机扫码控制电脑）属于 P1，当前尚未实现，计划后续迭代。

## 技术栈

- Vite + React 18 + TypeScript
- Zustand（状态）
- idb / IndexedDB（稿件持久化）
- Vitest + Playwright（单元 / E2E 测试）

## 环境要求

需要 Node.js `^22.22.2`、`^24.15.0` 或 `>=26.0.0`（见 `package.json` 的 `engines` 字段）。

## 快速开始

```bash
npm install
```

### 开发

```bash
npm run dev
```

### 构建与预览

```bash
npm run build
npm run preview
```

### 测试与质量检查

```bash
npm run test          # Vitest 单元测试
npm run test:e2e      # Playwright E2E
npm run check         # typecheck + lint + 格式 + 测试 + 构建 + 体积检查
```

其他常用脚本：`npm run typecheck`、`npm run lint`、`npm run format`、`npm run test:watch`。

## 项目结构

```text
src/
  app/        组合根：装配与启动
  core/       纯 TypeScript（无 DOM）：滚动引擎、播放控制、数据模型、端口
  platform/   浏览器适配：输入、存储、全屏、Wake Lock、文件
  state/      Zustand stores 与 React hooks
  ui/         React 组件（编辑器、提词舞台、设置、稿件库）
  i18n/       t() 函数
  locales/    词典
  styles/     CSS 变量与显示模式
e2e/          Playwright 验收测试
docs/         产品与架构文档
scripts/      架构规则与产物体积检查
```

## 文档

- [产品规划](docs/product-plan.md) — 定位、P0/P1/P2 功能与路线图
- [架构设计](docs/architecture.md) — 分层、接口与数据模型
- [模块开发指南](docs/dev/README.md) — 实现顺序与各模块规格
