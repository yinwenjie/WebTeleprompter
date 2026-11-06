import { expect, test, type Page } from '@playwright/test';
import {
  activeScript,
  controller,
  enterPrompt,
  makeScript,
  openWithScript,
  presetSettings,
  scroll,
  waitForPhase,
} from './helpers';

/**
 * 架构 §8 验收标准中需要真实浏览器的条目。规格见 docs/dev/modules/quality-e2e.md。
 * 经 window.__WTP_DEBUG__ 读取引擎状态。
 */

async function playFor(page: Page, ms: number) {
  await page.keyboard.press(' ');
  await waitForPhase(page, 'playing');
  await page.waitForTimeout(ms);
}

async function setFontSize(page: Page, px: number) {
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('slider', { name: /字号/ }).fill(String(px));
  await page.getByRole('button', { name: '关闭设置' }).click();
}

test.beforeEach(async ({ page }) => {
  await presetSettings(page);
});

test('8-3 切换镜像 / 全屏 / 纯净不改变 progress 和速度', async ({ page }) => {
  await openWithScript(page, makeScript(40));
  await enterPrompt(page);
  await playFor(page, 500);
  for (const key of ['m', 'c', 'f']) {
    const before = await page.evaluate(() => ({
      s: window.__WTP_DEBUG__.getScrollState(),
      t: performance.now(),
    }));
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({
      s: window.__WTP_DEBUG__.getScrollState(),
      t: performance.now(),
    }));
    const metrics = await page.evaluate(() => window.__WTP_DEBUG__.getMetrics());
    const advance = (after.s.speedPxPerSec * (after.t - before.t)) / 1000 / metrics.contentHeightPx;
    const oneFrame = after.s.speedPxPerSec / 60 / metrics.contentHeightPx;
    // 比较 progress 而不是 positionPx（D-03）。允许 3 帧的计时误差。
    expect(Math.abs(after.s.progress - before.s.progress - advance)).toBeLessThanOrEqual(
      oneFrame * 3,
    );
    expect(after.s.running).toBe(true);
    if (key !== 'f') expect(after.s.speedPxPerSec).toBeCloseTo(before.s.speedPxPerSec, 6);
  }
});

const PERF_CASES = [
  { name: '桌面 1920×1080 48px 有段落', width: 1920, height: 1080, font: 48, perSentence: false },
  { name: '桌面 1920×1080 120px 有段落', width: 1920, height: 1080, font: 120, perSentence: false },
  {
    name: '手机 375×812 120px 有段落（最坏）',
    width: 375,
    height: 812,
    font: 120,
    perSentence: false,
  },
  { name: '手机 375×812 48px 每句一段', width: 375, height: 812, font: 48, perSentence: true },
];

function fiftyThousandChars(perSentence: boolean): string {
  const sentence = '提词器滚动性能测试用的中文句子内容。';
  const sentences = Math.ceil(50_000 / sentence.length);
  if (perSentence) return Array.from({ length: sentences }, () => sentence).join('\n');
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences; i += 6) paragraphs.push(sentence.repeat(6));
  return paragraphs.join('\n\n');
}

for (const c of PERF_CASES) {
  test(`8-4 5 万字稿件以 5 档滚动 ≥ 55fps（P95，Chromium 4× CPU 节流）：${c.name}`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'CPU 节流只在 Chromium 的 CDP 中可用');
    // 公共 CI 运行器没有 GPU，还与其他 worker 抢 CPU，单次帧率采样没有参考价值。发版前在本地运行。
    test.skip(Boolean(process.env.CI), '帧率门禁只在本地运行');
    test.setTimeout(120_000);
    await page.setViewportSize({ width: c.width, height: c.height });
    await openWithScript(page, fiftyThousandChars(c.perSentence));
    await setFontSize(page, c.font);
    await enterPrompt(page);
    await page.evaluate(() => {
      for (let i = 0; i < 4; i += 1)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
    });
    expect((await controller(page)).speedLevel).toBe(5);
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await playFor(page, 500);
    const intervals = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const out: number[] = [];
          let last = performance.now();
          const start = last;
          const frame = (now: number) => {
            out.push(now - last);
            last = now;
            if (now - start < 10_000) requestAnimationFrame(frame);
            else resolve(out);
          };
          requestAnimationFrame(frame);
        }),
    );
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const sorted = [...intervals].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
    const fps = 1000 / p95;
    test.info().annotations.push({
      type: 'p95-fps',
      description: `${fps.toFixed(1)} fps（${intervals.length} 帧）`,
    });
    expect((await scroll(page)).running).toBe(true);
    expect(fps).toBeGreaterThanOrEqual(55);
  });
}

