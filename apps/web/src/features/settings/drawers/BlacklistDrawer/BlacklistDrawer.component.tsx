import {
  Button,
  Checkbox,
  ConfirmModal,
  Drawer,
  SearchField,
  SegmentedControl,
  Stepper,
  Text,
  Textarea,
  Icon,
} from '@repo/ui';
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
  steps,
  step,
  onStepClick,
  onNext,
  keywords,
  onKeywordsChange,
  selectedTypes,
  typeOptions,
  onToggleType,
  action,
  actionOptions,
  onActionChange,
  actionLabel,
  actionHint,
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
  blockedAsinsText,
  onBlockedAsinsChange,
  blockedAsinsTitle,
  blockedAsinsHint,
  blockedAsinsPlaceholder,
  blockedAsinsCountLabel,
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
      primaryAction={
        step === steps.length - 1
          ? {
              icon: 'save',
              label: t('translation:common.save'),
              onClick: onSave,
              isLoading: isSaving,
              disabled: isSaveDisabled,
            }
          : { icon: 'arrow-right', label: t('translation:common.continue'), onClick: onNext }
      }
    >
      <BodyStack>
        <Stepper steps={steps} currentStep={step} clickable onStepClick={onStepClick} />
        {step === 0 && (
          <>
            <FormCard>
              <Text variant="body-sm" weight="semibold">
                {actionLabel}
              </Text>
              <SegmentedControl options={actionOptions} value={action} onChange={onActionChange} />
              <Text variant="caption" color="text.tertiary">
                {actionHint}
              </Text>
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
                  rows={10}
                  aria-label={keywordsLabel}
                />
                <Text variant="caption" color="text.tertiary">
                  {keywordsHint}
                </Text>
                <Button variant="primary" onClick={onAdd}>
                  <Icon name="plus" size={16} />
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
                              <Icon name="trash" size={16} />
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
                            action={item.action}
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
          </>
        )}
        {step === 1 && (
          <FormCard>
            <Text variant="h4" weight="bold">
              {blockedAsinsTitle}
            </Text>
            <Text variant="caption" color="text.tertiary">
              {blockedAsinsHint}
            </Text>
            <Textarea
              value={blockedAsinsText}
              onChange={onBlockedAsinsChange}
              placeholder={blockedAsinsPlaceholder}
              fullWidth
              rows={4}
              mono
              aria-label={blockedAsinsTitle}
            />
            <Text variant="caption" color="text.tertiary">
              {blockedAsinsCountLabel}
            </Text>
          </FormCard>
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
