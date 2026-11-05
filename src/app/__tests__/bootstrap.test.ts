// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createContainer } from '../bootstrap';

describe('createContainer', () => {
  it('在任何实现进度下都能完成装配和启动', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const container = createContainer(document.documentElement);
    const stop = container.start();
    expect(container.stores.playback.getState().mode).toBe('edit');
    stop();
  });
});
