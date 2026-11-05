import type { Result } from './result';

export const SCRIPT_SCHEMA_VERSION = 1 as const;

/** 软上限：超出时 UI 提示，存储层不截断（规划 §3.1）。 */
export const MAX_SCRIPT_CHARS = 50_000;

export interface Script {
  id: string; // UUID v4
  title: string;
  content: string; // 纯文本；段落规则见 splitParagraphs
  createdAt: number; // epoch ms
  /** 仅内容或标题变化时更新。保存播放位置不得改动它，否则稿件库的排序会被播放打乱。D-09 */
  updatedAt: number;
  lastPositionPx: number;
  lastProgress: number; // 0..1，跨字号恢复以它为准
  charCount: number; // 冗余，供列表展示
  schemaVersion: typeof SCRIPT_SCHEMA_VERSION;
}

export interface NewScriptInput {
  id: string;
  title: string;
  content: string;
  now: number;
}

/** 非空白字符的码点数，emoji 算一个。 */
export function countChars(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (!/\s/u.test(ch)) count += 1;
  }
  return count;
}

export function createScript(input: NewScriptInput): Script {
  return {
    id: input.id,
    title: input.title,
    content: input.content,
    createdAt: input.now,
    updatedAt: input.now,
    lastPositionPx: 0,
    lastProgress: 0,
    charCount: countChars(input.content),
    schemaVersion: SCRIPT_SCHEMA_VERSION,
  };
}

/** 返回内容更新后的新稿件：同步 charCount 与 updatedAt。 */
export function withContent(script: Script, content: string, now: number): Script {
  return { ...script, content, charCount: countChars(content), updatedAt: now };
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** 校验任意来源的数据（存储、导入文件），缺失字段用默认值补齐。手写校验，不引入 zod。D-14 */
export function validateScript(raw: unknown): Result<Script> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: 'not-an-object' };
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.length === 0) return { ok: false, reason: 'missing-id' };
  if (typeof r.content !== 'string') return { ok: false, reason: 'missing-content' };
  const progress = finiteOr(r.lastProgress, 0);
  return {
    ok: true,
    value: {
      id: r.id,
      title: typeof r.title === 'string' ? r.title : '',
      content: r.content,
      createdAt: finiteOr(r.createdAt, 0),
      updatedAt: finiteOr(r.updatedAt, 0),
      lastPositionPx: Math.max(0, finiteOr(r.lastPositionPx, 0)),
      lastProgress: Math.min(1, Math.max(0, progress)),
      charCount: countChars(r.content),
      schemaVersion: SCRIPT_SCHEMA_VERSION,
    },
  };
}

/**
 * 段落切分规则（D-16）：以空行分段；若全文没有空行但有换行，则每个非空行算一段。
 * UI 渲染、段落跳转、字数统计都复用它，保证段落数量一致。
 */
export function splitParagraphs(content: string): string[] {
  const normalized = content.replace(/\r\n?/g, '\n');
  const blocks = normalized
    .split(/\n(?:[^\S\n]*\n)+/)
    .map((block) => block.replace(/^\n+|\n+$/g, ''))
    .filter((block) => block.trim().length > 0);
  if (blocks.length === 1 && blocks[0]!.includes('\n')) {
    return blocks[0]!.split('\n').filter((line) => line.trim().length > 0);
  }
  return blocks;
}
