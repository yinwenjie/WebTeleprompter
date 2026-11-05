import { describe, it } from 'vitest';

// 规格：docs/dev/modules/core-speed-model.md
describe('speedModel', () => {
  it.todo('3 档中文约 200 字/分钟，落在规划 180–220 区间');
  it.todo('档位与单位/分钟成正比');
  it.todo('clampSpeedLevel 夹到 1–10 并吸附到 0.5');
  it.todo('8-6：长段落换行场景，字号 40 → 80（高度 ×4）全文时长不变');
  it.todo('8-6：短行不换行场景，字号 40 → 80（高度 ×2）全文时长不变');
  it.todo('countReadingUnits：中文按字，拉丁文按词，忽略空白与标点，混排相加');
  it.todo('readingUnits 为 0 时 toPxPerSec 返回 0');
  it.todo('estimateRemainingMs 在速度为 0 时返回 null，到达末尾时返回 0');
});
