import { useRef } from 'react';
import { messageKeysWithPrefix, t, type MessageKey } from '@/i18n';
import { useDisplay } from '@/state/hooks';
import styles from './Panel.module.css';
import { useDialog } from './useDialog';

const KEY_PREFIX = 'help.key.';

/** 键位说明来自词典的 help.key.* / help.action.*，由单测校验与 DEFAULT_KEYMAP 一致。 */
const rows = messageKeysWithPrefix(KEY_PREFIX).map((keyLabel) => ({
  keyLabel,
  action: `help.action.${keyLabel.slice(KEY_PREFIX.length)}` as MessageKey,
}));

/** 按 ? 弹出的快捷键表（架构 §7.3）。 */
export function ShortcutHelp() {
  const toggleHelp = useDisplay((s) => s.toggleHelp);
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = useDialog(ref, toggleHelp);
  return (
    <>
      <div className={styles.dialogBackdrop} onClick={toggleHelp} />
      <div
        ref={ref}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wtp-help-title"
        onKeyDown={onKeyDown}
        tabIndex={-1}
      >
        <h2 id="wtp-help-title">{t('help.title')}</h2>
        <table>
          <tbody>
            {rows.map(({ keyLabel, action }) => (
              <tr key={keyLabel}>
                <th scope="row" style={{ textAlign: 'left', paddingRight: 16 }}>
                  <kbd>{t(keyLabel)}</kbd>
                </th>
                <td>{t(action)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.hint}>{t('help.gestures')}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={toggleHelp}>
            {t('help.close')}
          </button>
        </div>
      </div>
    </>
  );
}
