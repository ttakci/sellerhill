import { ListingStatus, type UpdateListingFormData } from '@repo/shared';
import {
  Badge,
  Button,
  Drawer,
  EmptyState,
  Icon,
  IconButton,
  IconName,
  IdBadge,
  InfoMessage,
  ModernSelect,
  PageHeader,
  SettingsCard,
  SettingsInfoRow,
  Text,
  Textarea,
  TextInput,
  Toggle,
} from '@repo/ui';
import type { TFunction } from 'i18next';
import React from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import * as S from './ListingDetailPage.style';
import type { AutomationRuleState, ListingDetailPageProps } from './ListingDetailPage.types';
import { ListingRevisionsDrawer } from './ListingRevisionsDrawer';

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
  icon,
  iconColor = 'brand.primary',
  label,
  children,
}: {
  icon: IconName;
  iconColor?: string;
  label: string;
  children: React.ReactNode;
}): React.ReactElement => (
  <S.MetaRow>
    <S.MetaLabel>
      <Icon name={icon} size={16} color={iconColor} />
      <Text variant="body-sm" color="text.secondary">
        {label}
      </Text>
    </S.MetaLabel>
    <S.MetaValue>{children}</S.MetaValue>
  </S.MetaRow>
);

/** Otomasyon Durumu row color — green once a rule is actually applying,
 *  muted once it's off or moot ("na"), so the eye finds the active rules
 *  first without needing a filled badge to carry that signal. */
const automationStateColor = (state: AutomationRuleState): string => {
  switch (state) {
    case 'on':
      return 'semantic.success';
    case 'na':
      return 'text.tertiary';
    case 'off':
    default:
      return 'text.secondary';
  }
};

const automationStateLabel = (state: AutomationRuleState, t: TFunction): string => {
  switch (state) {
    case 'on':
      return t('listings.detail.automationBadgeActive');
    case 'na':
      return t('listings.detail.customMarginNaLabel');
    case 'off':
    default:
      return t('listings.detail.automationBadgeOff');
  }
};

/** One headline number in the hero strip. Only profit passes a `tone`. */
const Kpi = ({
  label,
  value,
  color = 'text.primary',
}: {
  label: string;
  value: string;
  color?: string;
}): React.ReactElement => (
  <S.KpiItem>
    <S.KpiLabel variant="caption" color="text.tertiary">
      {label}
    </S.KpiLabel>
    <Text variant="metric-sm" weight="semibold" numeric color={color}>
      {value}
    </Text>
  </S.KpiItem>
);

