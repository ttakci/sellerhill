import { zodResolver } from '@hookform/resolvers/zod';
import { createListingsSchema, type CreateListingsFormData } from '@repo/shared';
import { Icon, ModernSelect } from '@repo/ui';
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
      <S.Header>
        <h1>{t('listings.title')}</h1>
        <p>{t('listings.subtitle')}</p>
      </S.Header>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Top Section: Side-by-Side Cards */}
        <S.ConfigSection>
          {/* Card 1: Listing Settings */}
          <S.Card>
            <S.CardHeader>
              <S.IconWrapper>
                <Icon name="settings_suggest" size={24} />
              </S.IconWrapper>
              <h2>{t('listings.listingSettings.title')}</h2>
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

          {/* Card 2: Business Policies */}
          <S.Card>
            <S.CardHeader>
              <S.IconWrapper>
                <Icon name="rule" size={24} />
              </S.IconWrapper>
              <h2>{t('listings.businessPolicies.title')}</h2>
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
        </S.ConfigSection>

        {/* Bottom Section: Full Width ASIN Card */}
        <S.AsinCard>
          <S.AsinCardHeader>
            <S.AsinHeaderLeft>
              <S.IconWrapper>
                <Icon name="format_list_bulleted" size={24} />
              </S.IconWrapper>
              <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {t('listings.asinEntry.title')}
                  <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#94a3b8' }}>
                    {t('listings.asinEntry.subtitle')}
                  </span>
                </h2>
              </div>
            </S.AsinHeaderLeft>

            <S.AsinCounter>{t('listings.asinEntry.counter', { count: asinCount })}</S.AsinCounter>
          </S.AsinCardHeader>

          <S.AsinInputWrapper>
            <S.AsinInputHeader>
              <S.Label>
                {t('listings.asinEntry.label')} <S.RequiredStar>*</S.RequiredStar>
              </S.Label>
              <S.MonoCode>{t('listings.asinEntry.accepts')}</S.MonoCode>
            </S.AsinInputHeader>

            <Controller
              name="asins"
              control={control}
              render={({ field }) => (
                <S.AsinTextarea
                  {...field}
                  placeholder={t('listings.asinEntry.placeholder')}
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
            <S.SubmitButton type="submit" disabled={isLoading || isSubmitting || asinCount === 0}>
              <span>{isSubmitting ? t('listings.actions.importing') : t('listings.actions.import')}</span>
              <Icon name="play_arrow" size={20} />
            </S.SubmitButton>
          </S.FormFooter>
        </S.AsinCard>
      </form>
    </S.Container>
  );
};
