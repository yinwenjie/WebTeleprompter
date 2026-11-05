import type { Page } from '@playwright/test';

export interface DebugScrollState {
  positionPx: number;
  speedPxPerSec: number;
  running: boolean;
  atEnd: boolean;
  progress: number;
  estimatedRemainingMs: number | null;
}

export interface DebugApi {
  getScrollState(): DebugScrollState;
  getControllerState(): { mode: 'edit' | 'prompt'; phase: string; speedLevel: number };
  getMetrics(): { contentHeightPx: number; viewportHeightPx: number; paragraphOffsetsPx: number[] };
  getActiveScript(): {
    id: string;
    content: string;
    draft: string;
    lastProgress: number;
    saveStatus: string;
  } | null;
  getSettings(): { appearance: { fontSizePx: number } };
  getDisplayState(): { fullscreenMode: string; isClean: boolean };
}

declare global {
  interface Window {
    __WTP_DEBUG__: DebugApi;
  }
}

export const scroll = (page: Page) => page.evaluate(() => window.__WTP_DEBUG__.getScrollState());
export const controller = (page: Page) =>
  page.evaluate(() => window.__WTP_DEBUG__.getControllerState());
export const activeScript = (page: Page) =>
  page.evaluate(() => window.__WTP_DEBUG__.getActiveScript());

/** 首次打开前写入设置（倒计时 0 秒等），之后的刷新保留页面里改过的设置。 */
export async function presetSettings(
  page: Page,
  patch: { countdownSec?: number; fontSizePx?: number } = {},
) {
  await page.addInitScript((p) => {
    if (sessionStorage.getItem('e2e.seeded')) return;
    sessionStorage.setItem('e2e.seeded', '1');
    const settings = {
      schemaVersion: 1,
      appearance: {
        fontSizePx: p.fontSizePx ?? 48,
        lineHeight: 1.5,
        fontFamily: 'sans',
        fgColor: '#ffe600',
        bgColor: '#000000',
        preset: 'black-yellow',
        paddingXPercent: 8,
      },
      display: {
        mirrorX: false,
        mirrorY: false,
        guide: { style: 'band', positionPercent: 33, opacity: 0.4 },
        showProgressInClean: true,
      },
      playback: { speedLevel: 3, countdownSec: p.countdownSec ?? 0, resumeDelayMs: 300 },
      locale: 'zh-CN',
    };
    localStorage.setItem('wtp.settings', JSON.stringify(settings));
  }, patch);
}

export function makeScript(
  paragraphs: number,
  sentence = '这是一段用于自动化测试的提词稿件内容，',
): string {
  return Array.from({ length: paragraphs }, (_, i) => `第${i + 1}段。${sentence.repeat(3)}`).join(
    '\n\n',
  );
}

export async function openWithScript(page: Page, text: string) {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: '稿件编辑' });
  await editor.waitFor();
  await page.waitForFunction(() => window.__WTP_DEBUG__?.getActiveScript() !== null);
  await editor.fill(text);
  return editor;
}

export async function enterPrompt(page: Page) {
  await page.getByRole('button', { name: '开始提词' }).click();
  await page.waitForFunction(() => window.__WTP_DEBUG__.getMetrics().contentHeightPx > 0);
}

export async function waitForPhase(page: Page, phase: string) {
  await page.waitForFunction((p) => window.__WTP_DEBUG__.getControllerState().phase === p, phase);
}
