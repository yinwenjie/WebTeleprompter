import { t } from '@/i18n';
import { useDisplay, usePlayback, useScripts } from '@/state/hooks';

const style = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 12,
  padding: '8px 16px',
  background: '#ffb340',
  color: '#1c1c1e',
  fontSize: 14,
  position: 'relative',
  zIndex: 12,
} as const;

/**
 * 存储降级或写入失败时的常驻提示，附导出按钮。不在动态分包内，出错时也一定能加载。
 * 不遮挡提词舞台：提词 + 纯净模式下隐藏。
 */
export function StorageBanner() {
  const degraded = useScripts((s) => s.storageDegraded);
  const saveError = useScripts((s) => s.saveStatus === 'error');
  const quota = useScripts((s) => s.lastErrorKind === 'quota');
  const exportBundle = useScripts((s) => s.exportBundle);
  const prompting = usePlayback((s) => s.mode === 'prompt');
  const clean = useDisplay((s) => s.isClean);

  if (!degraded && !saveError) return null;
  if (prompting && clean) return null;

  const message = degraded
    ? t('storage.degraded')
    : quota
      ? t('storage.quota')
      : t('storage.saveFailed');

  return (
    <div
      role="alert"
      style={prompting ? { ...style, position: 'fixed', top: 0, left: 0, right: 0 } : style}
      data-testid="storage-banner"
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button type="button" onClick={() => void exportBundle()}>
        {t('storage.exportBackup')}
      </button>
    </div>
  );
}
