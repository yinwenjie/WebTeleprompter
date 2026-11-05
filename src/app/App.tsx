import { lazy, Suspense } from 'react';
import { t } from '@/i18n';
import { StoresProvider, useDisplay, usePlayback, useScripts, type AppStores } from '@/state/hooks';
import { EditorView } from '@/ui/editor/EditorView';
import { PrompterView } from '@/ui/prompter/PrompterView';
import { ErrorBoundary } from '@/ui/shared/ErrorBoundary';
import { ShortcutHelp } from '@/ui/shared/ShortcutHelp';
import { StorageBanner } from '@/ui/shared/StorageBanner';

// 非首屏模块按需拆包（架构 §7.1）。
const SettingsDrawer = lazy(() => import('@/ui/settings/SettingsDrawer'));
const ScriptLibrary = lazy(() => import('@/ui/library/ScriptLibrary'));

function Shell() {
  const mode = usePlayback((state) => state.mode);
  const activePanel = useDisplay((state) => state.activePanel);
  const helpOpen = useDisplay((state) => state.helpOpen);
  const exportBundle = useScripts((state) => state.exportBundle);

  return (
    <ErrorBoundary onExportAll={() => void exportBundle()}>
      <StorageBanner />
      {mode === 'edit' ? <EditorView /> : <PrompterView />}
      <Suspense fallback={null}>
        {activePanel === 'settings' ? <SettingsDrawer /> : null}
        {activePanel === 'library' ? <ScriptLibrary /> : null}
      </Suspense>
      {helpOpen ? <ShortcutHelp /> : null}
    </ErrorBoundary>
  );
}

export function App({ stores }: { stores: AppStores }) {
  return (
    <ErrorBoundary>
      <StoresProvider stores={stores}>
        <Suspense fallback={t('app.loading')}>
          <Shell />
        </Suspense>
      </StoresProvider>
    </ErrorBoundary>
  );
}
