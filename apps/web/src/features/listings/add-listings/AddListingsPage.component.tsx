import { zodResolver } from '@hookform/resolvers/zod';
import { createListingsSchema, type CreateListingsFormData } from '@repo/shared';
import { Icon, Select } from '@repo/ui';
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

            <Controller
              name="listingSettingsGroupId"
              control={control}
              render={({ field }) => (
                <S.FormGroup>
                  <S.Label>
                    {t('listings.listingSettings.strategyGroup')} <S.RequiredStar>*</S.RequiredStar>
                  </S.Label>
                  <Select
                    {...field}
                    placeholder={t('listings.listingSettings.strategyGroupPlaceholder')}
                    disabled={isLoading || isSubmitting}
                    hasError={!!errors.listingSettingsGroupId}
                    options={listingSettingsGroups.map(group => ({
                      label: group.name,
                      value: group.id
                    }))}
                  />
                  <S.ItalicHelp>
                    {t('listings.listingSettings.strategyGroupHelp')}
                  </S.ItalicHelp>
                </S.FormGroup>
              )}
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
              <Controller
                name="paymentPolicyId"
                control={control}
                render={({ field }) => (
                  <S.FormGroup>
                    <S.Label>
                      {t('listings.businessPolicies.paymentPolicy')} <S.RequiredStar>*</S.RequiredStar>
                    </S.Label>
                    <Select
                      {...field}
                      placeholder={t('listings.businessPolicies.paymentPolicyPlaceholder')}
                      disabled={isLoading || isSubmitting}
                      hasError={!!errors.paymentPolicyId}
                      options={businessPolicies.payment.map(policy => ({
                        label: policy.name,
                        value: policy.id
                      }))}
                    />
                  </S.FormGroup>
                )}
              />

              <Controller
                name="shippingPolicyId"
                control={control}
                render={({ field }) => (
                  <S.FormGroup>
                    <S.Label>
                      {t('listings.businessPolicies.shippingPolicy')} <S.RequiredStar>*</S.RequiredStar>
                    </S.Label>
                    <Select
                      {...field}
                      placeholder={t('listings.businessPolicies.shippingPolicyPlaceholder')}
                      disabled={isLoading || isSubmitting}
                      hasError={!!errors.shippingPolicyId}
                      options={businessPolicies.shipping.map(policy => ({
                        label: policy.name,
                        value: policy.id
                      }))}
                    />
                  </S.FormGroup>
                )}
              />

              <Controller
                name="returnPolicyId"
                control={control}
                render={({ field }) => (
                  <S.FormGroup>
                    <S.Label>
                      {t('listings.businessPolicies.returnPolicy')} <S.RequiredStar>*</S.RequiredStar>
                    </S.Label>
                    <Select
                      {...field}
                      placeholder={t('listings.businessPolicies.returnPolicyPlaceholder')}
                      disabled={isLoading || isSubmitting}
                      hasError={!!errors.returnPolicyId}
                      options={businessPolicies.return.map(policy => ({
                        label: policy.name,
                        value: policy.id
                      }))}
                    />
                  </S.FormGroup>
                )}
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
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t('listings.asinEntry.title')}
                  <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8' }}>
                    {t('listings.asinEntry.subtitle')}
                  </span>
                </h2>
              </div>
            </S.AsinHeaderLeft>
            
            <S.AsinCounter>
              {t('listings.asinEntry.counter', { count: asinCount })}
            </S.AsinCounter>
          </S.AsinCardHeader>

          <S.AsinInputWrapper>
            <S.AsinInputHeader>
              <S.Label>
                {t('listings.asinEntry.label')} <S.RequiredStar>*</S.RequiredStar>
              </S.Label>
              <S.MonoCode>
                {t('listings.asinEntry.accepts')}
              </S.MonoCode>
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
            <S.SubmitButton
              type="submit"
              disabled={isLoading || isSubmitting || asinCount === 0}
            >
              <span>{isSubmitting ? t('listings.actions.importing') : t('listings.actions.import')}</span>
              <Icon name="play_arrow" size={20} />
            </S.SubmitButton>
          </S.FormFooter>
        </S.AsinCard>
      </form>
    </S.Container>
  );
};
