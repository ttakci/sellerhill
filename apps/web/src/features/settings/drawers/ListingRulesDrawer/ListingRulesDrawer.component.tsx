import {
  Drawer,
  Icon,
  InfoMessage,
  ModernSelect,
  ModernTextInput,
  SegmentedControl,
  Text,
  Textarea,
  Toggle,
  Tooltip,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  BodyStack,
  Field,
  FieldGroup,
  FormCard,
  InfoButton,
  LabelWithInfo,
  PriceRow,
  ToggleRow,
} from './ListingRulesDrawer.style';
import { ColdListingMode, type ListingRulesDrawerComponentProps } from './ListingRulesDrawer.types';

/** Label text plus an "i" that reveals the rule's explanation on hover/focus. */
const InfoTip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip content={text} position="top" variant="dark">
    <InfoButton type="button" variant="ghost" aria-label={text}>
      <Icon name="info" size={14} color="text.tertiary" />
    </InfoButton>
  </Tooltip>
);

export const ListingRulesDrawerComponent: React.FC<ListingRulesDrawerComponentProps> = (props) => {
  const { t } = useTranslation(['storeSettings', 'translation']);
  const k = (key: string): string => t(`storeSettings:storeSettings.listingRules.${key}`);

  return (
    <Drawer
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={k('title')}
      subtitle={k('subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: props.onSave,
        isLoading: props.isSaving,
      }}
    >
      <BodyStack>
        <FormCard>
          <ModernSelect
            label={t('translation:settingsHub.drawer.storeSettings.appliesTo')}
            options={props.scopeOptions}
            value={props.selectedScope}
            onChange={(value) => props.onSelectScope(String(value))}
            fullWidth
            searchPlaceholder={t('translation:common.search')}
            noResultsMessage={t('translation:common.noResults')}
          />
        </FormCard>

        <FormCard>
          <Text variant="h5">{k('brand.title')}</Text>
          <ToggleRow>
            <LabelWithInfo>
              <Text variant="body-sm">{k('brand.vero')}</Text>
              <InfoTip text={k('brand.veroHint')} />
            </LabelWithInfo>
            <Toggle
              checked={props.veroProtectionEnabled}
              onChange={props.onVeroProtectionChange}
              ariaLabel={k('brand.vero')}
            />
          </ToggleRow>
          {!props.veroProtectionEnabled && <InfoMessage type="warning">{k('brand.veroOffWarning')}</InfoMessage>}
          <ToggleRow>
            <LabelWithInfo>
              <Text variant="body-sm">{k('brand.hideBrand')}</Text>
              <InfoTip text={k('brand.hideBrandHint')} />
            </LabelWithInfo>
            <Toggle checked={props.hideBrand} onChange={props.onHideBrandChange} ariaLabel={k('brand.hideBrand')} />
          </ToggleRow>
        </FormCard>

        <FormCard>
          <Text variant="h5">{k('filters.title')}</Text>
          <FieldGroup>
            <PriceRow>
              <ModernTextInput
                name="minSourcePrice"
                type="number"
                label={k('filters.minPrice')}
                value={props.minPrice}
                onChange={props.onMinPriceChange}
                fullWidth
              />
              <ModernTextInput
                name="maxSourcePrice"
                type="number"
                label={k('filters.maxPrice')}
                value={props.maxPrice}
                onChange={props.onMaxPriceChange}
                errorMessage={props.priceError}
                fullWidth
              />
            </PriceRow>
            <Text variant="caption" color="text.tertiary">
              {k('filters.priceHint')}
            </Text>
          </FieldGroup>
          <ToggleRow>
            <LabelWithInfo>
              <Text variant="body-sm">{k('filters.amazonShippedOnly')}</Text>
              <InfoTip text={k('filters.amazonShippedOnlyHint')} />
            </LabelWithInfo>
            <Toggle
              checked={props.amazonShippedOnly}
              onChange={props.onAmazonShippedOnlyChange}
              ariaLabel={k('filters.amazonShippedOnly')}
            />
          </ToggleRow>
          <ModernSelect
            name="minRating"
            label={k('filters.minRating')}
            options={props.ratingOptions}
            value={props.minRating}
            onChange={(value) => props.onMinRatingChange(String(value))}
            fullWidth
          />
          <ModernTextInput
            name="minReviewCount"
            type="number"
            label={k('filters.minReviewCount')}
            value={props.minReviewCount}
            onChange={props.onMinReviewCountChange}
            fullWidth
          />
          <Text variant="caption" color="text.tertiary">
            {k('filters.ratingHint')}
          </Text>
        </FormCard>

        <FormCard>
          <Text variant="h5">{k('blockedAsins.title')}</Text>
          <Textarea
            value={props.blockedAsins}
            onChange={props.onBlockedAsinsChange}
            placeholder={k('blockedAsins.placeholder')}
            fullWidth
            rows={4}
            mono
            aria-label={k('blockedAsins.title')}
          />
          <Text variant="caption" color="text.tertiary">
            {t('storeSettings:storeSettings.listingRules.blockedAsins.count', { count: props.blockedAsinCount })}
          </Text>
        </FormCard>

        <FormCard>
          <Text variant="h5">{k('cleanup.title')}</Text>
          <ModernSelect
            name="outOfStockEndDays"
            label={k('cleanup.outOfStock')}
            options={props.outOfStockOptions}
            value={props.outOfStockEndDays}
            onChange={(value) => props.onOutOfStockEndDaysChange(String(value))}
            fullWidth
          />
          <Text variant="caption" color="text.tertiary">
            {k('cleanup.outOfStockHint')}
          </Text>
          <ToggleRow>
            <LabelWithInfo>
              <Text variant="body-sm">{k('cleanup.cold')}</Text>
              <InfoTip text={k('cleanup.coldHint')} />
            </LabelWithInfo>
            <Toggle
              checked={props.coldListingEnabled}
              onChange={props.onColdListingEnabledChange}
              ariaLabel={k('cleanup.cold')}
            />
          </ToggleRow>
          {props.coldListingEnabled && (
            <>
              <ModernTextInput
                name="coldListingDays"
                type="number"
                label={k('cleanup.coldDays')}
                value={props.coldListingDays}
                onChange={props.onColdListingDaysChange}
                errorMessage={props.coldListingDaysError}
                fullWidth
              />
              <Field>
                <Text variant="body-sm">{k('cleanup.coldMode')}</Text>
                <SegmentedControl
                  options={props.coldListingModeOptions}
                  value={props.coldListingMode}
                  onChange={props.onColdListingModeChange}
                  size="sm"
                />
              </Field>
              {props.coldListingMode === ColdListingMode.END && (
                <InfoMessage type="warning">{k('cleanup.coldEndWarning')}</InfoMessage>
              )}
            </>
          )}
        </FormCard>

        <FormCard>
          <Text variant="h5">{k('promoted.title')}</Text>
          <ToggleRow>
            <LabelWithInfo>
              <Text variant="body-sm">{k('promoted.enable')}</Text>
              <InfoTip text={k('promoted.enableHint')} />
            </LabelWithInfo>
            <Toggle
              checked={props.promotedEnabled}
              onChange={props.onPromotedEnabledChange}
              ariaLabel={k('promoted.enable')}
            />
          </ToggleRow>
          {props.promotedEnabled && (
            <>
              <ModernTextInput
                name="promotedAdRate"
                type="number"
                label={k('promoted.rate')}
                value={props.promotedAdRate}
                onChange={props.onPromotedAdRateChange}
                errorMessage={props.promotedAdRateError}
                fullWidth
              />
              <Text variant="caption" color="text.tertiary">
                {k('promoted.rateHint')}
              </Text>
              {props.promotedIneligibleMessage && (
                <InfoMessage type="warning">{props.promotedIneligibleMessage}</InfoMessage>
              )}
            </>
          )}
        </FormCard>
      </BodyStack>
    </Drawer>
  );
};

ListingRulesDrawerComponent.displayName = 'ListingRulesDrawerComponent';
