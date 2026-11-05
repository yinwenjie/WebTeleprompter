import { useSettings } from '@/state/hooks';
import styles from './Overlays.module.css';

/** 阅读引导线（line / band / mask），pointer-events: none。 */
export function GuideOverlay() {
  const style = useSettings((s) => s.settings.display.guide.style);
  return (
    <div className={styles.guide} data-guide={style} aria-hidden="true">
      {style === 'line' ? <div className={styles.line} /> : null}
      {style === 'band' ? <div className={styles.band} /> : null}
      {style === 'mask' ? (
        <>
          <div className={styles.maskAbove} />
          <div className={styles.maskBelow} />
        </>
      ) : null}
    </div>
  );
}
