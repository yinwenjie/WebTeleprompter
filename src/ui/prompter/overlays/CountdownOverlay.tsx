import { usePlayback } from '@/state/hooks';
import styles from './Overlays.module.css';

/** 屏幕中央的大号倒计时数字，放在 mirror 内，反射式提词器上也能读。 */
export function CountdownOverlay() {
  const seconds = usePlayback((s) =>
    s.phase === 'countdown' ? Math.ceil(s.countdownRemainingMs / 1000) : null,
  );
  if (seconds === null) return null;
  return (
    <div className={styles.countdown} data-countdown="" aria-hidden="true">
      {seconds}
    </div>
  );
}
