import {
  COLD_LISTING_MIN_DAYS,
  DEFAULT_COLD_LISTING_DAYS,
  DEFAULT_PROMOTED_AD_RATE,
  LISTING_CLEANUP_MAX_DAYS,
  PROMOTED_AD_RATE_MAX,
  PROMOTED_AD_RATE_MIN,
  parseBlockedAsins,
  resolveListingRules,
  type ListingRulesConfig,
} from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { notifyDrawerDone } from '../shared/notifyDrawerDone';
import { GLOBAL_SCOPE, buildScopeOptions, resolveScopeConfig } from '../storeScope';

import { ListingRulesDrawerComponent } from './ListingRulesDrawer.component';
import {
  ColdListingMode,
  type ListingRulesDraft,
  type ListingRulesDrawerProps,
} from './ListingRulesDrawer.types';

import { useGetEbayAdvertisingEligibilityQuery } from '@/features/ebay/api/ebayApi';
import { useSaveStoreSettingsMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

const NONE = '';
const RATING_CHOICES = ['3', '3.5', '4', '4.5'];
const OUT_OF_STOCK_CHOICES = ['3', '7', '14', '30', '60'];

/** A number input's text → a positive number, or null for blank / unusable. */
const toPositiveNumber = (text: string): number | null => {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null;
};

const numberToText = (value: number | null): string => (value === null ? NONE : String(value));

const toDraft = (rules: ListingRulesConfig): ListingRulesDraft => ({
  veroProtectionEnabled: rules.veroProtectionEnabled,
  hideBrand: rules.hideBrand,
  minPrice: numberToText(rules.minSourcePrice),
  maxPrice: numberToText(rules.maxSourcePrice),
  amazonShippedOnly: rules.amazonShippedOnly,
  minRating: numberToText(rules.minRating),
  minReviewCount: numberToText(rules.minReviewCount),
  blockedAsins: rules.blockedAsins.join('\n'),
  outOfStockEndDays: numberToText(rules.outOfStockEndDays),
  coldListingEnabled: rules.coldListingDays !== null,
  coldListingDays: String(rules.coldListingDays ?? DEFAULT_COLD_LISTING_DAYS),
  coldListingMode: rules.coldListingAutoEnd ? ColdListingMode.END : ColdListingMode.FLAG,
  promotedEnabled: rules.promotedAdRate !== null,
  promotedAdRate: String(rules.promotedAdRate ?? DEFAULT_PROMOTED_AD_RATE),
});

/** eBay's status when a store may not advertise (the one value observed live). */
const EBAY_INELIGIBLE = 'INELIGIBLE';
/** eBay reasons this app has copy for; any other reason shows the generic sentence. */
const KNOWN_INELIGIBLE_REASONS = ['NOT_ENOUGH_ACTIVITY'];

export const ListingRulesDrawer: React.FC<ListingRulesDrawerProps> = ({
  isOpen,
  onClose,
  availableStores,
  storeConfigs,
  selectedScope,
  onSelectScope,
}) => {
  const { t } = useTranslation(['storeSettings', 'translation']);
  const { showMessage, closeMessage } = useUI();
  const [saveSettings, { isLoading: isSaving }] = useSaveStoreSettingsMutation();
  useLoading(isSaving);

  const config = resolveScopeConfig(storeConfigs, selectedScope);
  const globalConfig = resolveScopeConfig(storeConfigs, GLOBAL_SCOPE);
  // A store that never saved rules starts from the global ones — the same
  // inheritance the server applies — so the form shows what is in force.
  const stored = useMemo(
    () => toDraft(resolveListingRules(config?.listingRules, globalConfig?.listingRules)),
    [config, globalConfig],
  );

  const [draft, setDraft] = useState<ListingRulesDraft>(stored);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Reset the draft when the drawer opens or the scope changes (render-time
  // state adjustment, same pattern as the blacklist drawer).
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [prevScope, setPrevScope] = useState(selectedScope);
  if (isOpen !== prevOpen || selectedScope !== prevScope) {
    setPrevOpen(isOpen);
    setPrevScope(selectedScope);
    if (isOpen) {
      setDraft(stored);
      setSubmitAttempted(false);
    }
  }

  const patch = (changes: Partial<ListingRulesDraft>): void => setDraft((current) => ({ ...current, ...changes }));

  const minPrice = toPositiveNumber(draft.minPrice);
  const maxPrice = toPositiveNumber(draft.maxPrice);
  const priceInvalid = minPrice !== null && maxPrice !== null && maxPrice < minPrice;
  const coldDays = Number(draft.coldListingDays);
  const coldDaysInvalid =
    draft.coldListingEnabled &&
    !(Number.isInteger(coldDays) && coldDays >= COLD_LISTING_MIN_DAYS && coldDays <= LISTING_CLEANUP_MAX_DAYS);
  const blockedAsins = useMemo(() => parseBlockedAsins(draft.blockedAsins), [draft.blockedAsins]);
  const adRate = Number(draft.promotedAdRate.trim().replace(',', '.'));
  const adRateInvalid =
    draft.promotedEnabled &&
    !(Number.isFinite(adRate) && adRate >= PROMOTED_AD_RATE_MIN && adRate <= PROMOTED_AD_RATE_MAX);

  // eBay decides per STORE whether ads may run, so it is only asked once a
  // store is selected and the seller has switched promotion on.
  const eligibilityStoreId = selectedScope === GLOBAL_SCOPE ? '' : selectedScope;
  const { data: eligibility } = useGetEbayAdvertisingEligibilityQuery(eligibilityStoreId, {
    skip: !isOpen || !draft.promotedEnabled || !eligibilityStoreId,
  });
  const ineligibleReason = eligibility?.status === EBAY_INELIGIBLE ? (eligibility.reason ?? '') : null;

  const handleSave = (): void => {
    setSubmitAttempted(true);
    if (priceInvalid || coldDaysInvalid || adRateInvalid) {
      return;
    }
    const isGlobal = selectedScope === GLOBAL_SCOPE;
    const reviewCount = toPositiveNumber(draft.minReviewCount);
    const listingRules: ListingRulesConfig = {
      veroProtectionEnabled: draft.veroProtectionEnabled,
      hideBrand: draft.hideBrand,
      blockedAsins,
      minSourcePrice: minPrice,
      maxSourcePrice: maxPrice,
      amazonShippedOnly: draft.amazonShippedOnly,
      minRating: toPositiveNumber(draft.minRating),
      minReviewCount: reviewCount === null ? null : Math.floor(reviewCount),
      outOfStockEndDays: toPositiveNumber(draft.outOfStockEndDays),
      coldListingDays: draft.coldListingEnabled ? coldDays : null,
      coldListingAutoEnd: draft.coldListingEnabled && draft.coldListingMode === ColdListingMode.END,
      promotedAdRate: draft.promotedEnabled ? Math.round(adRate * 10) / 10 : null,
    };

    void saveSettings({
      isGlobal,
      storeId: isGlobal ? undefined : selectedScope,
      // Required by the endpoint; a store with no row yet keeps the global rate
      // rather than being created at 0.
      amazonTaxRate: config?.amazonTaxRate ?? globalConfig?.amazonTaxRate ?? 0,
      listingRules,
    })
      .unwrap()
      .then(() => {
        notifyDrawerDone({ onClose, showMessage, closeMessage, t });
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t,
        );
      });
  };

  return (
    <ListingRulesDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      isSaving={isSaving}
      scopeOptions={buildScopeOptions(availableStores, t('translation:settingsHub.drawer.storeSettings.global'))}
      selectedScope={selectedScope}
      onSelectScope={onSelectScope}
      veroProtectionEnabled={draft.veroProtectionEnabled}
      onVeroProtectionChange={(enabled) => patch({ veroProtectionEnabled: enabled })}
      hideBrand={draft.hideBrand}
      onHideBrandChange={(enabled) => patch({ hideBrand: enabled })}
      minPrice={draft.minPrice}
      maxPrice={draft.maxPrice}
      onMinPriceChange={(e) => patch({ minPrice: e.target.value })}
      onMaxPriceChange={(e) => patch({ maxPrice: e.target.value })}
      priceError={
        submitAttempted && priceInvalid ? t('storeSettings:storeSettings.listingRules.filters.priceError') : undefined
      }
      amazonShippedOnly={draft.amazonShippedOnly}
      onAmazonShippedOnlyChange={(enabled) => patch({ amazonShippedOnly: enabled })}
      minRating={draft.minRating}
      ratingOptions={[
        { value: NONE, label: t('storeSettings:storeSettings.listingRules.off') },
        ...RATING_CHOICES.map((value) => ({
          value,
          label: t('storeSettings:storeSettings.listingRules.filters.ratingOption', { rating: value }),
        })),
      ]}
      onMinRatingChange={(value) => patch({ minRating: value })}
      minReviewCount={draft.minReviewCount}
      onMinReviewCountChange={(e) => patch({ minReviewCount: e.target.value })}
      blockedAsins={draft.blockedAsins}
      onBlockedAsinsChange={(e) => patch({ blockedAsins: e.target.value })}
      blockedAsinCount={blockedAsins.length}
      outOfStockEndDays={draft.outOfStockEndDays}
      outOfStockOptions={[
        { value: NONE, label: t('storeSettings:storeSettings.listingRules.cleanup.never') },
        ...Array.from(new Set([...OUT_OF_STOCK_CHOICES, draft.outOfStockEndDays].filter(Boolean)))
          .sort((a, b) => Number(a) - Number(b))
          .map((value) => ({
            value,
            label: t('storeSettings:storeSettings.listingRules.cleanup.afterDays', { count: Number(value) }),
          })),
      ]}
      onOutOfStockEndDaysChange={(value) => patch({ outOfStockEndDays: value })}
      coldListingEnabled={draft.coldListingEnabled}
      onColdListingEnabledChange={(enabled) => patch({ coldListingEnabled: enabled })}
      coldListingDays={draft.coldListingDays}
      onColdListingDaysChange={(e) => patch({ coldListingDays: e.target.value })}
      coldListingDaysError={
        submitAttempted && coldDaysInvalid
          ? t('storeSettings:storeSettings.listingRules.cleanup.coldDaysError', {
            min: COLD_LISTING_MIN_DAYS,
            max: LISTING_CLEANUP_MAX_DAYS,
          })
          : undefined
      }
      coldListingMode={draft.coldListingMode}
      coldListingModeOptions={[ColdListingMode.FLAG, ColdListingMode.END].map((value) => ({
        value,
        label: t(`storeSettings:storeSettings.listingRules.cleanup.coldMode_${value}`),
      }))}
      onColdListingModeChange={(value) =>
        patch({
          coldListingMode:
            Object.values(ColdListingMode).find((mode) => String(mode) === value) ?? ColdListingMode.FLAG,
        })
      }
      promotedEnabled={draft.promotedEnabled}
      onPromotedEnabledChange={(enabled) => patch({ promotedEnabled: enabled })}
      promotedAdRate={draft.promotedAdRate}
      onPromotedAdRateChange={(e) => patch({ promotedAdRate: e.target.value })}
      promotedAdRateError={
        submitAttempted && adRateInvalid
          ? t('storeSettings:storeSettings.listingRules.promoted.rateError', {
            min: PROMOTED_AD_RATE_MIN,
            max: PROMOTED_AD_RATE_MAX,
          })
          : undefined
      }
      promotedIneligibleMessage={
        ineligibleReason === null
          ? ''
          : t(
            KNOWN_INELIGIBLE_REASONS.includes(ineligibleReason)
              ? `storeSettings:storeSettings.listingRules.promoted.ineligible_${ineligibleReason}`
              : 'storeSettings:storeSettings.listingRules.promoted.ineligible',
          )
      }
    />
  );
};

ListingRulesDrawer.displayName = 'ListingRulesDrawer';
