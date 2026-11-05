/** 定时能力端口：core 不能直接用 setTimeout（倒计时、拖拽恢复延迟都经由它）。D-05 */
export interface Clock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(handle: number): void;
}

export type IdGenerator = () => string;
