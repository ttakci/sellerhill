import { Button, Checkbox, ConfirmModal, Drawer, ModernSelect, SearchField, Text, Textarea } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  AddStack,
  BodyStack,
  CardGrid,
  FormCard,
  ToolbarLeft,
  ToolbarRight,
  ToolbarRow,
} from './BlacklistDrawer.style';
import type { BlacklistDrawerComponentProps, BlacklistScope } from './BlacklistDrawer.types';

import { BlacklistCard } from '@/features/store-settings/components/BlacklistCard';

export const BlacklistDrawerComponent: React.FC<BlacklistDrawerComponentProps> = ({
  isOpen,
  onClose,
  onBack,
  keywords,
  onKeywordsChange,
  selectedScopeValue,
  onSelectScopeValue,
  onAdd,
  errorMessage,
  items,
  onRemove,
  searchValue,
  onSearchChange,
  selectedItems,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  onSave,
  isSaving,
  isSaveDisabled,
  titleLabel,
  subtitleLabel,
  keywordsLabel,
  keywordsPlaceholder,
  keywordsHint,
  scopeLabel,
  scopeBothLabel,
  scopeTitleLabel,
  scopeDescriptionLabel,
  addLabel,
  emptyMessage,
  searchPlaceholder,
  selectAllLabel,
  selectedCountLabel,
  bulkDeleteLabel,
  isConfirmOpen,
  onOpenConfirm,
  onCloseConfirm,
  onConfirmBulkDelete,
  confirmDescription,
  confirmLabel,
  cancelLabel,
}) => {
  const { t } = useTranslation(['translation']);

  const hasItems = items.length > 0;
  const hasSelection = selectedItems.length > 0;
  const isItemSelected = (keyword: string, scope: BlacklistScope) =>
    selectedItems.some((item) => item.keyword === keyword && item.scope === scope);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backAriaLabel={t('translation:common.back')}
      title={titleLabel}
      subtitle={subtitleLabel}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: onSave,
        isLoading: isSaving,
        disabled: isSaveDisabled,
      }}
    >
      <BodyStack>
        <FormCard>
          <AddStack>
            <ModernSelect
              label={scopeLabel}
              options={[
                { value: 'both', label: scopeBothLabel },
                { value: 'title', label: scopeTitleLabel },
                { value: 'description', label: scopeDescriptionLabel },
              ]}
              value={selectedScopeValue}
              onChange={(v) => onSelectScopeValue(v as BlacklistScope)}
              fullWidth
              searchPlaceholder={t('translation:common.search')}
              noResultsMessage={t('translation:common.noResults')}
            />
            <Textarea
              value={keywords}
              onChange={onKeywordsChange}
              placeholder={keywordsPlaceholder}
              fullWidth
              rows={4}
              aria-label={keywordsLabel}
            />
            <Text variant="caption" color="text.tertiary">
              {keywordsHint}
            </Text>
            <Button variant="secondary" onClick={onAdd}>
              <Text weight="bold">{addLabel}</Text>
            </Button>
            {errorMessage && (
              <Text variant="caption" color="semantic.error">
                {errorMessage}
              </Text>
            )}
          </AddStack>
          {hasItems ? (
            <>
              <SearchField
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                fullWidth
                aria-label={searchPlaceholder}
              />
              <ToolbarRow>
                <ToolbarLeft>
                  <Checkbox checked={isAllSelected} onChange={onToggleSelectAll} label={selectAllLabel} />
                  {hasSelection && (
                    <Text variant="caption" color="text.secondary">
                      {selectedCountLabel}
                    </Text>
                  )}
                </ToolbarLeft>
                {hasSelection && (
                  <ToolbarRight>
                    <Button variant="danger" size="small" onClick={onOpenConfirm} fullWidth>
                      <Text weight="bold">{bulkDeleteLabel}</Text>
                    </Button>
                  </ToolbarRight>
                )}
              </ToolbarRow>
            </>
          ) : (
            <Text variant="body-sm" color="text.secondary">
              {emptyMessage}
            </Text>
          )}
        </FormCard>
        {hasItems && (
          <CardGrid>
            {items.map((item) => (
              <BlacklistCard
                key={`${item.keyword}-${item.scope}`}
                keyword={item.keyword}
                scope={item.scope}
                onRemove={() => onRemove(item.keyword, item.scope)}
                selectable
                selected={isItemSelected(item.keyword, item.scope)}
                onSelect={() => onToggleSelect(item)}
              />
            ))}
          </CardGrid>
        )}
      </BodyStack>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={onCloseConfirm}
        onConfirm={onConfirmBulkDelete}
        type="warning"
        typeTitles={{
          info: t('translation:dialog.title.info'),
          success: t('translation:dialog.title.success'),
          warning: t('translation:dialog.title.warning'),
          error: t('translation:dialog.title.error'),
        }}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
      />
    </Drawer>
  );
};

BlacklistDrawerComponent.displayName = 'BlacklistDrawerComponent';
