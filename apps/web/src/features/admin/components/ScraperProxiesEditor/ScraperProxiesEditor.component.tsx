import { ProxyVerifyErrorKind, type ProxyVerifyResult } from '@repo/shared';
import { Badge, Button, Icon, IconButton, ModernSelect, ModernTextInput, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ScraperProxiesEditor.style';
import { ProxyRowTestState, ProxyScheme, type ProxyRowTestStatus, type ScraperProxiesEditorComponentProps } from './ScraperProxiesEditor.types';

const SCHEME_OPTIONS = [
  { label: 'http://', value: ProxyScheme.HTTP },
  { label: 'https://', value: ProxyScheme.HTTPS },
  { label: 'socks5://', value: ProxyScheme.SOCKS5 },
  { label: 'socks5h://', value: ProxyScheme.SOCKS5H },
];

function errorKindLabel(t: (key: string) => string, errorKind: ProxyVerifyErrorKind | string | null | undefined): string {
  const key = errorKind ?? ProxyVerifyErrorKind.OTHER;
  return t(`admin.settings.scraperProxies.errorKind.${key}`);
}

function RowStatusBadge({ status }: { status: ProxyRowTestStatus | undefined }): React.ReactElement | null {
  const { t } = useTranslation(['admin']);
  if (!status || status.state === ProxyRowTestState.IDLE) {
    return null;
  }
  if (status.state === ProxyRowTestState.TESTING) {
    return (
      <Badge variant="neutral">
        <Icon name="loader" size={12} />
        {t('admin.settings.scraperProxies.testing')}
      </Badge>
    );
  }
  if (status.state === ProxyRowTestState.OK) {
    return (
      <Badge variant="success">
        <Icon name="check-circle" size={12} />
        {t('admin.settings.scraperProxies.connected')}
      </Badge>
    );
  }
  return (
    <Badge variant="error">
      <Icon name="x-circle" size={12} />
      {errorKindLabel(t, status.errorKind)}
    </Badge>
  );
}

function SavedResultRow({ result }: { result: ProxyVerifyResult }): React.ReactElement {
  const { t } = useTranslation(['admin']);
  return (
    <S.SavedResultRow>
      <Text variant="mono" color="text.secondary">
        {result.id}
      </Text>
      {result.ok ? (
        <Badge variant="success">
          <Icon name="check-circle" size={12} />
          {t('admin.settings.scraperProxies.connected')}
        </Badge>
      ) : (
        <Badge variant="error">
          <Icon name="x-circle" size={12} />
          {errorKindLabel(t, result.errorKind)}
        </Badge>
      )}
    </S.SavedResultRow>
  );
}

export const ScraperProxiesEditorComponent = ({
  rows,
  rowStatuses,
  disabled,
  canTestRow,
  savedResults,
  isSavedTestRunning,
  savedTestFailed,
  proxyStats,
  onFieldChange,
  onSchemeChange,
  onAddRow,
  onRemoveRow,
  onTestRow,
  onTestSaved,
}: ScraperProxiesEditorComponentProps): React.ReactElement => {
  const { t } = useTranslation(['admin', 'translation']);
  return (
    <S.Editor>
      <S.RowList>
        {rows.map((row, index) => (
          <S.RowBlock key={row.localId}>
            <S.ProxyRow>
              <ModernSelect
                name={`scraper-proxy-scheme-${row.localId}`}
                label={t('admin.settings.scraperProxies.scheme')}
                options={SCHEME_OPTIONS}
                value={row.scheme}
                onChange={(scheme) => onSchemeChange(row.localId, scheme)}
                isDisabled={disabled}
              />
              <ModernTextInput
                name={`scraper-proxy-host-${row.localId}`}
                label={t('admin.settings.scraperProxies.host')}
                value={row.host}
                isDisabled={disabled}
                onChange={(e) => onFieldChange(row.localId, 'host', e.target.value)}
              />
              <ModernTextInput
                name={`scraper-proxy-port-${row.localId}`}
                label={t('admin.settings.scraperProxies.port')}
                value={row.port}
                isDisabled={disabled}
                onChange={(e) => onFieldChange(row.localId, 'port', e.target.value)}
              />
              <ModernTextInput
                name={`scraper-proxy-username-${row.localId}`}
                label={t('admin.settings.scraperProxies.username')}
                value={row.username}
                isDisabled={disabled}
                onChange={(e) => onFieldChange(row.localId, 'username', e.target.value)}
              />
              <ModernTextInput
                name={`scraper-proxy-password-${row.localId}`}
                label={t('admin.settings.scraperProxies.password')}
                type="password"
                autoComplete="new-password"
                value={row.password}
                isDisabled={disabled}
                onChange={(e) => onFieldChange(row.localId, 'password', e.target.value)}
              />
              <S.RowActions>
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  disabled={disabled || !canTestRow(row.localId) || rowStatuses[row.localId]?.state === ProxyRowTestState.TESTING}
                  isLoading={rowStatuses[row.localId]?.state === ProxyRowTestState.TESTING}
                  onClick={() => onTestRow(row.localId)}
                >
                  <Text variant="body-sm" weight="semibold">
                    {t('admin.settings.scraperProxies.test')}
                  </Text>
                </Button>
                <IconButton
                  type="button"
                  variant="ghost"
                  disabled={disabled || rows.length === 1}
                  onClick={() => onRemoveRow(row.localId)}
                  aria-label={t('admin.settings.scraperProxies.remove', { index: index + 1 })}
                >
                  <Icon name="trash" size={16} color="semantic.error" />
                </IconButton>
              </S.RowActions>
            </S.ProxyRow>
            <S.StatusSlot role="status" aria-live="polite">
              <RowStatusBadge status={rowStatuses[row.localId]} />
            </S.StatusSlot>
          </S.RowBlock>
        ))}
      </S.RowList>

      <S.AddRow>
        <Button type="button" variant="tertiary" size="small" disabled={disabled} onClick={onAddRow}>
          <Icon name="plus" size={14} />
          <Text variant="body-sm" weight="semibold">
            {t('admin.settings.scraperProxies.add')}
          </Text>
        </Button>
      </S.AddRow>

      <S.SavedTest>
        <S.SavedTestHeader>
          <Text variant="body-sm" color="text.secondary">
            {t('admin.settings.scraperProxies.testSavedHint')}
          </Text>
          <Button type="button" variant="secondary" size="small" isLoading={isSavedTestRunning} onClick={onTestSaved}>
            <Icon name="plug" size={14} />
            <Text variant="body-sm" weight="semibold">
              {t('admin.settings.scraperProxies.testSaved')}
            </Text>
          </Button>
        </S.SavedTestHeader>
        {savedTestFailed && (
          <Text variant="body-sm" color="semantic.error">
            {t('admin.settings.scraperProxies.testSavedFailed')}
          </Text>
        )}
        {savedResults && savedResults.length === 0 && (
          <Text variant="body-sm" color="text.tertiary">
            {t('admin.settings.scraperProxies.testSavedEmpty')}
          </Text>
        )}
        {savedResults && savedResults.length > 0 && (
          <S.SavedResultList>
            {savedResults.map((result) => (
              <SavedResultRow key={result.id} result={result} />
            ))}
          </S.SavedResultList>
        )}
      </S.SavedTest>

      {proxyStats.length > 0 && (
        <S.SavedTest>
          <Text variant="body-sm" weight="semibold">
            {t('admin.settings.scraperProxies.lastHourTitle')}
          </Text>
          <S.SavedResultList>
            {proxyStats.map((proxy) => (
              <S.SavedResultRow key={proxy.id}>
                <Text variant="mono" color="text.secondary">
                  {proxy.id}
                </Text>
                <S.RowActions>
                  <Text variant="body-sm" color="text.secondary" numeric>
                    {t('admin.settings.scraperProxies.lastHourRow', { requests: proxy.requests1h, blocked: proxy.blocked1h })}
                  </Text>
                  {proxy.coolingDown && <Badge variant="warning">{t('admin.settings.scraperProxies.coolingDown')}</Badge>}
                </S.RowActions>
              </S.SavedResultRow>
            ))}
          </S.SavedResultList>
        </S.SavedTest>
      )}
    </S.Editor>
  );
};
