import { notImplemented } from '../not-implemented';
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

export function createScript(_input: NewScriptInput): Script {
  return notImplemented('models.createScript');
}

/** 返回内容更新后的新稿件：同步 charCount 与 updatedAt。 */
export function withContent(_script: Script, _content: string, _now: number): Script {
  return notImplemented('models.withContent');
}

/** 校验任意来源的数据（存储、导入文件），缺失字段用默认值补齐。手写校验，不引入 zod。D-14 */
export function validateScript(_raw: unknown): Result<Script> {
  return notImplemented('models.validateScript');
}

/**
 * 段落切分规则（D-16）：以空行分段；若全文没有空行但有换行，则每个非空行算一段。
 * UI 渲染、段落跳转、字数统计都复用它，保证段落数量一致。
 */
export function splitParagraphs(_content: string): string[] {
  return notImplemented('models.splitParagraphs');
}
