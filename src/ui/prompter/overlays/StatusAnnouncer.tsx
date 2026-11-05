import { t } from '@/i18n';
import { usePlayback } from '@/state/hooks';

/** aria-live 区域，播报倒计时、已暂停、已结束（架构 §7.3）。 */
export function StatusAnnouncer() {
  const message = usePlayback((s) => {
    switch (s.phase) {
      case 'countdown':
        return t('prompter.countdownAnnounce', { count: Math.ceil(s.countdownRemainingMs / 1000) });
      case 'playing':
        return t('prompter.playing');
      case 'paused':
        return t('prompter.paused');
      case 'ended':
        return t('prompter.ended');
      default:
        return '';
    }
  });
  return (
    <div className="visually-hidden" role="status" aria-live="polite" data-testid="status">
      {message}
    </div>
  );
}
