import { calculateListingPrice, type ListingPriceBreakdown } from '@repo/shared';
import { formatCurrency } from '@repo/ui';
import React, { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { PriceCalculatorSectionComponent } from './PriceCalculatorSection.component';
import type { PriceBreakdownRow, PriceCalculatorSectionProps } from './PriceCalculatorSection.types';

import { useGetStoreSettingsQuery } from '@/features/store-settings/api/storeSettingsApi';

/** Formats a percent with an explicit sign, e.g. "+8%" / "-13%". */
const signedPercent = (sign: '+' | '-', pct: number): string => `${sign}${pct}%`;

/**
 * Turns the shared formula's intermediate numbers into "show your work" rows —
 * only the steps that actually applied (a $0 fixed fee or an unused tax rate
 * doesn't get a row), each with the exact +/-/% the calculation used.
 */
const buildBreakdownRows = (
  b: ListingPriceBreakdown,
  t: (key: string, opts?: Record<string, unknown>) => string
): PriceBreakdownRow[] => {
  const rows: PriceBreakdownRow[] = [
    { label: t('listingSettingsGroup.calculator.breakdown.amazonPrice'), value: formatCurrency(b.amazonPrice) },
  ];

  if (b.amazonTaxRatePct > 0) {
    rows.push({
      label: t('listingSettingsGroup.calculator.breakdown.tax', { pct: signedPercent('+', b.amazonTaxRatePct) }),
      value: `+${formatCurrency(b.taxAmount)}`,
    });
    rows.push({ label: t('listingSettingsGroup.calculator.breakdown.trueCost'), value: formatCurrency(b.trueCost) });
  }

  if (b.profitMarginPercent > 0) {
    rows.push({
      label: t(
        b.usedFallbackMargin
          ? 'listingSettingsGroup.calculator.breakdown.fallbackMargin'
          : 'listingSettingsGroup.calculator.breakdown.margin',
        { pct: signedPercent('+', b.profitMarginPercent) }
      ),
      value: `+${formatCurrency(b.marginAmount)}`,
    });
  }

  if (b.fixedProfitAmount > 0) {
    rows.push({
      label: t('listingSettingsGroup.calculator.breakdown.fixedProfit'),
      value: `+${formatCurrency(b.fixedProfitAmount)}`,
    });
  }

  rows.push({ label: t('listingSettingsGroup.calculator.breakdown.netTarget'), value: formatCurrency(b.netTarget) });

  if (b.ebayFeePercent > 0) {
    rows.push({
      label: t('listingSettingsGroup.calculator.breakdown.ebayFee', { pct: signedPercent('-', b.ebayFeePercent) }),
      value: `-${formatCurrency(b.ebayFeeAmount)}`,
    });
  }

  if (b.fixedFeeAmount > 0) {
    rows.push({
      label: t('listingSettingsGroup.calculator.breakdown.fixedFee'),
      value: `-${formatCurrency(b.fixedFeeAmount)}`,
    });
  }

  if (b.minPriceFloorApplied) {
    rows.push({
      label: t('listingSettingsGroup.calculator.breakdown.floorApplied'),
      value: formatCurrency(b.priceBeforeFloor),
    });
  }

  rows.push({
    label: t('listingSettingsGroup.calculator.resultLabel'),
    value: formatCurrency(b.finalPrice),
    emphasis: true,
  });

  return rows;
};

/**
 * Reads the group form's LIVE repricingStrategy + fees (unsaved edits
 * included) and the account's global Amazon purchase-tax rate, then runs the
 * exact same pure formula the backend uses (`calculateListingPrice`) entirely
 * client-side — nothing here is saved or sent to the API.
 */
export const PriceCalculatorSection: React.FC<PriceCalculatorSectionProps> = ({ control }) => {
  const { t } = useTranslation(['listingSettingsGroup']);
  const [amazonPriceInput, setAmazonPriceInput] = useState('');
  const [breakdown, setBreakdown] = useState<PriceBreakdownRow[]>([]);

  const repricingStrategy = useWatch({ control, name: 'repricingStrategy' });
  const fees = useWatch({ control, name: 'fees' });
  // Global scope (storeId omitted) — matches how the provisional-profit
  // estimate and the real price calculation both resolve this rate when no
  // specific store is in play.
  const { data: globalSettings } = useGetStoreSettingsQuery({ storeId: undefined });

  const handleAmazonPriceChange = (value: string): void => {
    setAmazonPriceInput(value);
    setBreakdown([]);
  };

  const handleCalculate = (): void => {
    const amazonPrice = Number(amazonPriceInput);
    if (!Number.isFinite(amazonPrice) || amazonPrice <= 0 || !fees) {
      return;
    }
    const amazonTaxRatePct = Number(globalSettings?.amazonTaxRate) || 0;
    const result = calculateListingPrice(amazonPrice, repricingStrategy ?? [], fees, amazonTaxRatePct);
    setBreakdown(buildBreakdownRows(result.breakdown, t));
  };

  const amazonPriceValue = Number(amazonPriceInput);
  const isCalculateDisabled = !Number.isFinite(amazonPriceValue) || amazonPriceValue <= 0;

  return (
    <PriceCalculatorSectionComponent
      amazonPriceInput={amazonPriceInput}
      onAmazonPriceChange={handleAmazonPriceChange}
      onCalculate={handleCalculate}
      isCalculateDisabled={isCalculateDisabled}
      breakdown={breakdown}
    />
  );
};

PriceCalculatorSection.displayName = 'PriceCalculatorSection';
