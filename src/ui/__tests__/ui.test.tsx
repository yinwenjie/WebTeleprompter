// @vitest-environment jsdom
import { describe, it } from 'vitest';

// 规格：docs/dev/modules/ui-*.md。UI 实现者可按模块拆成多个文件。
describe('EditorView', () => {
  it.todo('输入调用 updateDraft；显示字数、预估时长和保存状态');
  it.todo('超过 5 万字符时提示但不截断');
});

describe('Stage', () => {
  it.todo('挂载时 attachStage，卸载时执行返回的回调');
  it.todo('内容变化后上报 metrics，段落偏移数量与段落数一致');
  it.todo('首次上报 metrics 后按 lastProgress 发 seek.progress（只发一次）');
  it.todo('镜像 class 只加在 mirror 节点上');
});

describe('Overlays', () => {
  it.todo('GuideOverlay 按样式渲染，pointer-events 为 none');
  it.todo('已用时间 = positionPx / speed，速度为 0 时显示占位符');
  it.todo('StatusAnnouncer 在倒计时、暂停、结束时写入 aria-live 区域');
  it.todo('ControlBar 的按钮都有 aria-label，并发出正确的命令');
});

describe('SettingsDrawer', () => {
  it.todo('修改即时生效；语速滑杆发 speed.set 而不是写 store');
  it.todo('自定义配色对比度低于 4.5:1 时提示');
});

describe('ScriptLibrary', () => {
  it.todo('删除前二次确认；重命名、切换、新建调用对应 action');
  it.todo('隔离的稿件有提示和导出入口');
});
