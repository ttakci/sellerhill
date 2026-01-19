import { zodResolver } from '@hookform/resolvers/zod';
import { createListingsSchema, type CreateListingsFormData } from '@repo/shared';
import { Button, Icon, Select, Text } from '@repo/ui';
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
      asins: '',
      listingSettingsGroupId: '',
      paymentPolicyId: '',
      shippingPolicyId: '',
      returnPolicyId: '',
    },
  });

  return (
    <S.Container>
      {/* Header & Breadcrumbs */}
      <S.Header>
        <S.Breadcrumb>
          <a href="/">{t('translation:menu.dashboard')}</a>
          <span> › </span>
          <a href="/listings">{t('translation:menu.listings')}</a>
          <span> › </span>
          <strong>{t('listings.breadcrumb.addProducts')}</strong>
        </S.Breadcrumb>
        
        <Text variant="h3" weight="bold">
          {t('listings.title')}
        </Text>
        
        <Text variant="body" color="text.secondary" style={{ maxWidth: '800px' }}>
          {t('listings.subtitle')}
        </Text>
      </S.Header>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Configuration Section */}
        <S.ConfigSection>
          {/* Listing Settings Group */}
          <S.Card>
            <S.CardHeader>
              <S.IconWrapper>
                <Icon name="settings" size={18} />
              </S.IconWrapper>
              <Text variant="body" weight="bold">
                {t('listings.listingSettings.title')}
              </Text>
            </S.CardHeader>

            <Controller
              name="listingSettingsGroupId"
              control={control}
              render={({ field }) => (
                <S.FormGroup>
                  <Text variant="body" weight="semibold">
                    {t('listings.listingSettings.strategyGroup')} <span style={{ color: 'red' }}>*</span>
                  </Text>
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
                  {errors.listingSettingsGroupId && (
                    <Text variant="caption" color="semantic.error">
                      {String(errors.listingSettingsGroupId.message)}
                    </Text>
                  )}
                  <Text variant="caption" color="text.tertiary" style={{ fontStyle: 'italic' }}>
                    {t('listings.listingSettings.strategyGroupHelp')}
                  </Text>
                </S.FormGroup>
              )}
            />
          </S.Card>

          {/* Business Policies */}
          <S.Card>
            <S.CardHeader>
              <S.IconWrapper>
                <Icon name="check-list" size={18} />
              </S.IconWrapper>
              <Text variant="body" weight="bold">
                {t('listings.businessPolicies.title')}
              </Text>
            </S.CardHeader>

            <S.PolicyGrid>
              <Controller
                name="paymentPolicyId"
                control={control}
                render={({ field }) => (
                  <S.FormGroup>
                    <Text variant="body" weight="semibold">
                      {t('listings.businessPolicies.paymentPolicy')} <span style={{ color: 'red' }}>*</span>
                    </Text>
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
                    {errors.paymentPolicyId && (
                      <Text variant="caption" color="semantic.error">
                        {String(errors.paymentPolicyId.message)}
                      </Text>
                    )}
                  </S.FormGroup>
                )}
              />

              <Controller
                name="shippingPolicyId"
                control={control}
                render={({ field }) => (
                  <S.FormGroup>
                    <Text variant="body" weight="semibold">
                      {t('listings.businessPolicies.shippingPolicy')} <span style={{ color: 'red' }}>*</span>
                    </Text>
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
                    {errors.shippingPolicyId && (
                      <Text variant="caption" color="semantic.error">
                        {String(errors.shippingPolicyId.message)}
                      </Text>
                    )}
                  </S.FormGroup>
                )}
              />
              <Controller
                name="returnPolicyId"
                control={control}
                render={({ field }) => (
                  <S.FormGroup>
                    <Text variant="body" weight="semibold">
                      {t('listings.businessPolicies.returnPolicy')} <span style={{ color: 'red' }}>*</span>
                    </Text>
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
                    {errors.returnPolicyId && (
                      <Text variant="caption" color="semantic.error">
                        {String(errors.returnPolicyId.message)}
                      </Text>
                    )}
                  </S.FormGroup>
                )}
              />
            </S.PolicyGrid>
          </S.Card>
        </S.ConfigSection>

        {/* ASIN Entry Section */}
        <S.AsinCard>
          <S.AsinCardHeader>
            <S.AsinHeaderLeft>
              <S.IconWrapper>
                <Icon name="grid" size={18} />
              </S.IconWrapper>
              <div>
                <Text variant="body" weight="bold">
                  {t('listings.asinEntry.title')}
                </Text>
                <Text variant="caption" color="text.tertiary">
                  {t('listings.asinEntry.subtitle')}
                </Text>
              </div>
            </S.AsinHeaderLeft>
            
            <S.AsinCounter>
              <span>{asinCount}</span> / 1000 ASINs
            </S.AsinCounter>
          </S.AsinCardHeader>

          <S.AsinInputWrapper>
            <S.AsinInputHeader>
              <Text variant="caption" weight="semibold" color="text.secondary">
                {t('listings.asinEntry.label')} <span style={{ color: 'red' }}>*</span>
              </Text>
              <Text variant="caption" color="text.tertiary" style={{ fontFamily: 'monospace' }}>
                {t('listings.asinEntry.accepts')}
              </Text>
            </S.AsinInputHeader>

            <Controller
              name="asins"
              control={control}
              render={({ field }) => (
                <S.AsinTextarea
                  {...field}
                  placeholder={t('listings.asinEntry.placeholder')}
                  disabled={isLoading || isSubmitting}
                  onChange={(e) => {
                    field.onChange(e);
                    onAsinChange(e.target.value);
                  }}
                />
              )}
            />

            {errors.asins && (
              <Text variant="caption" color="semantic.error">
                {String(errors.asins.message)}
              </Text>
            )}

            <S.HelpText>
              <Icon name="info" size={14} />
              <Text variant="caption">
                {t('listings.asinEntry.helpText')}
              </Text>
            </S.HelpText>
          </S.AsinInputWrapper>
        </S.AsinCard>

        {/* Actions */}
        <S.Actions>
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => window.history.back()}
          >
            {t('translation:common.cancel')}
          </Button>
          
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isLoading || asinCount === 0}
          >
            <Icon name="upload" size={16} />
            {isSubmitting ? t('listings.actions.importing') : t('listings.actions.import')}
          </Button>
        </S.Actions>
      </form>
    </S.Container>
  );
};
