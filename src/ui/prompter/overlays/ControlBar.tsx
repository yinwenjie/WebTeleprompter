import type { MouseEvent, ReactNode } from 'react';
import type { PlaybackCommand } from '@/core/playback/commands';
import { t } from '@/i18n';
import { useDispatch, useDisplay, usePlayback, useSettings } from '@/state/hooks';
import styles from './ControlBar.module.css';

/** 点击后不保留焦点，否则点过“返回编辑”后按空格会再次触发它。键盘 Tab 用户不受影响。 */
const keepFocus = (event: MouseEvent) => event.preventDefault();

interface ButtonProps {
  label: string;
  onClick(): void;
  children: ReactNode;
  pressed?: boolean;
  className?: string;
}

function ControlButton({ label, onClick, children, pressed, className }: ButtonProps) {
  return (
    <button
      type="button"
      className={[styles.button, pressed ? styles.pressed : '', className ?? ''].join(' ')}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onMouseDown={keepFocus}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** 播放控制条。在舞台之外，不受镜像影响；每个按钮都发命令（设置面板除外）。 */
export function ControlBar() {
  const dispatch = useDispatch();
  const phase = usePlayback((s) => s.phase);
  const speedLevel = usePlayback((s) => s.speedLevel);
  const visible = useDisplay((s) => s.controlsVisible);
  const fullscreen = useDisplay((s) => s.fullscreenMode !== 'none');
  const setActivePanel = useDisplay((s) => s.setActivePanel);
  const mirrorX = useSettings((s) => s.settings.display.mirrorX);
  const send = (command: PlaybackCommand) => () => dispatch(command);
  const playing = phase === 'playing' || phase === 'countdown';

  return (
    <div
      className={`${styles.bar} ${visible ? '' : styles.hidden}`}
      role="toolbar"
      aria-label={t('prompter.controls')}
      data-controls=""
    >
      <ControlButton
        label={playing ? t('prompter.pause') : t('prompter.play')}
        onClick={send({ type: 'toggle' })}
      >
        {playing ? '❚❚' : '▶'}
      </ControlButton>
      <ControlButton
        label={t('prompter.slower')}
        onClick={send({ type: 'speed.step', delta: -0.5 })}
      >
        −
      </ControlButton>
      <span className={styles.speed} aria-live="polite">
        {t('prompter.speed', { level: speedLevel })}
      </span>
      <ControlButton
        label={t('prompter.faster')}
        onClick={send({ type: 'speed.step', delta: 0.5 })}
      >
        +
      </ControlButton>
      <ControlButton
        label={t('prompter.prevParagraph')}
        onClick={send({ type: 'seek.paragraph', dir: -1 })}
      >
        ⇡
      </ControlButton>
      <ControlButton
        label={t('prompter.nextParagraph')}
        onClick={send({ type: 'seek.paragraph', dir: 1 })}
      >
        ⇣
      </ControlButton>
      <ControlButton label={t('prompter.top')} onClick={send({ type: 'seek.top' })}>
        ⤒
      </ControlButton>
      <ControlButton
        label={fullscreen ? t('prompter.exitFullscreen') : t('prompter.fullscreen')}
        pressed={fullscreen}
        onClick={send({ type: 'display.toggleFullscreen' })}
      >
        ⛶
      </ControlButton>
      <ControlButton
        label={t('prompter.mirror')}
        pressed={mirrorX}
        onClick={send({ type: 'display.toggleMirror', axis: 'x' })}
      >
        ⇋
      </ControlButton>
      <ControlButton label={t('prompter.settings')} onClick={() => setActivePanel('settings')}>
        ⚙
      </ControlButton>
      <ControlButton
        label={t('prompter.backToEdit')}
        className={styles.back}
        onClick={send({ type: 'mode.set', mode: 'edit' })}
      >
        {t('prompter.backToEdit')}
      </ControlButton>
    </div>
  );
}
