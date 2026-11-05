import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { t } from '@/i18n';
import { useDispatch, usePlayback, useScripts, useSettings, useStageBridge } from '@/state/hooks';
import { CountdownOverlay } from './overlays/CountdownOverlay';
import { GuideOverlay } from './overlays/GuideOverlay';
import { ProgressOverlay } from './overlays/ProgressOverlay';
import { renderParagraphs } from './renderParagraphs';
import styles from './Stage.module.css';

/** 看完一遍的稿件打开时从头开始，而不是停在文末。 */
const RESTART_PROGRESS = 0.999;

/**
 * 提词舞台，也是 ScrollTarget 的唯一实现者（R5）。节点结构是契约，不要改变层级：
 *
 *   stage    手势绑定点、裁剪、背景色
 *   └ mirror 镜像 transform 只在这一层（引导线、进度、倒计时随之翻转）
 *     ├ anchor   top = 阅读线位置，因此 position 0 让首行正好对准阅读线
 *     │ └ content  will-change: transform；引擎每帧只写这个节点的 translate3d
 *     └ overlays
 *
 * 本组件和段落绝不订阅 scroll，滚动路径上没有 React 渲染。
 */
export function Stage() {
  const bridge = useStageBridge();
  const dispatch = useDispatch();
  const draft = useScripts((s) => s.draft);
  const activeScriptId = useScripts((s) => s.activeScriptId);
  const lastProgress = useScripts(
    (s) => s.scripts.find((script) => script.id === s.activeScriptId)?.lastProgress ?? 0,
  );
  const mirrorX = useSettings((s) => s.settings.display.mirrorX);
  const mirrorY = useSettings((s) => s.settings.display.mirrorY);
  const phase = usePlayback((s) => s.phase);

  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const restoredScriptRef = useRef<string | null>(null);
  const lastProgressRef = useRef(lastProgress);
  useLayoutEffect(() => {
    lastProgressRef.current = lastProgress;
  }, [lastProgress]);

  const paragraphs = useMemo(() => renderParagraphs({ content: draft }), [draft]);

  useLayoutEffect(() => {
    const element = stageRef.current;
    const content = contentRef.current;
    if (!element || !content) return undefined;
    return bridge.attachStage({
      element,
      target: {
        apply: (y) => {
          content.style.transform = `translate3d(0, ${-y}px, 0)`;
        },
      },
    });
  }, [bridge]);

  // 每次内容或稿件变化都重新 observe：ResizeObserver 在 observe 时必定回调一次，
  // 这样即使新内容高度恰好相同，也会重新测量段落偏移。只在回调里读布局。
  useEffect(() => {
    const stage = stageRef.current;
    const content = contentRef.current;
    if (!stage || !content || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const offsets = Array.from(
        content.querySelectorAll<HTMLElement>('[data-paragraph]'),
        (p) => p.offsetTop,
      );
      const contentHeightPx = content.offsetHeight;
      bridge.reportMetrics({
        contentHeightPx,
        viewportHeightPx: stage.clientHeight,
        paragraphOffsetsPx: offsets,
      });
      // D-01：每份稿件只在首次测量后恢复一次，之后改字号不再跳回去。
      if (activeScriptId && restoredScriptRef.current !== activeScriptId && contentHeightPx > 0) {
        restoredScriptRef.current = activeScriptId;
        const progress = lastProgressRef.current;
        if (progress >= RESTART_PROGRESS) dispatch({ type: 'seek.top' }, 'system');
        else if (progress > 0) dispatch({ type: 'seek.progress', progress }, 'system');
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [bridge, dispatch, draft, activeScriptId]);

  const mirrorClass = [styles.mirror, mirrorX ? styles.mirrorX : '', mirrorY ? styles.mirrorY : '']
    .filter(Boolean)
    .join(' ');
  const notice =
    phase === 'paused' ? t('prompter.paused') : phase === 'ended' ? t('prompter.ended') : null;
  const isEmpty = draft.trim().length === 0;

  return (
    <div ref={stageRef} className={styles.stage} data-stage="" aria-label={t('prompter.title')}>
      <div className={mirrorClass} data-mirror="">
        <div className={styles.anchor}>
          <div ref={contentRef} className={styles.content} data-content="">
            {paragraphs}
          </div>
        </div>
        {isEmpty ? <p className={styles.empty}>{t('prompter.empty')}</p> : null}
        <GuideOverlay />
        <ProgressOverlay />
        <CountdownOverlay />
        {notice ? <div className={styles.notice}>{notice}</div> : null}
      </div>
    </div>
  );
}
