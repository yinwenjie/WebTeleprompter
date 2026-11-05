import { useDeferredValue, useState } from 'react';
import { MAX_SCRIPT_CHARS, countChars } from '@/core/models/script';
import { countReadingUnits, estimateReadingMs } from '@/core/speed-model';
import { t, type MessageKey } from '@/i18n';
import { useDispatch, useDisplay, usePlayback, useScripts, useSettings } from '@/state/hooks';
import type { SaveStatus } from '@/state/scriptStore';
import { formatClock, numberFormat } from '@/ui/shared/format';
import styles from './EditorView.module.css';

const SAVE_STATUS_TEXT: Record<SaveStatus, MessageKey> = {
  idle: 'editor.save.idle',
  pending: 'editor.save.pending',
  saving: 'editor.save.saving',
  saved: 'editor.save.saved',
  error: 'editor.save.error',
};

function TitleInput({ id, title }: { id: string; title: string }) {
  const rename = useScripts((s) => s.rename);
  const [value, setValue] = useState(title);
  const commit = () => {
    const next = value.trim();
    if (next && next !== title) void rename(id, next);
    else setValue(title);
  };
  return (
    <input
      className={styles.title}
      aria-label={t('editor.titleLabel')}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setValue(title);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** 稿件编辑。规格见 docs/dev/modules/ui-editor.md */
export function EditorView() {
  const dispatch = useDispatch();
  const ready = useScripts((s) => s.ready);
  const draft = useScripts((s) => s.draft);
  const activeId = useScripts((s) => s.activeScriptId);
  const title = useScripts((s) => s.scripts.find((x) => x.id === s.activeScriptId)?.title ?? '');
  const saveStatus = useScripts((s) => s.saveStatus);
  const updateDraft = useScripts((s) => s.updateDraft);
  const create = useScripts((s) => s.create);
  const importTextFile = useScripts((s) => s.importTextFile);
  const setActivePanel = useDisplay((s) => s.setActivePanel);
  const speedLevel = usePlayback((s) => s.speedLevel);
  const locale = useSettings((s) => s.settings.locale);

  // 统计放到低优先级渲染，5 万字时不阻塞输入。
  const deferred = useDeferredValue(draft);
  const chars = countChars(deferred);
  const durationMs = estimateReadingMs(countReadingUnits(deferred, locale), speedLevel, locale);
  const overLimit = draft.length > MAX_SCRIPT_CHARS;

  return (
    <main className={styles.editor} aria-label={t('editor.title')}>
      <header className={styles.header}>
        {activeId ? (
          <TitleInput key={`${activeId}:${title}`} id={activeId} title={title} />
        ) : (
          <h1 className={styles.title}>{t('editor.title')}</h1>
        )}
        <button type="button" className={styles.button} onClick={() => setActivePanel('library')}>
          {t('editor.openLibrary')}
        </button>
        <button type="button" className={styles.button} onClick={() => setActivePanel('settings')}>
          {t('editor.openSettings')}
        </button>
      </header>

      {ready && !activeId ? (
        <div className={styles.empty}>
          <p>{t('editor.empty')}</p>
          <button type="button" className={styles.start} onClick={() => void create()}>
            {t('editor.create')}
          </button>
          <button type="button" className={styles.button} onClick={() => void importTextFile()}>
            {t('library.importTxt')}
          </button>
        </div>
      ) : (
        <textarea
          className={styles.textarea}
          aria-label={t('editor.title')}
          placeholder={ready ? t('editor.placeholder') : t('app.loading')}
          value={draft}
          disabled={!ready}
          spellCheck={false}
          onChange={(e) => updateDraft(e.target.value)}
        />
      )}

      {overLimit ? (
        <p className={styles.warning} role="status">
          {t('editor.overLimit')}
        </p>
      ) : null}

      <footer className={styles.footer}>
        <span>{t('editor.chars', { count: numberFormat.format(chars) })}</span>
        <span>{t('editor.duration', { duration: formatClock(durationMs) })}</span>
        <span
          className={`${styles.status} ${saveStatus === 'error' ? styles.statusError : ''}`}
          aria-live="polite"
          data-testid="save-status"
        >
          {t(SAVE_STATUS_TEXT[saveStatus])}
        </span>
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.start}
          disabled={!ready || !activeId}
          onClick={() => dispatch({ type: 'mode.set', mode: 'prompt' })}
        >
          {t('editor.start')}
        </button>
      </footer>
    </main>
  );
}
