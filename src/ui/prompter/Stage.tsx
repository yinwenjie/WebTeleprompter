import { t } from '@/i18n';
import { CountdownOverlay } from './overlays/CountdownOverlay';
import { GuideOverlay } from './overlays/GuideOverlay';
import { ProgressOverlay } from './overlays/ProgressOverlay';
import styles from './Stage.module.css';

/**
 * 提词舞台，也是 ScrollTarget 的唯一实现者（R5）。节点结构是契约，不要改变层级：
 *
 *   stage    手势绑定点、裁剪、背景色
 *   └ mirror 镜像 transform 只在这一层（引导线、进度、倒计时随之翻转）
 *     ├ anchor   top = 阅读线位置，因此 position 0 让首行正好对准阅读线
 *     │ └ content  will-change: transform；引擎每帧只写这个节点的 translate3d
 *     └ overlays
 *
 * TODO(ui-prompter)：渲染段落、经 useStageBridge 注册 ScrollTarget 与手势元素、
 * 用 ResizeObserver 测量并上报 metrics、恢复上次位置。规格见 docs/dev/modules/ui-prompter.md
 */
export function Stage() {
  return (
    <div className={styles.stage}>
      <div className={styles.mirror}>
        <div className={styles.anchor}>
          <div className={styles.content}>{t('prompter.title')}</div>
        </div>
        <GuideOverlay />
        <ProgressOverlay />
        <CountdownOverlay />
      </div>
    </div>
  );
}
