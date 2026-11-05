import { useEffect, useState } from 'react';
import { t, type MessageKey } from '@/i18n';
import { useDisplay } from '@/state/hooks';
import styles from './PrompterView.module.css';

const AUTO_DISMISS_MS = 10_000;

function hasSeen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markSeen(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // 记不住也只是下次再提示一次。
  }
}

function Hint({ storageKey, message }: { storageKey: string; message: MessageKey }) {
  const [open, setOpen] = useState(() => !hasSeen(storageKey));
  useEffect(() => {
    if (!open) return undefined;
    const close = () => {
      markSeen(storageKey);
      setOpen(false);
    };
    const timer = window.setTimeout(close, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [open, storageKey]);
  if (!open) return null;
  return (
    <div className={styles.hint} role="note">
      <span>{t(message)}</span>
      <button
        type="button"
        onClick={() => {
          markSeen(storageKey);
          setOpen(false);
        }}
      >
        {t('prompter.dismiss')}
      </button>
    </div>
  );
}

/** 只显示一次的降级提示：页面内全屏、无法阻止熄屏（R-1）。 */
export function PrompterHints() {
  const fallback = useDisplay((s) => s.fullscreenMode === 'fallback');
  const noWakeLock = useDisplay((s) => s.wakeLock === 'unsupported' || s.wakeLock === 'denied');
  return (
    <div className={styles.hints}>
      {fallback ? (
        <Hint storageKey="wtp.hint.fullscreenFallback" message="prompter.hintFallback" />
      ) : null}
      {noWakeLock ? <Hint storageKey="wtp.hint.wakeLock" message="prompter.hintWakeLock" /> : null}
    </div>
  );
}
