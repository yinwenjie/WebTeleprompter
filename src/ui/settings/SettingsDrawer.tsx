import { t } from '@/i18n';

/** 动态加载。TODO(ui-settings)：外观、显示、行为设置，调整即时预览。规格见 docs/dev/modules/ui-settings.md */
export default function SettingsDrawer() {
  return <aside aria-label={t('settings.title')} />;
}
