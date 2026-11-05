import type { MouseEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { t } from '@/i18n';
import { useDispatch, useDisplay, usePlayback, useSettings } from '@/state/hooks';
import { formatClock } from '@/ui/shared/format';
import styles from './Overlays.module.css';

/** 进度条与已用 / 剩余时间。唯一允许订阅 scroll 的组件；选择器取整，避免 10Hz 全量重渲染。 */
export function ProgressOverlay() {
  const dispatch = useDispatch();
  const isClean = useDisplay((s) => s.isClean);
  const showInClean = useSettings((s) => s.settings.display.showProgressInClean);
  const mirrorX = useSettings((s) => s.settings.display.mirrorX);
  const { progress, elapsedSec, remainingSec } = usePlayback(
    useShallow((s) => {
      const { positionPx, speedPxPerSec, estimatedRemainingMs } = s.scroll;
      return {
        progress: Math.round(s.scroll.progress * 1000) / 1000,
        // D-21：已用时间由 positionPx / speed 派生。
        elapsedSec: speedPxPerSec > 0 ? Math.floor(positionPx / speedPxPerSec) : null,
        remainingSec: estimatedRemainingMs === null ? null : Math.ceil(estimatedRemainingMs / 1000),
      };
    }),
  );

  if (isClean && !showInClean) return null;

  const seekTo = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    dispatch({ type: 'seek.progress', progress: mirrorX ? 1 - ratio : ratio });
  };

  return (
    <>
      {isClean ? null : (
        <div className={styles.times} data-times="">
          <span>
            {t('prompter.elapsed', {
              time: formatClock(elapsedSec === null ? null : elapsedSec * 1000),
            })}
          </span>
          <span>
            {t('prompter.remaining', {
              time: formatClock(remainingSec === null ? null : remainingSec * 1000),
            })}
          </span>
        </div>
      )}
      <div
        className={`${styles.progress} ${isClean ? styles.thin : ''}`}
        role="progressbar"
        aria-label={t('prompter.progress')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onClick={seekTo}
      >
        <div className={styles.track}>
          <div className={styles.bar} style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
    </>
  );
}