export const ListingDetailPageComponent: React.FC<ListingDetailPageProps> = ({
  listing,
  isLoading,
  isSaving,
  isSavingOverrides,
  form,
  listingSettingsGroups,
  strategyGroupLabel,
  groupDefaultQuantityLabel,
  groupStockBufferLabel,
  groupMarginSummaryLabel,
  paymentPolicyLabel,
  shippingPolicyLabel,
  returnPolicyLabel,
  selectedImageIndex,
  onSelectImage,
  descriptionExpanded,
  onToggleDescription,
  isTitleDrawerOpen,
  onOpenTitleDrawer,
  onCloseTitleDrawer,
  isAutomationDrawerOpen,
  onOpenAutomationDrawer,
  onCloseAutomationDrawer,
  overrides,
  onOverrideChange,
  onSaveOverrides,
  automationStatusItems,
  formatCurrency,
  formatDate,
  formatDateTime,
  onBack,
  onSave,
  onPublish,
  onManage,
  isRevisionsDrawerOpen,
  hasRevisions,
  onOpenRevisions,
  onCloseRevisions,
  canPublish,
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
      {/* The page is titled by what it IS, not by its subject. The product title
          used to be the h1 — so every listing produced a different page name,
          the breadcrumb ("Liste Detayı") disagreed with the heading under it,
          and a 200-character Amazon title became a three-line page header. It
          now heads the hero card, where it belongs to the product. */}
      <PageHeader
        title={t('listings.detail.breadcrumb')}
        subtitle={
          listing.status === ListingStatus.DRAFT ? t('listings.detail.draftBanner') : t('listings.detail.subtitle')
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
        <S.StatusBadgeSlot>
          <Badge variant={statusVariant(listing.status)} size="sm">
            {statusLabel}
          </Badge>
        </S.StatusBadgeSlot>

        <S.GalleryBlock>
          <S.GalleryMain>
            {mainImage ? <img src={mainImage} alt={listing.title} /> : <Icon name="image" size={48} />}
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
          <S.TitleRow>
            <S.TitleHeadingRow>
              <S.ProductTitle variant="h3" weight="semibold">
                {listing.title || listing.asin}
              </S.ProductTitle>
              <IconButton
                variant="ghost"
                onClick={onOpenTitleDrawer}
                aria-label={t('listings.detail.titleDrawerTitle')}
              >
                <Icon name="edit" size={16} color="brand.primary" />
              </IconButton>
            </S.TitleHeadingRow>
            <S.BadgeRow>
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

          {/* Labelled and stacked, like the listing card's meta rows. A bare row
              of two badges did not say WHICH marketplace each id belonged to,
              which is why the page also carried "open on Amazon / eBay" text
              buttons underneath — those were a second copy of these same two
              links (IdBadge is itself an external anchor) and are now gone.

              The internal id and the created/updated timestamps join them here
              rather than in a card of their own at the foot of the page: they
              are the same kind of fact (what this record IS, not how it is
              performing), and a whole full-width card for three read-only
              strings was more chrome than they are worth. */}
          <S.IdList>
            <S.IdItem>
              <Text variant="caption" color="text.secondary" weight="medium">
                {t('listings.table.asin')}
              </Text>
              <IdBadge id={listing.asin} storeType="amazon" size="sm" />
            </S.IdItem>
            {listing.ebayListingId ? (
              <S.IdItem>
                <Text variant="caption" color="text.secondary" weight="medium">
                  {t('listings.table.ebayId')}
                </Text>
                <IdBadge id={listing.ebayListingId} storeType="ebay" size="sm" />
              </S.IdItem>
            ) : null}
            <S.IdItem>
              <Text variant="caption" color="text.secondary" weight="medium">
                {t('listings.detail.listingId')}
              </Text>
              <S.IdValue variant="body-sm">{listing.id}</S.IdValue>
            </S.IdItem>
            <S.IdItem>
              <Text variant="caption" color="text.secondary" weight="medium">
                {t('listings.detail.createdAt')}
              </Text>
              <Text variant="body-sm" numeric>
                {formatDateTime(listing.createdAt)}
              </Text>
            </S.IdItem>
            <S.IdItem>
              <Text variant="caption" color="text.secondary" weight="medium">
                {t('listings.detail.updatedAt')}
              </Text>
              <S.UpdatedValueRow>
                <Text variant="body-sm" numeric>
                  {formatDateTime(listing.updatedAt)}
                </Text>
                {hasRevisions ? (
                  <Button variant="text" size="small" onClick={onOpenRevisions}>
                    <Text variant="body-sm" weight="medium" color="brand.primary">
                      {t('listings.detail.revisions.action')}
                    </Text>
                  </Button>
                ) : null}
              </S.UpdatedValueRow>
            </S.IdItem>
          </S.IdList>

          {/* The whole money story in one strip. It absorbed the old standalone
              "price & profit" card, whose three values were a second, quieter
              copy of these — one of them (margin) literally the same number. */}
          <S.KpiStrip>
            <Kpi
              label={t('listings.table.estimatedProfit')}
              value={formatCurrency(profit)}
              color={profit >= 0 ? 'semantic.success' : 'semantic.error'}
            />
            <Kpi label={t('listings.table.roi')} value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`} />
            <Kpi label={t('listings.table.price')} value={formatCurrency(listing.price)} />
            <Kpi label={t('listings.table.purchasePrice')} value={formatCurrency(cost)} />
            <Kpi label={t('listings.table.profitMargin')} value={`${margin.toFixed(1)}%`} />
          </S.KpiStrip>
        </S.HeroInfo>
      </S.Hero>

      <S.SectionGrid>
        <SettingsCard variant="section" header={{ title: t('listings.detail.performance') }}>
          <S.MetaList>
            <Meta icon="box" label={t('listings.table.stock')}>
              <Text variant="body" weight="semibold" numeric>
                {listing.quantity}
              </Text>
            </Meta>
            <Meta icon="shopping-bag" label={t('listings.table.amazonStock')}>
              <Text variant="body" weight="semibold" numeric>
                {listing.sourceStock ?? '—'}
              </Text>
            </Meta>
            <Meta icon="shopping-cart" label={t('listings.table.sold')}>
              <Text variant="body" weight="semibold" numeric>
                {listing.soldCount ?? 0}
              </Text>
            </Meta>
            <Meta icon="clock" label={t('listings.table.lastSale')}>
              <Text variant="body" weight="semibold">
                {listing.lastSaleAt ? formatDate(listing.lastSaleAt) : '—'}
              </Text>
            </Meta>
          </S.MetaList>
        </SettingsCard>

        {/* Read-only — reassigning a policy here is not pushed to eBay's
            offer yet, so this card only shows what's currently attached. */}
        <SettingsCard variant="section" header={{ title: t('listings.detail.ebayPolicies') }}>
          <SettingsInfoRow
            icon="payments"
            label={t('listings.businessPolicies.paymentPolicy')}
            value={paymentPolicyLabel}
          />
          <SettingsInfoRow
            icon="truck"
            label={t('listings.businessPolicies.shippingPolicy')}
            value={shippingPolicyLabel}
          />
          <SettingsInfoRow
            icon="undo-2"
            label={t('listings.businessPolicies.returnPolicy')}
            value={returnPolicyLabel}
          />
        </SettingsCard>

        {/* Same compact fact-grid pattern as Performance — the group's own
            settings, not just its name. Edit lives in the header now that the
            body is plain facts, same drawer as the Otomasyon Durumu card. */}
        <SettingsCard
          variant="section"
          header={{ title: t('listings.detail.strategyGroupCardTitle') }}
          headerRight={
            <IconButton
              variant="ghost"
              onClick={onOpenAutomationDrawer}
              aria-label={t('listings.detail.automationDrawerTitle')}
            >
              <Icon name="edit" size={16} color="brand.primary" />
            </IconButton>
          }
        >
          <S.MetaList>
            <Meta icon="layers" label={t('listings.detail.groupNameLabel')}>
              <Text variant="body" weight="semibold">
                {strategyGroupLabel}
              </Text>
            </Meta>
            <Meta icon="box" label={t('listings.detail.groupDefaultQuantityLabel')}>
              <Text variant="body" weight="semibold" numeric>
                {groupDefaultQuantityLabel}
              </Text>
            </Meta>
            <Meta icon="sliders-horizontal" label={t('listings.detail.groupStockBufferLabel')}>
              <Text variant="body" weight="semibold" numeric>
                {groupStockBufferLabel}
              </Text>
            </Meta>
            <Meta icon="badge-percent" label={t('listings.detail.groupMarginLabel')}>
              <Text variant="body" weight="semibold">
                {groupMarginSummaryLabel}
              </Text>
            </Meta>
          </S.MetaList>
        </SettingsCard>

        {/* Strategy group + automation overrides feed the same price/quantity
            computation, so they're edited together in one drawer — same
            headerRight edit action as the group card above. Each row is a
            plain fact (state + the value it applies), not a filled box. */}
        <SettingsCard
          variant="section"
          header={{ title: t('listings.detail.automationStatus') }}
          headerRight={
            <IconButton
              variant="ghost"
              onClick={onOpenAutomationDrawer}
              aria-label={t('listings.detail.automationDrawerTitle')}
            >
              <Icon name="edit" size={16} color="brand.primary" />
            </IconButton>
          }
        >
          <S.MetaList>
            {automationStatusItems.map((item) => (
              <Meta key={item.key} icon={item.icon} iconColor={automationStateColor(item.state)} label={item.label}>
                <Text variant="body" weight="semibold" color={automationStateColor(item.state)}>
                  {automationStateLabel(item.state, t)}
                </Text>
                {item.detail ? (
                  <Text variant="caption" color="text.secondary">
                    {item.detail}
                  </Text>
                ) : null}
              </Meta>
            ))}
          </S.MetaList>

          <S.AutomationSyncNoteSlot>
            <InfoMessage>{t('listings.detail.automationSyncNote')}</InfoMessage>
          </S.AutomationSyncNoteSlot>
        </SettingsCard>

        <S.FullWidthSettingsCard variant="section" header={{ title: t('listings.detail.productContent') }}>
          <S.ProductContentStack>
            {hasDescription && (
              <S.ProductContentBlock>
                <Text variant="body-sm" weight="semibold">
                  {t('listings.detail.description')}
                </Text>
                <S.DescriptionBody>
                  <S.DescriptionText $expanded={descriptionExpanded || !descriptionLong}>
                    {listing.description}
                  </S.DescriptionText>
                  {descriptionLong ? (
                    <Button variant="text" size="small" onClick={onToggleDescription}>
                      <Text variant="body-sm" weight="semibold" color="brand.primary">
                        {descriptionExpanded ? t('listings.detail.showLess') : t('listings.detail.showMore')}
                      </Text>
                    </Button>
                  ) : null}
                </S.DescriptionBody>
              </S.ProductContentBlock>
            )}

            {features.length > 0 && (
              <S.ProductContentBlock>
                <Text variant="body-sm" weight="semibold">
                  {t('listings.detail.features')}
                </Text>
                <S.FeatureList>
                  {features.map((f) => (
                    <S.FeatureItem key={f}>{f}</S.FeatureItem>
                  ))}
                </S.FeatureList>
              </S.ProductContentBlock>
            )}

            {specEntries.length > 0 && (
              <S.ProductContentBlock>
                <Text variant="body-sm" weight="semibold">
                  {t('listings.detail.specs')}
                </Text>
                <S.SpecList>
                  {specEntries.map(([key, value]) => (
                    <S.SpecRow key={key}>
                      <Text variant="caption" color="text.secondary" weight="medium">
                        {key}
                      </Text>
                      <Text variant="body-sm" weight="semibold">
                        {value}
                      </Text>
                    </S.SpecRow>
                  ))}
                </S.SpecList>
              </S.ProductContentBlock>
            )}
          </S.ProductContentStack>
        </S.FullWidthSettingsCard>
      </S.SectionGrid>

      <S.MobileActionBar>
        <Button variant="primary" size="medium" onClick={onManage} fullWidth>
          <Text variant="body" weight="semibold">
            {t('listings.detail.manage')}
          </Text>
        </Button>
      </S.MobileActionBar>

      <Drawer
        isOpen={isTitleDrawerOpen}
        onClose={onCloseTitleDrawer}
        title={t('listings.detail.titleDrawerTitle')}
        subtitle={t('listings.detail.titleDrawerSubtitle')}
        size="md"
        primaryAction={{
          label: t('translation:common.save'),
          onClick: onSave,
          isLoading: isSaving,
        }}
      >
        <S.FormStack>
          <Text variant="body-sm" weight="semibold">
            {t('listings.detail.titleField')}
          </Text>
          <Controller<UpdateListingFormData>
            name="title"
            control={control}
            render={({ field }) => <Textarea {...field} rows={3} fullWidth />}
          />
        </S.FormStack>
      </Drawer>

      <Drawer
        isOpen={isAutomationDrawerOpen}
        onClose={onCloseAutomationDrawer}
        title={t('listings.detail.automationDrawerTitle')}
        subtitle={t('listings.detail.automationDrawerSubtitle')}
        size="md"
        primaryAction={{
          label: t('listings.detail.saveOverrides'),
          onClick: onSaveOverrides,
          isLoading: isSavingOverrides,
        }}
      >
        <S.SectionContent>
          <ModernSelect<UpdateListingFormData>
            name="listingSettingsGroupId"
            control={control}
            label={t('listings.listingSettings.strategyGroup')}
            options={listingSettingsGroups.map((g) => ({ label: g.name, value: g.id }))}
            fullWidth
            searchPlaceholder={t('translation:common.search')}
            noResultsMessage={t('translation:common.noResults')}
          />

          <S.AutomationBlockList>
            <S.AutomationBlock>
              <S.ToggleRow>
                <Text variant="body-sm" weight="semibold">
                  {t('listings.detail.pauseSales')}
                </Text>
                <Toggle
                  checked={overrides.pauseSales}
                  onChange={(checked) => onOverrideChange({ pauseSales: checked })}
                />
              </S.ToggleRow>
              <Text variant="caption" color="text.secondary">
                {t('listings.detail.pauseSalesHint')}
              </Text>
            </S.AutomationBlock>

            <S.AutomationBlock>
              <S.ToggleRow>
                <Text variant="body-sm" weight="semibold">
                  {t('listings.detail.fixedPrice')}
                </Text>
                <Toggle
                  checked={overrides.fixedPrice}
                  onChange={(checked) => onOverrideChange({ fixedPrice: checked })}
                />
              </S.ToggleRow>
              <Text variant="caption" color="text.secondary">
                {t('listings.detail.fixedPriceHint')}
              </Text>
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
              <S.ToggleRow>
                <Text variant="body-sm" weight="semibold">
                  {t('listings.detail.fixedQuantity')}
                </Text>
                <Toggle
                  checked={overrides.fixedQuantity}
                  onChange={(checked) => onOverrideChange({ fixedQuantity: checked })}
                />
              </S.ToggleRow>
              <Text variant="caption" color="text.secondary">
                {t('listings.detail.fixedQuantityHint')}
              </Text>
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
                <S.MarginFields>
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
                </S.MarginFields>
              </S.AutomationBlock>
            ) : null}
          </S.AutomationBlockList>
        </S.SectionContent>
      </Drawer>

      <ListingRevisionsDrawer
        isOpen={isRevisionsDrawerOpen}
        onClose={onCloseRevisions}
        listingId={listing.id}
        currency={listing.currency}
      />
    </S.Container>
  );
};
