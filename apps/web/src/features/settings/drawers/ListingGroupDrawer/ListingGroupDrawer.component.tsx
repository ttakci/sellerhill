import { TemplateType, type ListingSettingsGroupFormData, type PredefinedTemplateResponse } from '@repo/shared';
import { Drawer, Icon, ModernSelect, ModernTextInput, Stepper, Text, Toggle } from '@repo/ui';
import React from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import * as S from './ListingGroupDrawer.style';
import type { ListingGroupDrawerComponentProps, ListingGroupDrawerStep } from './ListingGroupDrawer.types';

const blockNonNumeric = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
    e.preventDefault();
  }
};

export const ListingGroupDrawerComponent = ({
  isOpen,
  onClose,
  currentStep,
  onStepChange,
  isEdit,
  isLoading,
  isSaving,
  form,
  fields,
  remove,
  onAddRange,
  predefinedTemplates,
  renderedPreview,
  onOpenPreview,
  onNext,
  onBack,
  onSubmit,
  canProceed,
}: ListingGroupDrawerComponentProps) => {
  const { t } = useTranslation(['listingSettingsGroup', 'translation']);
  const { control, watch, setValue } = form;

  const watchedValues = watch();
  const stepLabels = [
    t('listingSettingsGroup.generalSettings'),
    t('listingSettingsGroup.drawer.deductions'),
    t('listingSettingsGroup.pricingStrategy'),
    t('listingSettingsGroup.htmlTemplate'),
  ];

  const renderStepper = () => (
    <Stepper
      steps={stepLabels.map((label) => ({ label }))}
      currentStep={currentStep}
      clickable
      onStepClick={(index: number) => onStepChange(index as ListingGroupDrawerStep)}
    />
  );

  const renderGeneralStep = () => (
    <S.BodyStack>
      <S.FormCard>
        <ModernTextInput<ListingSettingsGroupFormData>
          name="name"
          control={control}
          label={t('listingSettingsGroup.groupName')}
          fullWidth
        />
        <ModernTextInput<ListingSettingsGroupFormData>
          name="description"
          control={control}
          label={t('listingSettingsGroup.description')}
          fullWidth
        />
        <Text variant="body-sm" weight="semibold">
          {t('listingSettingsGroup.contentSection')}
        </Text>
        <Controller
          name="content.stripBrandFromTitle"
          control={control}
          render={({ field }) => (
            <>
              <Toggle
                checked={Boolean(field.value)}
                onChange={field.onChange}
                label={t('listingSettingsGroup.stripBrandFromTitle')}
              />
              <Text variant="caption" color="text.secondary">
                {t('listingSettingsGroup.stripBrandFromTitleHint')}
              </Text>
            </>
          )}
        />
        <Controller
          name="content.aiTitleEnabled"
          control={control}
          render={({ field }) => (
            <>
              <Toggle
                checked={Boolean(field.value)}
                onChange={field.onChange}
                label={t('listingSettingsGroup.aiTitleEnabled')}
              />
              <Text variant="caption" color="text.secondary">
                {t('listingSettingsGroup.aiTitleEnabledHint')}
              </Text>
            </>
          )}
        />
        <Controller
          name="content.aiDescriptionEnabled"
          control={control}
          render={({ field }) => (
            <>
              <Toggle
                checked={Boolean(field.value)}
                onChange={field.onChange}
                label={t('listingSettingsGroup.aiDescriptionEnabled')}
              />
              <Text variant="caption" color="text.secondary">
                {t('listingSettingsGroup.aiDescriptionEnabledHint')}
              </Text>
            </>
          )}
        />
        <ModernTextInput<ListingSettingsGroupFormData>
          name="stock.defaultQuantity"
          control={control}
          label={t('listingSettingsGroup.defaultStockQuantity')}
          type="number"
          fullWidth
          onKeyDown={blockNonNumeric}
        />
        <ModernTextInput<ListingSettingsGroupFormData>
          name="stock.stockBuffer"
          control={control}
          label={t('listingSettingsGroup.stockBuffer')}
          type="number"
          fullWidth
          onKeyDown={blockNonNumeric}
        />
      </S.FormCard>
    </S.BodyStack>
  );

  const renderDeductionsStep = () => (
    <S.BodyStack>
      <S.FormCard>
        <ModernTextInput<ListingSettingsGroupFormData>
          name="fees.ebayFeePercent"
          control={control}
          label={t('listingSettingsGroup.ebayFeePercent')}
          type="number"
          suffixText="%"
          fullWidth
          onKeyDown={blockNonNumeric}
        />
        <ModernTextInput<ListingSettingsGroupFormData>
          name="fees.fixedFeeAmount"
          control={control}
          label={t('listingSettingsGroup.fixedFeeAmount')}
          type="number"
          suffixText="$"
          fullWidth
          onKeyDown={blockNonNumeric}
        />
        <ModernTextInput<ListingSettingsGroupFormData>
          name="fees.taxPercent"
          control={control}
          label={t('listingSettingsGroup.taxRate')}
          type="number"
          suffixText="%"
          fullWidth
          onKeyDown={blockNonNumeric}
        />
      </S.FormCard>
    </S.BodyStack>
  );

  const renderRepricingStep = () => (
    <S.BodyStack>
      <S.RepricingCardList>
        {fields.map((field, index) => (
          <S.RepricingCard key={field.id}>
            <S.RepricingCardHeader>
              <Text variant="body" weight="semibold">
                {t('listingSettingsGroup.priceRangeLabel', { index: index + 1 })}
              </Text>
              {fields.length > 1 && (
                <S.RemoveButton variant="danger" type="button" onClick={() => remove(index)}>
                  <Icon name="x" size={14} />
                </S.RemoveButton>
              )}
            </S.RepricingCardHeader>
            <S.RepricingCardBody>
              <S.RepricingFieldGrid>
                <ModernTextInput<ListingSettingsGroupFormData>
                  name={`repricingStrategy.${index}.minPrice`}
                  control={control}
                  label={t('listingSettingsGroup.minPrice')}
                  type="number"
                  suffixText="$"
                  fullWidth
                  onKeyDown={blockNonNumeric}
                />
                <ModernTextInput<ListingSettingsGroupFormData>
                  name={`repricingStrategy.${index}.maxPrice`}
                  control={control}
                  label={t('listingSettingsGroup.maxPrice')}
                  type="number"
                  suffixText="$"
                  fullWidth
                  onKeyDown={blockNonNumeric}
                />
                <ModernTextInput<ListingSettingsGroupFormData>
                  name={`repricingStrategy.${index}.profitMarginPercent`}
                  control={control}
                  label={t('listingSettingsGroup.profitMargin')}
                  type="number"
                  suffixText="%"
                  fullWidth
                  onKeyDown={blockNonNumeric}
                />
                <ModernTextInput<ListingSettingsGroupFormData>
                  name={`repricingStrategy.${index}.fixedProfitAmount`}
                  control={control}
                  label={t('listingSettingsGroup.fixedProfit')}
                  type="number"
                  suffixText="$"
                  fullWidth
                  onKeyDown={blockNonNumeric}
                />
              </S.RepricingFieldGrid>
            </S.RepricingCardBody>
          </S.RepricingCard>
        ))}
      </S.RepricingCardList>
      <S.AddRangeRow>
        <S.AddRangeButton variant="secondary" size="small" type="button" onClick={onAddRange}>
          <Icon name="plus" size={16} />
          <Text>{t('listingSettingsGroup.addRange')}</Text>
        </S.AddRangeButton>
      </S.AddRangeRow>
    </S.BodyStack>
  );

  const renderTemplateStep = () => (
    <S.BodyStack>
      <S.FormCard>
        <Controller
          name="templates.predefinedTemplateId"
          control={control}
          render={({ field }) => (
            <ModernSelect
              label={t('listingSettingsGroup.activeTemplate')}
              value={watchedValues.templates?.type === TemplateType.CUSTOM ? '__custom__' : field.value}
              options={[
                ...predefinedTemplates.map((tmp: PredefinedTemplateResponse) => ({
                  value: tmp.id,
                  label: tmp.name,
                })),
                { value: '__custom__', label: t('listingSettingsGroup.custom') },
              ]}
              fullWidth
              searchPlaceholder={t('translation:common.search')}
              noResultsMessage={t('translation:common.noResults')}
              onChange={(value: string | number) => {
                if (value === '__custom__') {
                  field.onChange(undefined);
                  setValue('templates.type', TemplateType.CUSTOM, { shouldValidate: true });
                } else {
                  field.onChange(value);
                  setValue('templates.type', TemplateType.PREDEFINED, { shouldValidate: true });
                }
              }}
            />
          )}
        />
        {watchedValues.templates?.type === TemplateType.CUSTOM && (
          <Controller
            name="templates.customTemplateHtml"
            control={control}
            render={({ field }) => (
              <S.CustomTemplateTextarea
                mono
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder={t('listingSettingsGroup.templatePlaceholder')}
              />
            )}
          />
        )}
      </S.FormCard>
      <S.PreviewCard variant="elevated">
        <S.StepHeader>
          <S.StepIconWrapper $type="template">
            <Icon name="eye" size={20} />
          </S.StepIconWrapper>
          <S.StepTitleContent>
            <S.StepTitle variant="h3" weight="semibold">
              {t('listingSettingsGroup.livePreview')}
            </S.StepTitle>
          </S.StepTitleContent>
          <S.DeviceControls>
            <S.PreviewIconButton
              type="button"
              variant="ghost"
              onClick={onOpenPreview}
              aria-label={t('listingSettingsGroup.livePreview')}
            >
              <Icon name="external-link" size={16} />
            </S.PreviewIconButton>
          </S.DeviceControls>
        </S.StepHeader>
        <S.PreviewCardBody>
          <S.PreviewContainer>
            <S.PreviewViewport>
              <S.PreviewContent>
                <S.PreviewHTMLContent dangerouslySetInnerHTML={{ __html: renderedPreview }} />
              </S.PreviewContent>
            </S.PreviewViewport>
          </S.PreviewContainer>
        </S.PreviewCardBody>
      </S.PreviewCard>
    </S.BodyStack>
  );

  const isLastStep = currentStep === 3;

  const title = isEdit ? t('listingSettingsGroup.editGroup') : t('listingSettingsGroup.createNewGroup');

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backAriaLabel={t('translation:common.back')}
      title={title}
      size="lg"
      primaryAction={
        isLastStep
          ? {
              label: t('translation:common.save'),
              onClick: onSubmit,
              isLoading: isSaving,
              disabled: isLoading,
            }
          : {
              label: t('translation:common.continue'),
              onClick: onNext,
              disabled: !canProceed,
            }
      }
    >
      <S.StepperWrapper>{renderStepper()}</S.StepperWrapper>
      {/* All steps stay mounted (hidden via CSS) so RHF never drops field
          values when navigating between wizard steps. */}
      <S.StepPanel $active={currentStep === 0}>{renderGeneralStep()}</S.StepPanel>
      <S.StepPanel $active={currentStep === 1}>{renderDeductionsStep()}</S.StepPanel>
      <S.StepPanel $active={currentStep === 2}>{renderRepricingStep()}</S.StepPanel>
      <S.StepPanel $active={currentStep === 3}>{renderTemplateStep()}</S.StepPanel>
    </Drawer>
  );
};

ListingGroupDrawerComponent.displayName = 'ListingGroupDrawerComponent';
