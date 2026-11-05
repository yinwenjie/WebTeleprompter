import { describe, it } from 'vitest';

// 规格：docs/dev/modules/core-playback.md
describe('DefaultCommandBus', () => {
  it.todo('无拦截器时转发给 handler 并返回 true');
  it.todo('任一拦截器返回 false 时丢弃命令并返回 false，handler 不被调用');
  it.todo('拦截器按注册顺序执行，遇到 false 即停止');
  it.todo('use 返回的函数能移除拦截器');
  it.todo('8-7 / D-18：createEditModeInterceptor 在编辑态只放行 mode.set 和 speed.set');
  it.todo('isPlaybackCommand 拒绝未知 type、缺失字段和非有限数值');
});
