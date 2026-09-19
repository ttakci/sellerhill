import { PlatformSettingCategory, PlatformSettingSource, PlatformSettingType } from '@repo/shared';
import {
  Badge,
  Button,
  ConfirmModal,
  EmptyState,
  Icon,
  ModernTextInput,
  SearchField,
  SegmentedControl,
  Text,
  Toggle,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AdminSettingsPanel.style';
import type { AdminSettingsPanelComponentProps } from './AdminSettingsPanel.types';

/** A database override is the only source worth calling out visually. */
const SOURCE_VARIANT: Record<PlatformSettingSource, 'neutral' | 'success'> = {
  [PlatformSettingSource.DATABASE]: 'success',
  [PlatformSettingSource.ENV]: 'neutral',
  [PlatformSettingSource.DEFAULT]: 'neutral',
};

export const AdminSettingsPanelComponent = ({
  groups,
  query,
  filter,
  filterOptions,
  hasResults,
  emailTestResult,
  isTestingEmail,
  resetTargetTitle,
  onQueryChange,
  onFilterChange,
  onToggleCategory,
  onDraftChange,
  onSubmit,
  onCancel,
  onKeyDown,
  onToggle,
  onResetRequest,
  onResetConfirm,
  onResetCancel,
  onEmailTest,
}: AdminSettingsPanelComponentProps): React.ReactElement => {
  const { t } = useTranslation(['admin', 'translation']);
  return (
    <S.Panel>
      <Text variant="body-sm" color="text.secondary">
        {t('admin.settings.intro')}
      </Text>

      <S.Toolbar>
        <S.SearchSlot>
          <SearchField
            value={query}
            onChange={onQueryChange}
            placeholder={t('admin.settings.search')}
            aria-label={t('admin.settings.search')}
            name="platform-settings-search"
            fullWidth
          />
        </S.SearchSlot>
        <SegmentedControl options={filterOptions} value={filter} onChange={onFilterChange} size="sm" />
      </S.Toolbar>

      {!hasResults && (
        <EmptyState
          icon="search"
          title={t('admin.settings.noResults.title')}
          description={t('admin.settings.noResults.description')}
        />
      )}

      {groups.map((group) => (
        <S.Category key={group.category}>
          <S.CategoryHeader
            type="button"
            $isOpen={group.isOpen}
            onClick={() => onToggleCategory(group.category)}
            aria-expanded={group.isOpen}
          >
            <S.CategoryTitle>
              <Text variant="h4" weight="semibold">
                {group.title}
              </Text>
              <Text variant="caption" color="text.tertiary" numeric>
                {t('admin.settings.count', { count: group.rows.length })}
              </Text>
              {group.changedCount > 0 && (
                <Badge variant="success">{t('admin.settings.changedCount', { count: group.changedCount })}</Badge>
              )}
            </S.CategoryTitle>
            <Icon name="chevron-down" size={18} />
          </S.CategoryHeader>

          {group.isOpen && (
            <>
              {group.category === PlatformSettingCategory.EMAIL && (
                <S.EmailTest>
                  {emailTestResult && (
                    <Badge variant={emailTestResult.ok ? 'success' : 'error'}>
                      {emailTestResult.ok ? t('admin.settings.emailTestOk') : t('admin.settings.emailTestFailed')}
                    </Badge>
                  )}
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={onEmailTest}
                    isLoading={isTestingEmail}
                    disabled={isTestingEmail}
                  >
                    <Text variant="body-sm" weight="semibold">
                      {t('admin.settings.emailTest')}
                    </Text>
                  </Button>
                </S.EmailTest>
              )}
              <S.Rows>
                {group.rows.map((row) => {
                  const { setting } = row;
                  return (
                    <S.Row key={setting.key} onSubmit={(event) => onSubmit(setting, event)} noValidate>
                      <S.RowText>
                        <Text variant="body" weight="semibold">
                          {row.title}
                        </Text>
                        <Text variant="body-sm" color="text.secondary">
                          {row.description}
                        </Text>
                        <S.Meta>
                          <Text variant="caption" color="text.tertiary">
                            {t('admin.settings.envHint', { envVar: setting.envVar })}
                            {setting.defaultValue !== null
                              ? ` · ${t('admin.settings.defaultHint', { value: setting.defaultValue })}`
                              : ''}
                          </Text>
                        </S.Meta>
                        <S.Meta>
                          <Badge variant={SOURCE_VARIANT[setting.source]}>
                            {t(`admin.settings.source.${setting.source}`)}
                          </Badge>
                          {setting.requiresRestart && (
                            <Badge variant="warning">{t('admin.settings.requiresRestart')}</Badge>
                          )}
                          {setting.isSecret && (
                            <Badge variant={setting.hasValue ? 'success' : 'neutral'}>
                              {setting.hasValue ? t('admin.settings.secretSet') : t('admin.settings.secretUnset')}
                            </Badge>
                          )}
                        </S.Meta>
                      </S.RowText>

                      <S.Control>
                        {setting.type === PlatformSettingType.BOOLEAN ? (
                          <S.ToggleWrap>
                            <Toggle
                              checked={setting.value === 'true'}
                              onChange={() => onToggle(setting)}
                              disabled={row.isPending}
                              ariaLabel={row.title}
                            />
                          </S.ToggleWrap>
                        ) : (
                          <ModernTextInput
                            id={row.inputId}
                            name={setting.key}
                            type={row.inputType}
                            label={row.inputLabel}
                            ariaLabel={row.title}
                            autoComplete={setting.isSecret ? 'new-password' : 'off'}
                            value={row.value}
                            isDisabled={row.isPending}
                            errorMessage={row.errorText}
                            onChange={(e) => onDraftChange(setting.key, e.target.value)}
                            onKeyDown={(e) => onKeyDown(setting.key, e)}
                          />
                        )}

                        <S.Actions>
                          {row.isDirty && (
                            <>
                              <Button
                                type="submit"
                                variant="primary"
                                size="small"
                                disabled={!row.canSave}
                                isLoading={row.isPending}
                              >
                                <Text variant="body-sm" weight="semibold">
                                  {t('translation:common.save')}
                                </Text>
                              </Button>
                              <Button
                                type="button"
                                variant="tertiary"
                                size="small"
                                disabled={row.isPending}
                                onClick={() => onCancel(setting.key)}
                              >
                                <Text variant="body-sm" weight="semibold">
                                  {t('translation:common.cancel')}
                                </Text>
                              </Button>
                            </>
                          )}
                          {!row.isDirty && row.isOverridden && (
                            <Button
                              type="button"
                              variant="text"
                              size="small"
                              disabled={row.isPending}
                              onClick={() => onResetRequest(setting)}
                            >
                              <Text variant="body-sm" weight="semibold">
                                {t('admin.settings.reset')}
                              </Text>
                            </Button>
                          )}
                        </S.Actions>
                        <S.Status role="status" aria-live="polite">
                          {row.isSaved && <Badge variant="success">{t('admin.settings.saved')}</Badge>}
                        </S.Status>
                      </S.Control>
                    </S.Row>
                  );
                })}
              </S.Rows>
            </>
          )}
        </S.Category>
      ))}

      <ConfirmModal
        isOpen={resetTargetTitle !== null}
        onClose={onResetCancel}
        onConfirm={onResetConfirm}
        type="warning"
        description={t('admin.settings.resetSecretConfirm', { title: resetTargetTitle ?? '' })}
        confirmLabel={t('admin.settings.reset')}
        cancelLabel={t('translation:common.cancel')}
      />
    </S.Panel>
  );
};
