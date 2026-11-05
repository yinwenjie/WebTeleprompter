/**
 * 骨架占位。模块实现时删除对 notImplemented 的调用；当全仓库不再引用它时，连同本文件一起删除。
 * app/bootstrap 的 runStep 会捕获这个错误并在控制台列出尚未实现的模块，让骨架阶段的应用也能启动。
 */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`尚未实现：${what}`);
    this.name = 'NotImplementedError';
  }
}

export function notImplemented(what: string): never {
  throw new NotImplementedError(what);
}
