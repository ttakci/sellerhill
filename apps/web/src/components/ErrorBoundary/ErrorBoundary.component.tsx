import { EmptyState } from '@repo/ui';
import { Component, ErrorInfo, ReactNode } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';

import * as S from './ErrorBoundary.style';

interface ErrorBoundaryProps extends WithTranslation {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and handle React errors
 * Provides a fallback UI when an error occurs
 */
class ErrorBoundaryComponent extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // TODO: Send error to monitoring service (e.g., Sentry)
    // logger.error('React Error Boundary', { error, errorInfo });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { t } = this.props;

    if (this.state.hasError) {
      return (
        <S.Container>
          <S.Panel variant="elevated" padding="lg">
            {/* Same EmptyState molecule every other failure/empty screen uses —
                this was an emoji glyph over hand-margined text. `triangle-info`
                is the app's canonical error glyph (Dialog / Toast / MessageModal /
                ValidationMessage all use it); `alert-triangle` is the warning
                glyph, so a crash rendered with the wrong severity mark. */}
            <EmptyState
              icon="triangle-info"
              iconTone="error"
              title={t('errorBoundary.title')}
              description={t('errorBoundary.message')}
              action={t('errorBoundary.reload')}
              onAction={this.handleReload}
              secondaryAction={t('errorBoundary.goHome')}
              onSecondaryAction={this.handleGoHome}
              size="lg"
            />

            {import.meta.env.MODE === 'development' && this.state.error && (
              <S.Details>
                <S.Summary>{t('errorBoundary.details')}</S.Summary>
                <S.ErrorStack variant="mono" color="semantic.error">
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.errorInfo?.componentStack}
                </S.ErrorStack>
              </S.Details>
            )}
          </S.Panel>
        </S.Container>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryComponent);
