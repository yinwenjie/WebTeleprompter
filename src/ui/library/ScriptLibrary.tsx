import { t } from '@/i18n';

/** 动态加载。TODO(ui-library)：稿件列表、新建、重命名、删除、导入导出。规格见 docs/dev/modules/ui-library.md */
export default function ScriptLibrary() {
  return <aside aria-label={t('library.title')} />;
}
