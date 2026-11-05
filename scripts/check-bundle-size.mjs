// 包体门禁（架构验收 8-10）：入口及其静态依赖的 JS，gzip 后必须 < 120KB。
// 动态 import 的 chunk 不计入，因为它们不影响首屏。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMIT_BYTES = 120 * 1024;
const DIST = resolve(process.cwd(), 'dist');

let manifest;
try {
  manifest = JSON.parse(readFileSync(resolve(DIST, '.vite/manifest.json'), 'utf8'));
} catch {
  console.error('找不到 dist/.vite/manifest.json，请先运行 npm run build。');
  process.exit(1);
}

const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
const seen = new Set();
const visit = (key) => {
  if (seen.has(key)) return;
  seen.add(key);
  (manifest[key].imports ?? []).forEach(visit);
};
entries.forEach(visit);

let total = 0;
for (const key of seen) {
  const size = gzipSync(readFileSync(resolve(DIST, manifest[key].file))).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(8)} KB  ${manifest[key].file}`);
}
console.log(
  `${(total / 1024).toFixed(1).padStart(8)} KB  首屏合计（上限 ${LIMIT_BYTES / 1024} KB）`,
);

if (total >= LIMIT_BYTES) {
  console.error('超出首屏包体上限。');
  process.exit(1);
}
