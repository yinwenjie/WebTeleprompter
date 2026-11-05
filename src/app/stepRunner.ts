import { NotImplementedError } from '@/core/not-implemented';

/**
 * 骨架期的启动容错：单个模块未实现时记录下来继续启动，让应用在任何实现进度下都能打开。
 * 其他错误照常抛出。全部模块完成后删除本文件，并把 runStep 调用改为直接调用。
 */
export function createStepRunner() {
  const unimplemented: string[] = [];
  const cleanups: (() => void)[] = [];

  return {
    unimplemented,
    run(name: string, step: () => void | (() => void)): void {
      try {
        const cleanup = step();
        if (cleanup) cleanups.push(cleanup);
      } catch (error) {
        if (!(error instanceof NotImplementedError)) throw error;
        unimplemented.push(name);
      }
    },
    disposeAll(): void {
      while (cleanups.length > 0) cleanups.pop()?.();
    },
  };
}
