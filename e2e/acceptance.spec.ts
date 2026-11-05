import { test } from '@playwright/test';

/**
 * 架构 §8 验收标准中需要真实浏览器的条目。规格见 docs/dev/modules/quality-e2e.md。
 * 经 window.__WTP_DEBUG__ 读取引擎状态。实现后把 test.fixme 改为 test。
 */
test.fixme('8-3 切换镜像 / 全屏 / 纯净不改变 progress 和速度', async () => {});
test.fixme('8-4 5 万字稿件以 5 档滚动 ≥ 55fps（P95，Chromium 4× CPU 节流）', async () => {});
test.fixme('8-5 编辑后 600ms 刷新，稿件、设置、进度完整恢复（误差 < 2%）', async () => {});
test.fixme('8-6 字号 40 → 80，剩余时间变化 < 5%', async () => {});
test.fixme('8-7 编辑态空格不触发播放；提词态空格不滚动页面', async () => {});
test.fixme('8-8 拖拽松手 300ms 后恢复播放，拖拽期间无位置回跳', async () => {});
test.fixme('8-9 IndexedDB 被禁用时仍可编辑、提词、导出', async () => {});
test.fixme('8-10 首屏 TTI < 1.5s（Lighthouse 移动模拟）', async () => {});
test.fixme('8-11 后台 30s 回前台不跳跃', async () => {});
test.fixme('D-01 从稿件库进入提词后恢复到上次位置', async () => {});
test.fixme('D-03 进入全屏且宽度变化时，阅读线处的文字基本不变', async () => {});
test.fixme('D-09 播放后直接关闭页面，再次打开进度仍在', async () => {});