test('8-5 编辑后 600ms 刷新，稿件、设置、进度完整恢复（误差 < 2%）', async ({ page }) => {
  const text = makeScript(40);
  await openWithScript(page, text);
  await setFontSize(page, 56);
  await enterPrompt(page);
  await playFor(page, 1500);
  await page.keyboard.press(' ');
  await waitForPhase(page, 'paused');
  const saved = (await scroll(page)).progress;
  expect(saved).toBeGreaterThan(0);
  await page.getByRole('button', { name: '返回编辑' }).click();
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.getByRole('textbox', { name: '稿件编辑' })).toHaveValue(text);
  expect(
    (await page.evaluate(() => window.__WTP_DEBUG__.getSettings())).appearance.fontSizePx,
  ).toBe(56);
  await enterPrompt(page);
  await expect.poll(async () => Math.abs((await scroll(page)).progress - saved)).toBeLessThan(0.02);

  // D-19：输入后 50ms 就刷新，内容也不能丢。
  await page.getByRole('button', { name: '返回编辑' }).click();
  const editor = page.getByRole('textbox', { name: '稿件编辑' });
  await editor.fill(`${text}\n\n刚刚输入的内容`);
  await page.waitForTimeout(50);
  await page.reload();
  await expect(page.getByRole('textbox', { name: '稿件编辑' })).toHaveValue(
    `${text}\n\n刚刚输入的内容`,
  );
});

test('8-6 字号 40 → 80，剩余时间变化 < 5%', async ({ page }) => {
  await openWithScript(page, makeScript(30));
  await setFontSize(page, 40);
  await enterPrompt(page);
  await expect.poll(async () => (await scroll(page)).estimatedRemainingMs).not.toBeNull();
  const before = (await scroll(page)).estimatedRemainingMs!;
  const heightBefore = (await page.evaluate(() => window.__WTP_DEBUG__.getMetrics()))
    .contentHeightPx;
  await page.getByRole('button', { name: '设置' }).click();
  await page.getByRole('slider', { name: /字号/ }).fill('80');
  await expect
    .poll(
      async () => (await page.evaluate(() => window.__WTP_DEBUG__.getMetrics())).contentHeightPx,
    )
    .toBeGreaterThan(heightBefore * 1.5);
  const after = (await scroll(page)).estimatedRemainingMs!;
  expect(Math.abs(after - before) / before).toBeLessThan(0.05);
});

