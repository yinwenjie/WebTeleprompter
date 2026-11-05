import { describe, it } from 'vitest';

// 规格：docs/dev/modules/platform-input.md。用 jsdom 环境和假 CommandBus。
describe('KeyboardInput', () => {
  it.todo('8-7：焦点在 textarea / input / select / contenteditable 时不发命令、不 preventDefault');
  it.todo('8-7：提词态空格发 toggle 并 preventDefault');
  it.todo('D-07：bus 返回 false 时不 preventDefault');
  it.todo('焦点在按钮上时不拦截空格，避免与按钮点击重复触发');
  it.todo('带 Ctrl / Cmd / Alt 的组合键不处理');
  it.todo('方向键长按（event.repeat）可连续调速，其他键忽略 repeat');
  it.todo('字母键不区分大小写');
});

describe('GestureInput', () => {
  it.todo('移动未超过阈值时不发 scrub.begin，单击不影响播放');
  it.todo('D-17：双击发 toggle，不产生 scrub');
  it.todo('拖拽：scrub.begin → seek.px（每帧最多一次）→ scrub.end');
  it.todo('mirrorY 下拖拽方向反向');
  it.todo('滚轮发 nudge.px，mirrorY 下方向反向');
  it.todo('pointercancel 等同松手，必定发 scrub.end');
  it.todo('松手速度超阈值时先走惯性再发 scrub.end');
  it.todo('解绑后不再发命令，并取消排队的帧');
});
