import js from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * 依赖方向规则（架构 §3.3 R1–R5 + docs/architecture-review.md 的修订）。
 * scripts/check-arch-rules.mjs 用反例回归这些规则，修改本文件后请运行 `npm run lint:arch`。
 */

// 只有 app/bootstrap 可以 import 的具体实现（R3、R4）。
const CORE_IMPLEMENTATIONS = [
  './src/core/scroll-engine/DefaultScrollEngine.ts',
  './src/core/playback/DefaultPlaybackController.ts',
  './src/core/playback/DefaultCommandBus.ts',
];

const layerZones = [
  // R1：core 不依赖任何上层
  {
    target: './src/core',
    from: ['./src/platform', './src/state', './src/ui', './src/app', './src/i18n'],
    message: 'R1：core 只能依赖标准库，能力通过 core/ports 注入。',
  },
  // R2：platform 只依赖 core 的接口与类型
  {
    target: './src/platform',
    from: ['./src/state', './src/ui', './src/app', './src/i18n'],
    message: 'R2：platform 不得依赖 state / ui，需要的数据由 bootstrap 以函数形式注入。',
  },
  // state 经 core/ports 使用 platform 能力
  {
    target: './src/state',
    from: ['./src/platform', './src/ui', './src/app', ...CORE_IMPLEMENTATIONS],
    message: 'state 只能依赖 core 的接口；具体实现由 app/bootstrap 注入（R4）。',
  },
  // R3：ui 只经 state 的 hooks 访问数据与 dispatch
  {
    target: './src/ui',
    from: ['./src/platform', './src/app', ...CORE_IMPLEMENTATIONS],
    message: 'R3：ui 只能通过 state 的 hooks 访问数据与 dispatch。',
  },
  // i18n 是叶子层
  {
    target: './src/i18n',
    from: ['./src/core', './src/platform', './src/state', './src/ui', './src/app'],
    message: 'i18n 是叶子层，不依赖任何业务模块。',
  },
];

const FORBIDDEN_IN_CORE = {
  patterns: [
    {
      group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'zustand', 'zustand/*', 'idb'],
      message: 'R1：core 不得依赖 UI 框架、状态库或存储库。',
    },
  ],
};

const FORBIDDEN_IN_PLATFORM = {
  patterns: [
    {
      group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'zustand', 'zustand/*'],
      message: 'R2：platform 不得依赖 UI 框架或状态库。',
    },
  ],
};

const FORBIDDEN_IN_UI = {
  patterns: [{ group: ['idb'], message: 'R3：ui 不得直接访问存储。' }],
};

// R5：滚动位置相关 DOM 样式的唯一写者是 Stage 的 ScrollTarget 实现。
const SCROLL_WRITE_SELECTORS = [
  {
    selector: "AssignmentExpression[left.property.name='scrollTop']",
    message: 'R5：不得写 scrollTop，滚动位置只由 ScrollEngine → ScrollTarget 写入。',
  },
  {
    selector:
      "AssignmentExpression[left.object.property.name='style'][left.property.name='transform']",
    message: 'R5：不得直接写 style.transform，唯一例外是 ui/prompter/Stage.tsx。',
  },
];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'import-x': importX, 'react-hooks': reactHooks },
    languageOptions: { parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: './tsconfig.json' })],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'import-x/no-restricted-paths': ['error', { zones: layerZones }],
      'no-restricted-syntax': ['error', ...SCROLL_WRITE_SELECTORS],
    },
  },
  { files: ['src/core/**/*.ts'], rules: { 'no-restricted-imports': ['error', FORBIDDEN_IN_CORE] } },
  {
    files: ['src/platform/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', FORBIDDEN_IN_PLATFORM] },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', FORBIDDEN_IN_UI] },
  },
  // R5 的唯一例外
  { files: ['src/ui/prompter/Stage.tsx'], rules: { 'no-restricted-syntax': 'off' } },
);
