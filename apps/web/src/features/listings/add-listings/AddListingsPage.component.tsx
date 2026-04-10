import { zodResolver } from '@hookform/resolvers/zod';
import { createListingsSchema, type CreateListingsFormData } from '@repo/shared';
import { Icon, ModernSelect, PageHeader } from '@repo/ui';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as S from './AddListingsPage.style';
import type { AddListingsPageComponentProps } from './AddListingsPage.types';

export const AddListingsPageComponent: React.FC<AddListingsPageComponentProps> = ({
  asins,
  asinCount,
  listingSettingsGroups,
  businessPolicies,
  isLoading,
  isSubmitting,
  onSubmit,
  onAsinChange,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateListingsFormData>({
    resolver: zodResolver(createListingsSchema(t)),
    defaultValues: {
      asins: asins,
      listingSettingsGroupId: '',
      paymentPolicyId: '',
      shippingPolicyId: '',
      returnPolicyId: '',
    },
  });

  return (
    <S.Container>
      <PageHeader
        title={t('listings:listings.title')}
        subtitle={t('listings:listings.subtitle')}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Top Section: Side-by-Side Cards */}
        <S.ConfigSection>
          {/* Card 1: Listing Settings */}
          <S.Card>
            <S.CardHeader>
              <S.IconWrapper>
                <Icon name="settings_suggest" size={24} />
              </S.IconWrapper>
              <h2>{t('listings:listings.listingSettings.title')}</h2>
            </S.CardHeader>

            <ModernSelect<CreateListingsFormData>
              name="listingSettingsGroupId"
              control={control}
              label={t('listings:listings.listingSettings.strategyGroup')}
              placeholder={t('listings:listings.listingSettings.strategyGroupPlaceholder')}
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

          {/* Card 2: Business Policies */}
          <S.Card>
            <S.CardHeader>
              <S.IconWrapper>
                <Icon name="rule" size={24} />
              </S.IconWrapper>
              <h2>{t('listings:listings.businessPolicies.title')}</h2>
            </S.CardHeader>

            <S.PolicyGrid>
              <ModernSelect<CreateListingsFormData>
                name="paymentPolicyId"
                control={control}
                label={t('listings:listings.businessPolicies.paymentPolicy')}
                placeholder={t('listings:listings.businessPolicies.paymentPolicyPlaceholder')}
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
                label={t('listings:listings.businessPolicies.shippingPolicy')}
                placeholder={t('listings:listings.businessPolicies.shippingPolicyPlaceholder')}
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
                label={t('listings:listings.businessPolicies.returnPolicy')}
                placeholder={t('listings:listings.businessPolicies.returnPolicyPlaceholder')}
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
        </S.ConfigSection>

        {/* Bottom Section: Full Width ASIN Card */}
        <S.AsinCard>
          <S.AsinCardHeader>
            <S.AsinHeaderLeft>
              <S.IconWrapper>
                <Icon name="format_list_bulleted" size={24} />
              </S.IconWrapper>
              <div>
                <S.AsinTitle>
                  {t('listings:listings.asinEntry.title')}
                </S.AsinTitle>
              </div>
            </S.AsinHeaderLeft>

            <S.AsinCounter>{t('listings:listings.asinEntry.counter', { count: asinCount })}</S.AsinCounter>
          </S.AsinCardHeader>

          <S.AsinInputWrapper>
            <S.AsinInputHeader>
              <S.Label variant="h5">
                {t('listings:listings.asinEntry.label')} <S.RequiredStar>*</S.RequiredStar>
              </S.Label>
            </S.AsinInputHeader>

            <Controller
              name="asins"
              control={control}
              render={({ field }) => (
                <S.AsinTextarea
                  {...field}
                  placeholder={t('listings:listings.asinEntry.placeholder')}
                  disabled={isLoading || isSubmitting}
                  hasError={!!errors.asins}
                  onChange={(e) => {
                    field.onChange(e);
                    onAsinChange(e.target.value);
                  }}
                />
              )}
            />
          </S.AsinInputWrapper>

          <S.FormFooter>
            <S.SubmitButton variant="primary" type="submit" disabled={isLoading || isSubmitting || asinCount === 0}>
              <span>{isSubmitting ? t('listings:listings.actions.importing') : t('listings:listings.actions.import')}</span>
              <Icon name="play_arrow" size={20} />
            </S.SubmitButton>
          </S.FormFooter>
        </S.AsinCard>
      </form>
    </S.Container>
  );
};
