import { t } from '@/i18n';
import { useDispatch } from '@/state/hooks';

/**
 * 骨架占位。TODO(ui-prompter)：播放 / 暂停、调速、跳段、全屏、镜像、设置入口，自动隐藏。
 * 所有操作都发 PlaybackCommand，不直接改状态。
 */
export function ControlBar() {
  const dispatch = useDispatch();
  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16 }}>
      <button type="button" onClick={() => dispatch({ type: 'mode.set', mode: 'edit' })}>
        {t('prompter.backToEdit')}
      </button>
    </div>
  );
}
