import { Icon, InfoMessage, ModernSelect, ModernTextInput, SegmentedControl, Text, Toggle, Tooltip } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ColdListingMode, type ListingRulesStepProps } from '../ListingGroupDrawer.types';

import {
  BodyStack,
  Field,
  FieldGroup,
  FormCard,
  InfoButton,
  LabelWithInfo,
  PriceRow,
  ToggleRow,
} from './ListingRulesStep.style';

/** Label text plus an "i" that reveals the rule's explanation on hover/focus. */
const InfoTip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip content={text} position="top" variant="dark">
    <InfoButton type="button" variant="ghost" aria-label={text}>
      <Icon name="info" size={14} color="text.tertiary" />
    </InfoButton>
  </Tooltip>
);

/** What this group refuses to list and when it ends a listing. */
export const ListingRulesStep: React.FC<ListingRulesStepProps> = (props) => {
  const { t } = useTranslation(['listingSettingsGroup', 'translation']);
  const k = (key: string): string => t(`listingSettingsGroup.rules.${key}`);
  const { draft, onChange } = props;

  return (
    <BodyStack>
      <InfoMessage>{k('subtitle')}</InfoMessage>

      <FormCard>
        <Text variant="h5">{k('brand.title')}</Text>
        <ToggleRow>
          <LabelWithInfo>
            <Text variant="body-sm">{k('brand.vero')}</Text>
            <InfoTip text={k('brand.veroHint')} />
          </LabelWithInfo>
          <Toggle
            checked={draft.veroProtectionEnabled}
            onChange={(enabled) => onChange({ veroProtectionEnabled: enabled })}
            ariaLabel={k('brand.vero')}
          />
        </ToggleRow>
        {!draft.veroProtectionEnabled && <InfoMessage type="warning">{k('brand.veroOffWarning')}</InfoMessage>}
        <ToggleRow>
          <LabelWithInfo>
            <Text variant="body-sm">{k('brand.hideBrand')}</Text>
            <InfoTip text={k('brand.hideBrandHint')} />
          </LabelWithInfo>
          <Toggle
            checked={draft.hideBrand}
            onChange={(enabled) => onChange({ hideBrand: enabled })}
            ariaLabel={k('brand.hideBrand')}
          />
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
              value={draft.minPrice}
              onChange={(e) => onChange({ minPrice: e.target.value })}
              fullWidth
            />
            <ModernTextInput
              name="maxSourcePrice"
              type="number"
              label={k('filters.maxPrice')}
              value={draft.maxPrice}
              onChange={(e) => onChange({ maxPrice: e.target.value })}
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
            checked={draft.amazonShippedOnly}
            onChange={(enabled) => onChange({ amazonShippedOnly: enabled })}
            ariaLabel={k('filters.amazonShippedOnly')}
          />
        </ToggleRow>
        <FieldGroup>
          <ModernTextInput
            name="minRating"
            type="text"
            label={k('filters.minRating')}
            value={draft.minRating}
            onChange={(e) => onChange({ minRating: e.target.value })}
            errorMessage={props.minRatingError}
            maxLength={4}
            fullWidth
          />
          <Text variant="caption" color="text.tertiary">
            {k('filters.minRatingHint')}
          </Text>
        </FieldGroup>
        <ModernTextInput
          name="minReviewCount"
          type="number"
          label={k('filters.minReviewCount')}
          value={draft.minReviewCount}
          onChange={(e) => onChange({ minReviewCount: e.target.value })}
          fullWidth
        />
        <Text variant="caption" color="text.tertiary">
          {k('filters.ratingHint')}
        </Text>
      </FormCard>

      <FormCard>
        <Text variant="h5">{k('cleanup.title')}</Text>
        <ModernSelect
          name="outOfStockEndDays"
          label={k('cleanup.outOfStock')}
          options={props.outOfStockOptions}
          value={draft.outOfStockEndDays}
          onChange={(value) => onChange({ outOfStockEndDays: String(value) })}
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
            checked={draft.coldListingEnabled}
            onChange={(enabled) => onChange({ coldListingEnabled: enabled })}
            ariaLabel={k('cleanup.cold')}
          />
        </ToggleRow>
        {draft.coldListingEnabled && (
          <>
            <ModernTextInput
              name="coldListingDays"
              type="number"
              label={k('cleanup.coldDays')}
              value={draft.coldListingDays}
              onChange={(e) => onChange({ coldListingDays: e.target.value })}
              errorMessage={props.coldListingDaysError}
              fullWidth
            />
            <Field>
              <Text variant="body-sm">{k('cleanup.coldMode')}</Text>
              <SegmentedControl
                options={props.coldListingModeOptions}
                value={draft.coldListingMode}
                onChange={(value) =>
                  onChange({
                    coldListingMode: value === String(ColdListingMode.END) ? ColdListingMode.END : ColdListingMode.FLAG,
                  })
                }
                size="sm"
              />
            </Field>
            {draft.coldListingMode === ColdListingMode.END && (
              <InfoMessage type="warning">{k('cleanup.coldEndWarning')}</InfoMessage>
            )}
          </>
        )}
      </FormCard>
    </BodyStack>
  );
};

ListingRulesStep.displayName = 'ListingRulesStep';
