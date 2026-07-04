import { Button, Text } from '@repo/ui';
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
          <S.ErrorIcon>⚠️</S.ErrorIcon>
          <S.TitleWrapper>
            <Text variant="h2" weight="semibold" color="text.primary" align="center">
              {t('errorBoundary.title')}
            </Text>
          </S.TitleWrapper>
          <S.MessageWrapper>
            <Text variant="body" color="text.secondary" align="center">
              {t('errorBoundary.message')}
            </Text>
          </S.MessageWrapper>

          <S.ButtonGroup>
            <Button variant="primary" onClick={this.handleReload}>
              <Text>{t('errorBoundary.reload')}</Text>
            </Button>
            <Button variant="secondary" onClick={this.handleGoHome}>
              <Text>{t('errorBoundary.goHome')}</Text>
            </Button>
          </S.ButtonGroup>

          {import.meta.env.MODE === 'development' && this.state.error && (
            <S.Details>
              <S.Summary>{t('errorBoundary.details')}</S.Summary>
              <S.ErrorStack>
                <strong>Error:</strong> {this.state.error.toString()}
                {'\n\n'}
                <strong>Stack:</strong>
                {'\n'}
                {this.state.errorInfo?.componentStack}
              </S.ErrorStack>
            </S.Details>
          )}
        </S.Container>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryComponent);
