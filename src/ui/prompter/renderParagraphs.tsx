import type { ReactNode } from 'react';
import type { Script } from '@/core/models/script';
import { splitParagraphs } from '@/core/models/script';

/**
 * 正文渲染的单一入口（架构 §3.5）。P1 的文本格式化只替换这里。
 * 每段渲染为一个带 data-paragraph 属性的 <p>，Stage 据此测量段落偏移。
 */
export function renderParagraphs(script: Pick<Script, 'content'>): ReactNode {
  return splitParagraphs(script.content).map((text, index) => (
    <p key={index} data-paragraph="">
      {text}
    </p>
  ));
}
