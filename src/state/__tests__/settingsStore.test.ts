import { describe, it } from 'vitest';

// 规格：docs/dev/modules/state-settings.md
describe('settingsStore', () => {
  it.todo('hydrate 同步读取仓储');
  it.todo('每次修改都夹取范围并同步写仓储');
  it.todo('手动改颜色时 preset 变 custom；applyColorPreset 写入预设色');
  it.todo('D-08：toggleMirror 切换并持久化');
  it.todo('D-08：setPlayback 不接受 speedLevel，只有 persistSpeedLevel 能写');
  it.todo('resetToDefaults 恢复全部默认值（控制器的语速由 UI 随后发 speed.set 同步）');
  it.todo('写入失败时内存状态仍生效');
  it.todo('settingsToCssVars 输出的变量名都在 tokens.css 中定义');
  it.todo('index.html 内联脚本与 settingsToCssVars 的结果一致');
});
