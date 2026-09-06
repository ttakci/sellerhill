import type { CreateListingsFormData } from '@repo/shared';
import { Drawer, ModernSelect, Text, Toggle } from '@repo/ui';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import * as S from './AddListingsDrawer.style';
import type { AddListingsDrawerComponentProps } from './AddListingsDrawer.types';

/**
 * Two-step create flow (no stepper UI):
 * 0 — Settings & business policies → Continue
 * 1 — ASIN entry → Import / Save drafts
 * Draft toggle lives on step 0 (settings). Both panels stay mounted so RHF values survive step changes.
 * Navigation: footer Continue / header back arrow.
 */
export const AddListingsDrawerComponent = ({
  isOpen,
  onClose,
  currentStep,
  isSubmitting,
  isLoading,
  form,
  ebayAccounts,
  listingSettingsGroups,
  businessPolicies,
  asinCount,
  onAsinChange,
  onNext,
  onBack,
  onSubmit,
  canProceed,
}: AddListingsDrawerComponentProps) => {
  const { t } = useTranslation(['listings', 'translation']);
  const { control } = form;

  const isLastStep = currentStep === 1;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backAriaLabel={t('translation:common.back')}
      title={t('listings.actions.addNewList')}
      size="lg"
      primaryAction={
        isLastStep
          ? {
              label: t('translation:common.save'),
              onClick: onSubmit,
              isLoading: isSubmitting,
              disabled: isLoading || !canProceed || isSubmitting,
            }
          : {
              label: t('translation:common.continue'),
              onClick: onNext,
              disabled: isLoading || !canProceed || isSubmitting,
            }
      }
    >
      <S.BodyStack>
        <S.StepPanel $active={currentStep === 0}>
          <S.Card>
            <S.SectionBlock>
              <S.SectionTitle variant="h5" weight="semibold" color="text.primary">
                {t('listings.existingImport.storeTitle')}
              </S.SectionTitle>
              <ModernSelect<CreateListingsFormData>
                name="ebayAccountId"
                control={control}
                label={t('listings.existingImport.store')}
                isDisabled={isLoading || isSubmitting}
                options={ebayAccounts.map((account) => ({ label: account.name, value: account.id }))}
                fullWidth
                searchPlaceholder={t('translation:common.search')}
                noResultsMessage={t('translation:common.noResults')}
              />
            </S.SectionBlock>
          </S.Card>

          <S.Card>
            <S.SectionBlock>
              <S.SectionTitle variant="h5" weight="semibold" color="text.primary">
                {t('listings.listingSettings.title')}
              </S.SectionTitle>
              <ModernSelect<CreateListingsFormData>
                name="listingSettingsGroupId"
                control={control}
                label={t('listings.listingSettings.strategyGroup')}
                placeholder={t('listings.listingSettings.strategyGroupPlaceholder')}
                isDisabled={isLoading || isSubmitting}
                options={listingSettingsGroups.map((group) => ({
                  label: group.name,
                  value: group.id,
                }))}
                fullWidth
                searchPlaceholder={t('translation:common.search')}
                noResultsMessage={t('translation:common.noResults')}
              />
            </S.SectionBlock>
          </S.Card>

          <S.Card>
            <S.SectionBlock>
              <S.SectionTitle variant="h5" weight="semibold" color="text.primary">
                {t('listings.businessPolicies.title')}
              </S.SectionTitle>
              <S.PolicyGrid>
                <ModernSelect<CreateListingsFormData>
                  name="paymentPolicyId"
                  control={control}
                  label={t('listings.businessPolicies.paymentPolicy')}
                  placeholder={t('listings.businessPolicies.paymentPolicyPlaceholder')}
                  isDisabled={isLoading || isSubmitting}
                  options={businessPolicies.payment.map((policy) => ({
                    label: policy.name,
                    value: policy.id,
                  }))}
                  fullWidth
                  searchPlaceholder={t('translation:common.search')}
                  noResultsMessage={t('translation:common.noResults')}
                />
                <ModernSelect<CreateListingsFormData>
                  name="shippingPolicyId"
                  control={control}
                  label={t('listings.businessPolicies.shippingPolicy')}
                  placeholder={t('listings.businessPolicies.shippingPolicyPlaceholder')}
                  isDisabled={isLoading || isSubmitting}
                  options={businessPolicies.shipping.map((policy) => ({
                    label: policy.name,
                    value: policy.id,
                  }))}
                  fullWidth
                  searchPlaceholder={t('translation:common.search')}
                  noResultsMessage={t('translation:common.noResults')}
                />
                <ModernSelect<CreateListingsFormData>
                  name="returnPolicyId"
                  control={control}
                  label={t('listings.businessPolicies.returnPolicy')}
                  placeholder={t('listings.businessPolicies.returnPolicyPlaceholder')}
                  isDisabled={isLoading || isSubmitting}
                  options={businessPolicies.return.map((policy) => ({
                    label: policy.name,
                    value: policy.id,
                  }))}
                  fullWidth
                  searchPlaceholder={t('translation:common.search')}
                  noResultsMessage={t('translation:common.noResults')}
                />
              </S.PolicyGrid>
            </S.SectionBlock>
          </S.Card>

          <S.Card>
            <S.SectionBlock>
              <S.DraftRow>
                <S.DraftCopy>
                  <Text variant="h5" weight="semibold" color="text.primary">
                    {t('listings.draftMode.title')}
                  </Text>
                  <Text variant="caption" color="text.secondary">
                    {t('listings.draftMode.hint')}
                  </Text>
                </S.DraftCopy>
                <Controller
                  name="asDraft"
                  control={control}
                  render={({ field }) => (
                    <Toggle
                      checked={Boolean(field.value)}
                      onChange={field.onChange}
                      disabled={isLoading || isSubmitting}
                    />
                  )}
                />
              </S.DraftRow>
            </S.SectionBlock>
          </S.Card>
        </S.StepPanel>

        <S.StepPanel $active={currentStep === 1} $fill>
          <S.Card $fill>
            <S.CardHeader>
              <Text variant="h4" weight="semibold" color="text.primary">
                {t('listings.asinEntry.title')}
              </Text>
              <S.AsinCounter>{t('listings.asinEntry.counter', { count: asinCount })}</S.AsinCounter>
            </S.CardHeader>

            <Controller
              name="asins"
              control={control}
              render={({ field, fieldState }) => (
                <>
                  <S.AsinInputWrapper>
                    <S.AsinTextarea
                      {...field}
                      fill
                      placeholder={t('listings.asinEntry.placeholder')}
                      disabled={isLoading || isSubmitting}
                      error={fieldState.error?.message}
                      onChange={(e) => {
                        field.onChange(e);
                        onAsinChange(e.target.value);
                      }}
                    />
                  </S.AsinInputWrapper>
                  {fieldState.error?.message && (
                    <S.FieldError variant="caption" color="semantic.error">
                      {fieldState.error.message}
                    </S.FieldError>
                  )}
                </>
              )}
            />
          </S.Card>
        </S.StepPanel>
      </S.BodyStack>
    </Drawer>
  );
};
