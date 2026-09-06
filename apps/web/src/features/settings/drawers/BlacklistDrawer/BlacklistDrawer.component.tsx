import { Button, Checkbox, ConfirmModal, Drawer, SearchField, Text, Textarea } from '@repo/ui';
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
  TypeOptionsRow,
} from './BlacklistDrawer.style';
import type { BlacklistDrawerComponentProps } from './BlacklistDrawer.types';

import { BlacklistCard } from '@/features/store-settings/components/BlacklistCard';

export const BlacklistDrawerComponent: React.FC<BlacklistDrawerComponentProps> = ({
  isOpen,
  onClose,
  onBack,
  keywords,
  onKeywordsChange,
  selectedTypes,
  typeOptions,
  onToggleType,
  onAdd,
  errorMessage,
  items,
  hasKeywords,
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
  typeLabel,
  addLabel,
  emptyMessage,
  noResultsMessage,
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
          <Text variant="body-sm" weight="semibold">
            {typeLabel}
          </Text>
          <TypeOptionsRow>
            {typeOptions.map((option) => (
              <Checkbox
                key={option.value}
                checked={selectedTypes.includes(option.value)}
                onChange={() => onToggleType(option.value)}
                label={option.label}
              />
            ))}
          </TypeOptionsRow>
          <AddStack>
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
              <Text weight="semibold">{addLabel}</Text>
            </Button>
            {errorMessage && (
              <Text variant="caption" color="semantic.error">
                {errorMessage}
              </Text>
            )}
          </AddStack>
        </FormCard>
        <FormCard>
          {hasKeywords ? (
            <>
              <SearchField
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                fullWidth
                aria-label={searchPlaceholder}
              />
              {hasItems ? (
                <>
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
                          <Text weight="semibold">{bulkDeleteLabel}</Text>
                        </Button>
                      </ToolbarRight>
                    )}
                  </ToolbarRow>
                  <CardGrid>
                    {items.map((item) => (
                      <BlacklistCard
                        key={item.keyword}
                        keyword={item.keyword}
                        types={item.types}
                        onRemove={() => onRemove(item.keyword)}
                        selectable
                        selected={selectedItems.includes(item.keyword)}
                        onSelect={() => onToggleSelect(item.keyword)}
                      />
                    ))}
                  </CardGrid>
                </>
              ) : (
                <Text variant="body-sm" color="text.secondary">
                  {noResultsMessage}
                </Text>
              )}
            </>
          ) : (
            <Text variant="body-sm" color="text.secondary">
              {emptyMessage}
            </Text>
          )}
        </FormCard>
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
