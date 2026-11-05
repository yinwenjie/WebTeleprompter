import { expect, test } from '@playwright/test';
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

test('应用能启动并显示编辑界面', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: '稿件编辑' })).toBeVisible();
});

test('完整流程：输入 → 设置 → 全屏提词 → 保存（MVP 验收）', async ({ page }) => {
  await presetSettings(page);
  const text = makeScript(20);
  await openWithScript(page, text);

  // 设置：调字号，打开水平镜像
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('slider', { name: /字号/ }).fill('64');
  await page.getByRole('switch', { name: '水平镜像' }).check();
  await page.getByRole('button', { name: '关闭设置' }).click();

  // 全屏提词
  await enterPrompt(page);
  await page.keyboard.press('f');
  await expect
    .poll(() => page.evaluate(() => window.__WTP_DEBUG__.getDisplayState().fullscreenMode))
    .not.toBe('none');
  await page.keyboard.press(' ');
  await waitForPhase(page, 'playing');
  await expect.poll(async () => (await scroll(page)).positionPx).toBeGreaterThan(5);
  await page.keyboard.press(' ');
  await waitForPhase(page, 'paused');

  // 保存：刷新后稿件和设置都在
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByRole('textbox', { name: '稿件编辑' })).toHaveValue(text);
  const settings = await page.evaluate(() => window.__WTP_DEBUG__.getSettings());
  expect(settings.appearance.fontSizePx).toBe(64);
  expect((await activeScript(page))!.lastProgress).toBeGreaterThan(0);
  expect((await controller(page)).mode).toBe('edit');
});
