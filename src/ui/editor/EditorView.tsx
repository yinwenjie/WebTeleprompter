import { t } from '@/i18n';
import { useDispatch } from '@/state/hooks';
import styles from './EditorView.module.css';

/**
 * 骨架占位。TODO(ui-editor)：textarea、字数与预估时长、保存状态、超长提示。
 * 规格见 docs/dev/modules/ui-editor.md
 */
export function EditorView() {
  const dispatch = useDispatch();
  return (
    <main className={styles.editor}>
      <h1>{t('editor.title')}</h1>
      <textarea className={styles.textarea} placeholder={t('editor.placeholder')} />
      <button type="button" onClick={() => dispatch({ type: 'mode.set', mode: 'prompt' })}>
        {t('editor.start')}
      </button>
    </main>
  );
}
