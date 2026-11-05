import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vitest/config';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // 相对路径：同一份产物可部署到 GitHub Pages 子路径、Vercel 或 Cloudflare Pages。
  base: './',
  plugins: [
    react(),
    process.env.ANALYZE
      ? visualizer({ filename: 'dist/stats.html', gzipSize: true, open: false })
      : null,
  ],
  resolve: {
    alias: {
      '@': fromRoot('./src'),
    },
  },
  build: {
    // iOS Safari 15+ 是架构 §1 约定的最低移动端目标。
    target: ['es2020', 'safari15'],
    // scripts/check-bundle-size.mjs 依据 manifest 计算首屏 JS 体积。
    manifest: true,
    sourcemap: true,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    restoreMocks: true,
  },
});
