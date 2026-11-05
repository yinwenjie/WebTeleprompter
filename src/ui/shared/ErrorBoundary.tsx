import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '@/i18n';

interface Props {
  children: ReactNode;
  /** 导出全部数据的兜底入口。崩溃时用户最需要的就是把稿件带走。 */
  onExportAll?: () => void;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ padding: 24 }}>
        <h1>{t('error.title')}</h1>
        <p>{t('error.description')}</p>
        {this.props.onExportAll ? (
          <button type="button" onClick={this.props.onExportAll}>
            {t('error.exportAll')}
          </button>
        ) : null}{' '}
        <button type="button" onClick={() => window.location.reload()}>
          {t('error.reload')}
        </button>
      </div>
    );
  }
}
