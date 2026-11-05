// 依赖规则的回归测试：用一组“必须被拦下 / 必须放行”的样例校验 eslint.config.js。
// lint 规则一旦配错（例如解析器失效）会静默通过，这个脚本防止那种情况。
import { resolve } from 'node:path';
import { ESLint } from 'eslint';

const ROOT = process.cwd();

/** @type {{ file: string; code: string; blocked: boolean; rule: string }[]} */
const CASES = [
  // R1
  {
    rule: 'R1',
    blocked: true,
    file: 'src/core/_probe.ts',
    code: "import '@/platform/raf/RafScheduler';",
  },
  {
    rule: 'R1',
    blocked: true,
    file: 'src/core/_probe.ts',
    code: "import '@/state/playbackStore';",
  },
  { rule: 'R1', blocked: true, file: 'src/core/_probe.ts', code: "import 'react';" },
  { rule: 'R1', blocked: true, file: 'src/core/_probe.ts', code: "import 'zustand/vanilla';" },
  {
    rule: 'R1',
    blocked: false,
    file: 'src/core/_probe.ts',
    code: "import '@/core/models/script';",
  },
  // R2
  {
    rule: 'R2',
    blocked: true,
    file: 'src/platform/_probe.ts',
    code: "import '@/state/playbackStore';",
  },
  {
    rule: 'R2',
    blocked: true,
    file: 'src/platform/_probe.ts',
    code: "import '@/ui/shared/ErrorBoundary';",
  },
  { rule: 'R2', blocked: true, file: 'src/platform/_probe.ts', code: "import 'react';" },
  {
    rule: 'R2',
    blocked: false,
    file: 'src/platform/_probe.ts',
    code: "import '@/core/ports/display';",
  },
  // state
  {
    rule: 'state',
    blocked: true,
    file: 'src/state/_probe.ts',
    code: "import '@/platform/raf/RafScheduler';",
  },
  {
    rule: 'state',
    blocked: true,
    file: 'src/state/_probe.ts',
    code: "import '@/core/scroll-engine/DefaultScrollEngine';",
  },
  {
    rule: 'state',
    blocked: false,
    file: 'src/state/_probe.ts',
    code: "import '@/core/ports/repositories';",
  },
  // R3
  {
    rule: 'R3',
    blocked: true,
    file: 'src/ui/_probe.ts',
    code: "import '@/platform/raf/RafScheduler';",
  },
  {
    rule: 'R3',
    blocked: true,
    file: 'src/ui/_probe.ts',
    code: "import '@/core/scroll-engine/DefaultScrollEngine';",
  },
  {
    rule: 'R3',
    blocked: true,
    file: 'src/ui/_probe.ts',
    code: "import '@/core/playback/DefaultPlaybackController';",
  },
  { rule: 'R3', blocked: true, file: 'src/ui/_probe.ts', code: "import '@/app/bootstrap';" },
  { rule: 'R3', blocked: true, file: 'src/ui/_probe.ts', code: "import 'idb';" },
  { rule: 'R3', blocked: false, file: 'src/ui/_probe.ts', code: "import '@/state/hooks';" },
  { rule: 'R3', blocked: false, file: 'src/ui/_probe.ts', code: "import '@/i18n';" },
  // R4：app 可以 new 具体实现
  {
    rule: 'R4',
    blocked: false,
    file: 'src/app/_probe.ts',
    code: "import '@/core/scroll-engine/DefaultScrollEngine';",
  },
  // R5
  {
    rule: 'R5',
    blocked: true,
    file: 'src/ui/_probe.ts',
    code: 'export const f = (el: HTMLElement) => { el.scrollTop = 1; };',
  },
  {
    rule: 'R5',
    blocked: true,
    file: 'src/ui/_probe.ts',
    code: "export const f = (el: HTMLElement) => { el.style.transform = 'none'; };",
  },
  {
    rule: 'R5',
    blocked: false,
    file: 'src/ui/prompter/Stage.tsx',
    code: "export const f = (el: HTMLElement) => { el.style.transform = 'none'; };",
  },
];

const eslint = new ESLint({ cwd: ROOT });
const ARCH_RULES = new Set([
  'import-x/no-restricted-paths',
  'no-restricted-imports',
  'no-restricted-syntax',
]);

let failures = 0;
for (const { file, code, blocked, rule } of CASES) {
  const [result] = await eslint.lintText(code, { filePath: resolve(ROOT, file) });
  const hit = result.messages.some((message) => ARCH_RULES.has(message.ruleId ?? ''));
  if (hit !== blocked) {
    failures += 1;
    console.error(
      `✗ ${rule} ${file}: ${code}\n  期望${blocked ? '拦截' : '放行'}，实际${hit ? '拦截' : '放行'}`,
    );
  }
}

if (failures > 0) {
  console.error(`${failures}/${CASES.length} 条依赖规则样例不符合预期。`);
  process.exit(1);
}
console.log(`依赖规则样例全部通过（${CASES.length} 条）。`);
