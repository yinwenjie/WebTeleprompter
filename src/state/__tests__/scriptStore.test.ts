import { describe, it } from 'vitest';

// 规格：docs/dev/modules/state-script.md。用内存假仓储和 FakeClock。
describe('scriptStore', () => {
  it.todo('首次 load 预置示例稿并写 seededSample；删光稿件后再次 load 不重新预置');
  it.todo('8-5：load 时存在草稿则恢复草稿，并标记 pending 重新落库');
  it.todo('8-5：load 时合并 wtp.progress.* 到稿件进度，且不改 updatedAt');
  it.todo('D-19：updateDraft 立即更新内存，暂存节流 100ms，500ms 防抖后落库，成功后删除暂存');
  it.todo('D-19：persistOnPageHide 同步写出尚未写入暂存的草稿和播放位置');
  it.todo('连续输入只落库一次，保存的是最新内容');
  it.todo('落库失败时 saveStatus 为 error，暂存不删除，draft 不丢');
  it.todo('D-09：savePlaybackPoint 不改 updatedAt');
  it.todo('切换稿件前先 flush 当前草稿');
  it.todo('删除当前稿件后切到最近更新的稿件；全部删除后 activeScriptId 为 null');
  it.todo('暂存写入失败不影响编辑');
  it.todo('导入：id 冲突走 resolveImportConflicts，损坏文件给出错误且不影响现有数据');
});
