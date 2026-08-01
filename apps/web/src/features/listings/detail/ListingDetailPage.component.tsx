import { ListingStatus, type UpdateListingFormData } from '@repo/shared';
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  Icon,
  IdBadge,
  ModernSelect,
  ModernTextInput,
  PageHeader,
  SettingsActionRow,
  Text,
  TextInput,
  Toggle,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingDetailPage.style';
import type { ListingDetailPageProps } from './ListingDetailPage.types';

const statusVariant = (status: ListingStatus): 'success' | 'neutral' | 'error' | 'warning' => {
  switch (status) {
    case ListingStatus.ACTIVE:
      return 'success';
    case ListingStatus.ERROR:
      return 'error';
    case ListingStatus.RETRYING:
      return 'warning';
    case ListingStatus.DRAFT:
      return 'warning';
    default:
      return 'neutral';
  }
};

const Meta = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement => (
  <S.MetaRow>
    <Text variant="caption" color="text.secondary" weight="medium">
      {label}
    </Text>
    <div>{children}</div>
  </S.MetaRow>
);

export const ListingDetailPageComponent: React.FC<ListingDetailPageProps> = ({
  listing,
  isLoading,
  isSaving,
  isSavingOverrides,
  form,
  listingSettingsGroups,
  businessPolicies,
  strategyGroupLabel,
  paymentPolicyLabel,
  shippingPolicyLabel,
  returnPolicyLabel,
  selectedImageIndex,
  onSelectImage,
  descriptionExpanded,
  onToggleDescription,
  isEditDrawerOpen,
  onOpenEditDrawer,
  onCloseEditDrawer,
  overrides,
  onOverrideChange,
  onSaveOverrides,
  formatCurrency,
  formatDate,
  onBack,
  onSave,
  onPublish,
  onOpenAmazon,
  onOpenEbay,
  onManage,
  canPublish,
  canOpenEbay,
  statusLabel,
}) => {
  const { t } = useTranslation(['listings', 'translation']);
  const { control } = form;

  /* Shared EmptyState for both states — they used to be a bespoke block whose
     loading branch was a single line of grey text. */
  if (isLoading) {
    return (
      <S.Container>
        <S.StateCard variant="elevated" padding="lg">
          <EmptyState
            icon="inventory"
            title={t('translation:common.loading')}
            description={t('listings.detail.loadingSubtitle')}
          />
        </S.StateCard>
      </S.Container>
    );
  }

  if (!listing) {
    return (
      <S.Container>
        <S.StateCard variant="elevated" padding="lg">
          <EmptyState
            icon="inventory"
            title={t('listings.detail.notFoundTitle')}
            description={t('listings.detail.notFoundSubtitle')}
            action={t('translation:common.back')}
            onAction={onBack}
          />
        </S.StateCard>
      </S.Container>
    );
  }

  const images = listing.imageUrls?.length ? listing.imageUrls : [];
  const mainImage = images[selectedImageIndex] ?? images[0];
  const profit = listing.estimatedProfit ?? 0;
  const roi = listing.roi ?? 0;
  const margin = listing.profitMargin ?? 0;
  const cost = listing.purchasePrice ?? 0;
  const hasDescription = Boolean(listing.description?.trim());
  const descriptionLong = (listing.description?.length ?? 0) > 280;
  const features = listing.features ?? [];
  const specs = listing.specs ?? {};
  const specEntries = Object.entries(specs);

  return (
    <S.Container>
      <PageHeader
        title={listing.title || listing.asin}
        subtitle={
          listing.status === ListingStatus.DRAFT
            ? t('listings.detail.draftBanner')
            : t('listings.detail.subtitle')
        }
        onBack={onBack}
        backAriaLabel={t('translation:common.back')}
      />

      {canPublish ? (
        <S.DraftPublishBar variant="elevated" padding="md">
          <S.DraftPublishCopy>
            <Text variant="body-sm" color="text.secondary">
              {t('listings.detail.publishHint')}
            </Text>
          </S.DraftPublishCopy>
          <Button variant="primary" size="medium" onClick={onPublish}>
            <Text variant="body">{t('listings.detail.publish')}</Text>
          </Button>
        </S.DraftPublishBar>
      ) : null}

      <S.Hero variant="elevated" padding="lg">
        <S.GalleryBlock>
          <S.GalleryMain>
            {mainImage ? (
              <img src={mainImage} alt={listing.title} />
            ) : (
              <Icon name="image" size={48} />
            )}
          </S.GalleryMain>
          {images.length > 1 && (
            <S.ThumbRow>
              {images.map((src, index) => (
                <S.ThumbButton
                  key={`${src}-${index}`}
                  type="button"
                  $active={index === selectedImageIndex}
                  onClick={() => onSelectImage(index)}
                  aria-label={t('listings.detail.imageThumb', { index: index + 1 })}
                >
                  <img src={src} alt="" />
                </S.ThumbButton>
              ))}
            </S.ThumbRow>
          )}
        </S.GalleryBlock>

        <S.HeroInfo>
          {/* The product title lives in PageHeader (h1). It used to be repeated
              verbatim here, so the same string rendered twice, 24px apart. */}
          <S.TitleRow>
            <S.BadgeRow>
              <Badge variant={statusVariant(listing.status)} size="sm">
                {statusLabel}
              </Badge>
              {listing.brand ? (
                <Text variant="body-sm" color="text.secondary" weight="medium">
                  {listing.brand}
                </Text>
              ) : null}
              {listing.category ? (
                <Text variant="body-sm" color="text.secondary">
                  {listing.category}
                </Text>
              ) : null}
            </S.BadgeRow>
          </S.TitleRow>

          <S.IdRow>
            <IdBadge id={listing.asin} storeType="amazon" size="sm" />
            {listing.ebayListingId ? (
              <IdBadge id={listing.ebayListingId} storeType="ebay" size="sm" />
            ) : null}
          </S.IdRow>

          {/* One headline KPI instead of a stock/sold/last-sale chip row — those
              three facts are itemised in the Performance card below, so the hero
              was repeating them. Profit is the number this page exists for. */}
          <S.ProfitHighlight $positive={profit >= 0}>
            <Text variant="caption" color="text.secondary" weight="medium">
              {t('listings.table.estimatedProfit')}
            </Text>
            <Text
              variant="metric"
              weight="semibold"
              color={profit >= 0 ? 'semantic.success' : 'semantic.error'}
            >
              {formatCurrency(profit)}
            </Text>
            <Text variant="body-sm" color="text.secondary">
              {t('listings.table.roi')}: {`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`}
            </Text>
          </S.ProfitHighlight>

          <S.QuickLinks>
            <Button variant="text" size="small" onClick={onOpenAmazon}>
              <Text variant="body-sm">{t('listings.detail.openAmazon')}</Text>
            </Button>
            {canOpenEbay ? (
              <Button variant="text" size="small" onClick={onOpenEbay}>
                <Text variant="body-sm">{t('listings.detail.openEbay')}</Text>
              </Button>
            ) : null}
          </S.QuickLinks>
        </S.HeroInfo>
      </S.Hero>

      <S.SectionGrid>
        <S.SectionCard variant="elevated" padding="lg">
          <S.CardHeader>
            <S.CardHeaderLeft>
              <Icon name="circle-dollar-sign" size={20} color="brand.primary" />
              <Text variant="h4" weight="semibold">
                {t('listings.detail.economics')}
              </Text>
            </S.CardHeaderLeft>
          </S.CardHeader>
          <S.MetaList>
            <Meta label={t('listings.table.price')}>
              <Text variant="body" weight="semibold">
                {formatCurrency(listing.price)}
              </Text>
            </Meta>
            <Meta label={t('listings.table.purchasePrice')}>
              <Text variant="body" weight="semibold">
                {formatCurrency(cost)}
              </Text>
            </Meta>
            {/* Profit and ROI are the hero headline — not repeated here. */}
            <Meta label={t('listings.table.profitMargin')}>
              <Text variant="body" weight="semibold">
                {`${margin.toFixed(1)}%`}
              </Text>
            </Meta>
          </S.MetaList>
        </S.SectionCard>

        <S.SectionCard variant="elevated" padding="lg">
          <S.CardHeader>
            <S.CardHeaderLeft>
              <Icon name="chart-line" size={20} color="brand.primary" />
              <Text variant="h4" weight="semibold">
                {t('listings.detail.performance')}
              </Text>
            </S.CardHeaderLeft>
          </S.CardHeader>
          <S.MetaList>
            <Meta label={t('listings.table.stock')}>
              <Text variant="body" weight="semibold">
                {listing.quantity}
              </Text>
            </Meta>
            <Meta label={t('listings.table.amazonStock')}>
              <Text variant="body" weight="semibold">
                {listing.sourceStock ?? '—'}
              </Text>
            </Meta>
            <Meta label={t('listings.table.sold')}>
              <Text variant="body" weight="semibold">
                {listing.soldCount ?? 0}
              </Text>
            </Meta>
            <Meta label={t('listings.table.watch')}>
              <Text variant="body" weight="semibold">
                {listing.watchCount ?? 0}
              </Text>
            </Meta>
            <Meta label={t('listings.table.views')}>
              <Text variant="body" weight="semibold">
                {listing.viewCount ?? 0}
              </Text>
            </Meta>
            <Meta label={t('listings.table.lastSale')}>
              <Text variant="body" weight="semibold">
                {listing.lastSaleAt ? formatDate(listing.lastSaleAt) : '—'}
              </Text>
            </Meta>
          </S.MetaList>
        </S.SectionCard>

        <S.SectionCardFull variant="elevated" padding="lg">
          <S.CardHeader>
            <S.CardHeaderLeft>
              <Icon name="bolt" size={20} color="brand.primary" />
              <Text variant="h4" weight="semibold">
                {t('listings.detail.automationTitle')}
              </Text>
            </S.CardHeaderLeft>
          </S.CardHeader>

          <S.AutomationBlock>
            <S.AutomationHeader>
              <Toggle
                checked={overrides.pauseSales}
                onChange={(checked) => onOverrideChange({ pauseSales: checked })}
                label={t('listings.detail.pauseSales')}
              />
              <Text variant="caption" color="text.secondary">
                {t('listings.detail.pauseSalesHint')}
              </Text>
            </S.AutomationHeader>
          </S.AutomationBlock>

          <S.AutomationBlock>
            <S.AutomationHeader>
              <Toggle
                checked={overrides.fixedPrice}
                onChange={(checked) => onOverrideChange({ fixedPrice: checked })}
                label={t('listings.detail.fixedPrice')}
              />
              <Text variant="caption" color="text.secondary">
                {t('listings.detail.fixedPriceHint')}
              </Text>
            </S.AutomationHeader>
            {overrides.fixedPrice ? (
              <S.AutomationFields>
                <TextInput
                  name="priceOverride"
                  label={t('listings.detail.priceOverride')}
                  value={overrides.priceOverride}
                  onChange={(e) => onOverrideChange({ priceOverride: e.target.value })}
                  type="number"
                  fullWidth
                />
              </S.AutomationFields>
            ) : null}
          </S.AutomationBlock>

          <S.AutomationBlock>
            <S.AutomationHeader>
              <Toggle
                checked={overrides.fixedQuantity}
                onChange={(checked) => onOverrideChange({ fixedQuantity: checked })}
                label={t('listings.detail.fixedQuantity')}
              />
              <Text variant="caption" color="text.secondary">
                {t('listings.detail.fixedQuantityHint')}
              </Text>
            </S.AutomationHeader>
            {overrides.fixedQuantity ? (
              <S.AutomationFields>
                <TextInput
                  name="quantityOverride"
                  label={t('listings.detail.quantityOverride')}
                  value={overrides.quantityOverride}
                  onChange={(e) => onOverrideChange({ quantityOverride: e.target.value })}
                  type="number"
                  fullWidth
                />
              </S.AutomationFields>
            ) : null}
          </S.AutomationBlock>

          {!overrides.fixedPrice ? (
            <S.AutomationBlock>
              <S.AutomationHeader>
                <Text variant="body-sm" weight="semibold">
                  {t('listings.detail.customMargin')}
                </Text>
                <Text variant="caption" color="text.secondary">
                  {t('listings.detail.customMarginHint')}
                </Text>
              </S.AutomationHeader>
              <S.AutomationFields>
                <TextInput
                  name="marginPercentOverride"
                  label={t('listings.detail.marginPercentOverride')}
                  value={overrides.marginPercentOverride}
                  onChange={(e) => onOverrideChange({ marginPercentOverride: e.target.value })}
                  type="number"
                  fullWidth
                />
                <TextInput
                  name="marginFixedOverride"
                  label={t('listings.detail.marginFixedOverride')}
                  value={overrides.marginFixedOverride}
                  onChange={(e) => onOverrideChange({ marginFixedOverride: e.target.value })}
                  type="number"
                  fullWidth
                />
              </S.AutomationFields>
            </S.AutomationBlock>
          ) : null}

          <Button variant="primary" onClick={onSaveOverrides} isLoading={isSavingOverrides}>
            <Text variant="body" weight="semibold">
              {t('listings.detail.saveOverrides')}
            </Text>
          </Button>
        </S.SectionCardFull>

        <S.SectionCard variant="elevated" padding="lg">
          <S.CardHeader>
            <S.CardHeaderLeft>
              <Icon name="settings" size={20} color="brand.primary" />
              <Text variant="h4" weight="semibold">
                {t('listings.detail.settings')}
              </Text>
            </S.CardHeaderLeft>
          </S.CardHeader>
          <S.MetaList>
            <Meta label={t('listings.listingSettings.strategyGroup')}>
              <Text variant="body" weight="semibold">
                {strategyGroupLabel}
              </Text>
            </Meta>
            <Meta label={t('listings.businessPolicies.paymentPolicy')}>
              <Text variant="body" weight="semibold">
                {paymentPolicyLabel}
              </Text>
            </Meta>
            <Meta label={t('listings.businessPolicies.shippingPolicy')}>
              <Text variant="body" weight="semibold">
                {shippingPolicyLabel}
              </Text>
            </Meta>
            <Meta label={t('listings.businessPolicies.returnPolicy')}>
              <Text variant="body" weight="semibold">
                {returnPolicyLabel}
              </Text>
            </Meta>
          </S.MetaList>
          <SettingsActionRow
            icon="edit"
            label={t('listings.detail.editConfig')}
            onClick={onOpenEditDrawer}
          />
        </S.SectionCard>

        <S.SectionCard variant="elevated" padding="lg">
          <S.CardHeader>
            <S.CardHeaderLeft>
              <Icon name="info" size={20} color="brand.primary" />
              <Text variant="h4" weight="semibold">
                {t('listings.detail.system')}
              </Text>
            </S.CardHeaderLeft>
          </S.CardHeader>
          <S.MetaList>
            <Meta label={t('listings.detail.listingId')}>
              <Text variant="body-sm" weight="semibold">
                {listing.id}
              </Text>
            </Meta>
            <Meta label={t('listings.detail.createdAt')}>
              <Text variant="body">{formatDate(listing.createdAt)}</Text>
            </Meta>
            <Meta label={t('listings.detail.updatedAt')}>
              <Text variant="body">{formatDate(listing.updatedAt)}</Text>
            </Meta>
          </S.MetaList>
        </S.SectionCard>

        <S.SectionCardFull variant="elevated" padding="lg">
          <S.CardHeader>
            <S.CardHeaderLeft>
              <Icon name="file-text" size={20} color="brand.primary" />
              <Text variant="h4" weight="semibold">
                {t('listings.detail.productContent')}
              </Text>
            </S.CardHeaderLeft>
          </S.CardHeader>

          <Text variant="body-sm" weight="semibold">
            {t('listings.detail.description')}
          </Text>
          {hasDescription ? (
            <S.DescriptionBody>
              <S.DescriptionText $expanded={descriptionExpanded || !descriptionLong}>
                {listing.description}
              </S.DescriptionText>
              {descriptionLong ? (
                <Button variant="text" size="small" onClick={onToggleDescription}>
                  <Text variant="body-sm" weight="semibold" color="brand.primary">
                    {descriptionExpanded
                      ? t('listings.detail.showLess')
                      : t('listings.detail.showMore')}
                  </Text>
                </Button>
              ) : null}
            </S.DescriptionBody>
          ) : (
            <Text variant="body-sm" color="text.secondary">
              {t('listings.detail.descriptionEmpty')}
            </Text>
          )}

          <Text variant="body-sm" weight="semibold">
            {t('listings.detail.features')}
          </Text>
          {features.length > 0 ? (
            <S.FeatureList>
              {features.map((f) => (
                <S.FeatureItem key={f}>{f}</S.FeatureItem>
              ))}
            </S.FeatureList>
          ) : (
            <Text variant="body-sm" color="text.secondary">
              {t('listings.detail.featuresEmpty')}
            </Text>
          )}

          <Text variant="body-sm" weight="semibold">
            {t('listings.detail.specs')}
          </Text>
          {specEntries.length > 0 ? (
            <S.MetaList>
              {specEntries.map(([key, value]) => (
                <Meta key={key} label={key}>
                  <Text variant="body" weight="semibold">
                    {value}
                  </Text>
                </Meta>
              ))}
            </S.MetaList>
          ) : (
            <Text variant="body-sm" color="text.secondary">
              {t('listings.detail.specsEmpty')}
            </Text>
          )}
        </S.SectionCardFull>
      </S.SectionGrid>

      <S.MobileActionBar>
        <Button variant="primary" size="medium" onClick={onManage} fullWidth>
          <Text variant="body" weight="semibold">
            {t('listings.detail.manage')}
          </Text>
        </Button>
      </S.MobileActionBar>

      <Drawer
        isOpen={isEditDrawerOpen}
        onClose={onCloseEditDrawer}
        title={t('listings.detail.editDrawerTitle')}
        subtitle={t('listings.detail.editDrawerSubtitle')}
        size="md"
        primaryAction={{
          label: t('translation:common.save'),
          onClick: onSave,
          isLoading: isSaving,
        }}
      >
        <S.FormStack>
          <ModernTextInput<UpdateListingFormData>
            name="title"
            control={control}
            label={t('listings.detail.titleField')}
            fullWidth
          />
          <ModernSelect<UpdateListingFormData>
            name="listingSettingsGroupId"
            control={control}
            label={t('listings.listingSettings.strategyGroup')}
            options={listingSettingsGroups.map((g) => ({ label: g.name, value: g.id }))}
            fullWidth
            searchPlaceholder={t('translation:common.search')}
            noResultsMessage={t('translation:common.noResults')}
          />
          <ModernSelect<UpdateListingFormData>
            name="paymentPolicyId"
            control={control}
            label={t('listings.businessPolicies.paymentPolicy')}
            options={businessPolicies.payment.map((p) => ({ label: p.name, value: p.id }))}
            fullWidth
            searchPlaceholder={t('translation:common.search')}
            noResultsMessage={t('translation:common.noResults')}
          />
          <ModernSelect<UpdateListingFormData>
            name="shippingPolicyId"
            control={control}
            label={t('listings.businessPolicies.shippingPolicy')}
            options={businessPolicies.shipping.map((p) => ({ label: p.name, value: p.id }))}
            fullWidth
            searchPlaceholder={t('translation:common.search')}
            noResultsMessage={t('translation:common.noResults')}
          />
          <ModernSelect<UpdateListingFormData>
            name="returnPolicyId"
            control={control}
            label={t('listings.businessPolicies.returnPolicy')}
            options={businessPolicies.return.map((p) => ({ label: p.name, value: p.id }))}
            fullWidth
            searchPlaceholder={t('translation:common.search')}
            noResultsMessage={t('translation:common.noResults')}
          />
        </S.FormStack>
      </Drawer>
    </S.Container>
  );
};
