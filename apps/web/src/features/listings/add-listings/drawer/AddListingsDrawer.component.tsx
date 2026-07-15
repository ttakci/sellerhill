import type { CreateListingsFormData } from '@repo/shared';
import { Drawer, Icon, ModernSelect, Stepper, Text } from '@repo/ui';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import * as S from './AddListingsDrawer.style';
import type { AddListingsDrawerComponentProps, AddListingsDrawerStep } from './AddListingsDrawer.types';

export const AddListingsDrawerComponent = ({
  isOpen,
  onClose,
  currentStep,
  onStepChange,
  isSubmitting,
  isLoading,
  form,
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

  const stepLabels = [t('listings.drawer.step1'), t('listings.drawer.step2')];

  const renderStepper = () => (
    <Stepper
      steps={stepLabels.map((label) => ({ label }))}
      currentStep={currentStep}
      clickable
      onStepClick={(index: number) => onStepChange(index as AddListingsDrawerStep)}
    />
  );

  const renderSettingsStep = () => (
    <S.BodyStack>
      <S.Card>
        <S.CardHeader>
          <S.IconWrapper>
            <Icon name="settings_suggest" size={24} />
          </S.IconWrapper>
          <Text variant="h4" weight="bold">
            {t('listings.listingSettings.title')}
          </Text>
        </S.CardHeader>
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
      </S.Card>

      <S.Card>
        <S.CardHeader>
          <S.IconWrapper>
            <Icon name="rule" size={24} />
          </S.IconWrapper>
          <Text variant="h4" weight="bold">
            {t('listings.businessPolicies.title')}
          </Text>
        </S.CardHeader>
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
      </S.Card>
    </S.BodyStack>
  );

  const renderAsinStep = () => (
    <S.BodyStack>
      <S.Card>
        <S.CardHeader>
          <S.IconWrapper>
            <Icon name="format_list_bulleted" size={24} />
          </S.IconWrapper>
          <Text variant="h4" weight="bold">
            {t('listings.asinEntry.title')}
          </Text>
          <S.AsinCounter>{t('listings.asinEntry.counter', { count: asinCount })}</S.AsinCounter>
        </S.CardHeader>

        <S.AsinInputWrapper>
          <S.Label variant="h5">
            {t('listings.asinEntry.label')} <S.RequiredStar>*</S.RequiredStar>
          </S.Label>
          <Controller
            name="asins"
            control={control}
            render={({ field }) => (
              <S.AsinTextarea
                {...field}
                placeholder={t('listings.asinEntry.placeholder')}
                disabled={isLoading || isSubmitting}
                hasError={false}
                onChange={(e) => {
                  field.onChange(e);
                  onAsinChange(e.target.value);
                }}
              />
            )}
          />
        </S.AsinInputWrapper>
      </S.Card>
    </S.BodyStack>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderSettingsStep();
      case 1:
        return renderAsinStep();
      default:
        return null;
    }
  };

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
              label: t('listings.actions.import'),
              onClick: onSubmit,
              isLoading: isSubmitting,
              disabled: isLoading || asinCount === 0,
            }
          : {
              label: t('translation:common.continue'),
              onClick: onNext,
              disabled: !canProceed,
            }
      }
    >
      <S.StepperWrapper>{renderStepper()}</S.StepperWrapper>
      {renderStepContent()}
    </Drawer>
  );
};
