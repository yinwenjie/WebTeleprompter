# platform-remote：远程控制（P1 预留）

**拥有文件**：`src/platform/remote/RemoteTransport.ts`

**P0 不实现任何东西。** 这里只保留接口，文档用于说明 P1 怎样接入，防止 P0 的实现把这条路堵死。

## P0 需要保证的事

这些已由其他模块承担，实现时不要破坏：

- 所有命令可 JSON 序列化（`commands.ts`）。
- `CommandSource` 含 `'remote'`。
- `isPlaybackCommand` 能校验不可信数据（core-playback）。
- 新增输入源不需要修改 `core`。

## 验证扩展点（架构 8-2）

在临时分支写一个 `BroadcastChannel` 版 `RemoteTransport`，验证只增加 platform 文件和 bootstrap 接线就能控制播放，不改 core（修订见 review 第 5 节）。**验证后不合并。**

## P1 接入方式

```ts
// app/bootstrap.ts
const transport = new XxxTransport();
transport.onMessage((message) => {
  if (isRemoteCommandMessage(message)) bus.dispatch(message.cmd, 'remote');
});
controller.subscribe(() =>
  transport.send({ kind: 'state', state: engine.getState(), phase: controller.getState().phase }),
);
```

注意：

- 由 bootstrap 接线。`RemoteTransport` 不能订阅 store（R2）。
- `onMessage` 收到的是 `unknown`，必须经 `isPlaybackCommand` 校验。
- 命令不幂等（D-12）。如果传输层可能重传，需要在消息上加序列号去重。
- 只读状态回传要节流，引擎已经是 10Hz。
- 信令方案见架构 Q5，P1 启动时决定。
