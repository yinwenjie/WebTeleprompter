import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Script } from '@/core/models/script';
import { t } from '@/i18n';
import { useDisplay, useScripts } from '@/state/hooks';
import { numberFormat } from '@/ui/shared/format';
import panel from '@/ui/shared/Panel.module.css';
import { useDialog } from '@/ui/shared/useDialog';
import styles from './ScriptLibrary.module.css';

const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

function ConfirmDelete({
  script,
  onCancel,
  onConfirm,
}: {
  script: Script;
  onCancel(): void;
  onConfirm(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = useDialog(ref, onCancel);
  return (
    <>
      <div className={panel.dialogBackdrop} onClick={onCancel} />
      <div
        ref={ref}
        className={panel.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="wtp-confirm-title"
        aria-describedby="wtp-confirm-desc"
        onKeyDown={onKeyDown}
      >
        <h2 id="wtp-confirm-title">{t('library.confirmTitle')}</h2>
        <p id="wtp-confirm-desc">
          {t('library.confirmDelete', { title: script.title || t('script.untitled') })}
        </p>
        <div className={panel.actions}>
          <button type="button" className={panel.button} onClick={onCancel}>
            {t('library.cancel')}
          </button>
          <button type="button" className={`${panel.button} ${panel.primary}`} onClick={onConfirm}>
            {t('library.confirm')}
          </button>
        </div>
      </div>
    </>
  );
}

function RenameInput({ script, onDone }: { script: Script; onDone(): void }) {
  const rename = useScripts((s) => s.rename);
  const [value, setValue] = useState(script.title);
  const commit = () => {
    const next = value.trim();
    if (next && next !== script.title) void rename(script.id, next);
    onDone();
  };
  return (
    <input
      className={styles.rename}
      aria-label={t('library.renameLabel')}
      value={value}
      autoFocus
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          e.stopPropagation();
          onDone();
        }
      }}
    />
  );
}

/** 稿件库。动态加载。规格见 docs/dev/modules/ui-library.md */
export default function ScriptLibrary() {
  const scripts = useScripts((s) => s.scripts);
  const activeId = useScripts((s) => s.activeScriptId);
  const quarantinedCount = useScripts((s) => s.quarantinedCount);
  const actions = useScripts(
    useShallow((s) => ({
      setActive: s.setActive,
      create: s.create,
      remove: s.remove,
      importTextFile: s.importTextFile,
      exportTextFile: s.exportTextFile,
      exportBundle: s.exportBundle,
      importBundle: s.importBundle,
      exportQuarantined: s.exportQuarantined,
    })),
  );
  const setActivePanel = useDisplay((s) => s.setActivePanel);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Script | null>(null);
  const [importFailed, setImportFailed] = useState(false);
  const close = () => setActivePanel('none');
  const ref = useRef<HTMLElement>(null);
  const onKeyDown = useDialog(ref, () => {
    if (!confirming && !renamingId) close();
  });

  const restore = () => {
    setImportFailed(false);
    // 文件选择框必须在点击事件内同步弹出，所以不能在调用前 await。
    actions.importBundle().catch(() => setImportFailed(true));
  };

  return (
    <>
      <div className={panel.backdrop} onClick={close} />
      <aside
        ref={ref}
        className={panel.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={t('library.title')}
        onKeyDown={onKeyDown}
      >
        <div className={panel.header}>
          <h2>{t('library.title')}</h2>
          <button
            type="button"
            className={panel.iconButton}
            aria-label={t('library.close')}
            onClick={close}
          >
            ×
          </button>
        </div>
        <div className={panel.body}>
          <div className={panel.row}>
            <button
              type="button"
              className={`${panel.button} ${panel.primary}`}
              onClick={() => {
                void actions.create();
                close();
              }}
            >
              {t('library.new')}
            </button>
            <button
              type="button"
              className={panel.button}
              onClick={() => void actions.importTextFile()}
            >
              {t('library.importTxt')}
            </button>
          </div>

          {/* 备份放在显眼位置：Safari 7 天清除的最后防线（R-3）。 */}
          <p className={panel.hint}>{t('library.backupHint')}</p>
          <div className={panel.row}>
            <button
              type="button"
              className={panel.button}
              onClick={() => void actions.exportBundle()}
            >
              {t('library.backup')}
            </button>
            <button type="button" className={panel.button} onClick={restore}>
              {t('library.restore')}
            </button>
          </div>
          {importFailed ? (
            <p className={`${panel.warning} ${styles.error}`} role="alert">
              {t('library.importError')}
            </p>
          ) : null}

          {quarantinedCount > 0 ? (
            <div className={panel.warning} role="note">
              <p style={{ margin: '0 0 8px' }}>
                {t('library.quarantined', { count: quarantinedCount })}
              </p>
              <button
                type="button"
                className={panel.button}
                onClick={() => void actions.exportQuarantined()}
              >
                {t('library.exportQuarantined')}
              </button>
            </div>
          ) : null}

          {scripts.length === 0 ? <p className={panel.hint}>{t('library.empty')}</p> : null}
          <ul className={styles.list}>
            {scripts.map((script) => (
              <li key={script.id} className={styles.item}>
                {renamingId === script.id ? (
                  <RenameInput script={script} onDone={() => setRenamingId(null)} />
                ) : (
                  <button
                    type="button"
                    className={styles.open}
                    aria-current={script.id === activeId ? 'true' : undefined}
                    onClick={() => {
                      void actions.setActive(script.id);
                      close();
                    }}
                  >
                    <span className={styles.name}>
                      {script.title || t('script.untitled')}
                      {script.id === activeId ? (
                        <span className={styles.badge}>{t('library.current')}</span>
                      ) : null}
                    </span>
                    <span className={styles.meta}>
                      {t('library.chars', { count: numberFormat.format(script.charCount) })} ·{' '}
                      {t('library.updated', { time: dateFormat.format(script.updatedAt) })}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className={`${panel.button} ${styles.small}`}
                  aria-label={`${t('library.rename')} ${script.title}`}
                  onClick={() => setRenamingId(script.id)}
                >
                  {t('library.rename')}
                </button>
                <button
                  type="button"
                  className={`${panel.button} ${styles.small}`}
                  aria-label={`${t('library.exportTxt')} ${script.title}`}
                  onClick={() => void actions.exportTextFile(script.id)}
                >
                  .txt
                </button>
                <button
                  type="button"
                  className={`${panel.button} ${styles.small} ${panel.danger}`}
                  aria-label={`${t('library.delete')} ${script.title}`}
                  onClick={() => setConfirming(script)}
                >
                  {t('library.delete')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      {confirming ? (
        <ConfirmDelete
          script={confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            void actions.remove(confirming.id);
            setConfirming(null);
          }}
        />
      ) : null}
    </>
  );
}