test('8-7 编辑态空格不触发播放；提词态空格不滚动页面', async ({ page }) => {
  const editor = await openWithScript(page, makeScript(30));
  await editor.focus();
  await editor.press('End');
  await editor.press(' ');
  expect((await controller(page)).phase).toBe('idle');
  await expect(editor).toHaveValue(/ $/);
  await enterPrompt(page);
  await page.keyboard.press(' ');
  await expect.poll(async () => (await controller(page)).phase).toMatch(/countdown|playing/);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('8-8 拖拽松手 300ms 后恢复播放，拖拽期间无位置回跳', async ({ page }) => {
  await openWithScript(page, makeScript(60));
  await enterPrompt(page);
  await playFor(page, 300);
  await page.evaluate(() => {
    const w = window as unknown as { __positions: number[] };
    w.__positions = [];
    const loop = () => {
      w.__positions.push(window.__WTP_DEBUG__.getScrollState().positionPx);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  // 按在舞台中部：不能超出手机视口（iPhone 13 宽 390），也不能落在底部的控制条上。
  const viewport = page.viewportSize()!;
  const x = Math.round(viewport.width / 2);
  const startY = Math.round(viewport.height / 2);
  await page.mouse.move(x, startY);
  await page.mouse.down();
  for (let y = startY; y >= startY - 300; y -= 15) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(30);
  }
  // 停住再松手，速度低于惯性阈值。
  await page.waitForTimeout(200);
  expect((await controller(page)).phase).toBe('scrubbing');
  await page.mouse.up();
  const positions = await page.evaluate(
    () => (window as unknown as { __positions: number[] }).__positions,
  );
  for (let i = 1; i < positions.length; i += 1)
    expect(positions[i]!).toBeGreaterThanOrEqual(positions[i - 1]!);
  expect((await controller(page)).phase).toBe('scrubbing');
  await page.waitForTimeout(450);
  expect((await controller(page)).phase).toBe('playing');
});

test('8-9 IndexedDB 被禁用时仍可编辑、提词、导出', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  });
  const text = makeScript(10);
  await openWithScript(page, text);
  await expect(page.getByTestId('storage-banner')).toContainText('本次数据不会长期保存');
  await enterPrompt(page);
  await playFor(page, 400);
  expect((await scroll(page)).positionPx).toBeGreaterThan(0);
  await page.getByRole('button', { name: '返回编辑' }).click();
  const download = page.waitForEvent('download');
  await page.getByTestId('storage-banner').getByRole('button', { name: '导出备份' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^webteleprompter-backup-\d{8}-\d{4}\.json$/);
});

test('8-10 首屏可交互 < 1.5s（Chromium 4× CPU 节流，本地服务近似）', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CPU 节流只在 Chromium 的 CDP 中可用');
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const start = Date.now();
  await page.goto('/');
  await page.getByRole('textbox', { name: '稿件编辑' }).waitFor();
  await page.waitForFunction(() => window.__WTP_DEBUG__?.getActiveScript() !== null);
  const elapsed = Date.now() - start;
  test.info().annotations.push({ type: 'tti-proxy', description: `${elapsed}ms` });
  expect(elapsed).toBeLessThan(1500);
});

test('8-11 后台 30s 回前台不跳跃', async ({ page }) => {
  await openWithScript(page, makeScript(40));
  await enterPrompt(page);
  await playFor(page, 300);
  const setVisibility = (state: 'hidden' | 'visible') =>
    page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVisibility('hidden');
  expect((await controller(page)).phase).toBe('paused');
  const before = await scroll(page);
  await page.clock.install();
  await page.clock.runFor(30_000);
  await setVisibility('visible');
  const after = await scroll(page);
  const maxFrameStep = (before.speedPxPerSec * 100) / 1000;
  expect(Math.abs(after.positionPx - before.positionPx)).toBeLessThanOrEqual(maxFrameStep);
  expect((await controller(page)).phase).toBe('paused');
});

test('D-01 从稿件库进入提词后恢复到上次位置', async ({ page }) => {
  await openWithScript(page, makeScript(40));
  await enterPrompt(page);
  await playFor(page, 1500);
  await page.getByRole('button', { name: '返回编辑' }).click();
  const saved = (await scroll(page)).progress;
  await page.waitForTimeout(600);
  await page.reload();
  await page.getByRole('button', { name: '稿件库' }).click();
  const current = page.locator('[aria-current="true"]');
  await current.click();
  await enterPrompt(page);
  await expect.poll(async () => Math.abs((await scroll(page)).progress - saved)).toBeLessThan(0.02);
});

test('D-03 进入全屏且宽度变化时，阅读线处的文字基本不变', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await openWithScript(page, makeScript(60));
  await enterPrompt(page);
  await page.keyboard.press(' ');
  await waitForPhase(page, 'playing');
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await page.keyboard.press(' ');
  await waitForPhase(page, 'paused');
  const paragraphAtLine = () =>
    page.evaluate(() => {
      const offsets = window.__WTP_DEBUG__.getMetrics().paragraphOffsetsPx;
      const p = window.__WTP_DEBUG__.getScrollState().positionPx;
      let index = 0;
      offsets.forEach((o, i) => {
        if (o <= p + 1) index = i;
      });
      return index;
    });
  const before = { progress: (await scroll(page)).progress, paragraph: await paragraphAtLine() };
  const heightBefore = (await page.evaluate(() => window.__WTP_DEBUG__.getMetrics()))
    .contentHeightPx;
  await page.setViewportSize({ width: 1400, height: 800 });
  // 变宽后重新换行，内容高度必然变小。
  await expect
    .poll(
      async () => (await page.evaluate(() => window.__WTP_DEBUG__.getMetrics())).contentHeightPx,
    )
    .toBeLessThan(heightBefore * 0.8);
  const after = { progress: (await scroll(page)).progress, paragraph: await paragraphAtLine() };
  expect(Math.abs(after.progress - before.progress)).toBeLessThan(0.001);
  expect(Math.abs(after.paragraph - before.paragraph)).toBeLessThanOrEqual(1);
});

test('D-09 播放后直接关闭页面，再次打开进度仍在', async ({ page, context }) => {
  await openWithScript(page, makeScript(40));
  await page.waitForTimeout(700);
  await enterPrompt(page);
  await playFor(page, 1500);
  const progress = (await scroll(page)).progress;
  expect(progress).toBeGreaterThan(0);
  // 不要加 runBeforeUnload：它让 close() 不等页面关闭就返回，新页面会抢在 pagehide 之前打开。
  await page.close();
  const next = await context.newPage();
  await next.goto('/');
  await next.waitForFunction(() => window.__WTP_DEBUG__?.getActiveScript() !== null);
  const restored = (await activeScript(next))!.lastProgress;
  expect(restored).toBeGreaterThanOrEqual(progress - 0.001);
  expect(restored).toBeLessThan(progress + 0.05);
});
