import { expect, test } from '@playwright/test';

test('应用能启动并显示编辑界面', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox')).toBeVisible();
});

test.fixme('完整流程：输入 → 设置 → 全屏提词 → 保存（MVP 验收）', async () => {});
