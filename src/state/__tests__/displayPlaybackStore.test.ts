import { describe, it } from 'vitest';

// 规格：docs/dev/modules/state-display-playback.md
describe('playbackStore', () => {
  it.todo('connect 后镜像 controller 状态和 engine 的 ScrollState');
  it.todo('dispatch 默认 source 为 button，并返回 bus 的结果');
  it.todo('取消连接后不再更新');
});

describe('displayStore', () => {
  it.todo('toggleFullscreen 同步调用 FullscreenPort.enter（保留用户手势）');
  it.todo('进入全屏时同时进入纯净模式，退出时恢复进入前的纯净状态');
  it.todo('外部退出全屏（系统 Esc）经 setFullscreenMode 同步状态');
  it.todo('noteActivity 显示控件，3 秒无活动后隐藏');
  it.todo('setPromptActive(true) 申请 Wake Lock，false 释放');
});
