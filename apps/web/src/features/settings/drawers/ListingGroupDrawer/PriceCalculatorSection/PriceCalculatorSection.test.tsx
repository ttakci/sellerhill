import { ThemeProvider } from '@emotion/react';
import { calculateListingPrice, type ListingSettingsGroupFormData } from '@repo/shared';
import { lightTheme } from '@repo/ui';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PriceCalculatorSection } from './PriceCalculatorSection.container';

vi.mock('@repo/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/shared')>();
  return { ...actual, calculateListingPrice: vi.fn(actual.calculateListingPrice) };
});

vi.mock('@/features/store-settings/api/storeSettingsApi', () => ({
  useGetStoreSettingsQuery: () => ({ data: { amazonTaxRate: 0 } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { pct?: string }) =>
      key === 'listingSettingsGroup.calculator.breakdown.adFee' ? `Ad fee (${options?.pct})` : key,
  }),
}));

const Calculator = ({ ebayFeePercent = 10 }: { ebayFeePercent?: number }) => {
  const { control } = useForm<ListingSettingsGroupFormData>({
    defaultValues: {
      repricingStrategy: [{ id: 'range', minPrice: 0, maxPrice: 100, profitMarginPercent: 20 }],
      fees: { ebayFeePercent, fixedFeeAmount: 0 },
    },
  });
  return <PriceCalculatorSection control={control} />;
};

const renderCalculator = (ebayFeePercent?: number) =>
  render(
    <ThemeProvider theme={lightTheme}>
      <Calculator ebayFeePercent={ebayFeePercent} />
    </ThemeProvider>
  );

const priceField = () => screen.getByRole('spinbutton', { name: 'listingSettingsGroup.calculator.amazonPrice' });
const rateField = () => screen.getByRole('spinbutton', { name: 'listingSettingsGroup.calculator.adRate' });
const calculateButton = () => screen.getByRole('button', { name: 'listingSettingsGroup.calculator.calculate' });
const result = () => screen.getByText('listingSettingsGroup.calculator.resultLabel').parentElement?.textContent;

describe('PriceCalculatorSection ad-rate what-if', () => {
  beforeEach(() => {
    vi.mocked(calculateListingPrice).mockClear();
  });

  it('keeps the zero-rate result and shows an ad-fee row at 5% without saving the rate', () => {
    renderCalculator();
    fireEvent.change(priceField(), { target: { value: '20' } });
    fireEvent.click(calculateButton());
    expect(calculateListingPrice).toHaveBeenLastCalledWith(20, expect.any(Array), expect.any(Object), 0, 0);
    const zeroResult = result();
    expect(screen.queryByText(/Ad fee/)).not.toBeInTheDocument();

    fireEvent.change(rateField(), { target: { value: '5' } });
    expect(screen.queryByText('listingSettingsGroup.calculator.resultLabel')).not.toBeInTheDocument();
    fireEvent.click(calculateButton());
    expect(calculateListingPrice).toHaveBeenLastCalledWith(20, expect.any(Array), expect.any(Object), 0, 5);
    expect(screen.getByText('Ad fee (-5%)')).toBeInTheDocument();
    expect(result()).not.toBe(zeroResult);
  });

  it.each(['', '-1', '101', '5.55', 'abc'])('rejects invalid ad rate %s with a field error', (value) => {
    renderCalculator();
    fireEvent.change(priceField(), { target: { value: '20' } });
    fireEvent.change(rateField(), { target: { value } });
    fireEvent.click(calculateButton());
    expect(calculateListingPrice).not.toHaveBeenCalled();
    expect(screen.getByText('listingSettingsGroup.calculator.adRateError')).toBeInTheDocument();
  });

  it('accepts a single decimal place and passes the normalized number', () => {
    renderCalculator();
    fireEvent.change(priceField(), { target: { value: '20' } });
    fireEvent.change(rateField(), { target: { value: '5.5' } });
    fireEvent.click(calculateButton());
    expect(calculateListingPrice).toHaveBeenLastCalledWith(20, expect.any(Array), expect.any(Object), 0, 5.5);
    expect(screen.getByText('Ad fee (-5.5%)')).toBeInTheDocument();
  });

  it('reports an invalid Amazon price on Calculate', () => {
    renderCalculator();
    fireEvent.click(calculateButton());
    expect(calculateListingPrice).not.toHaveBeenCalled();
    expect(screen.getByText('listingSettingsGroup.calculator.amazonPriceError')).toBeInTheDocument();
  });

  it('rejects a combined eBay fee and ad rate of 100% or more', () => {
    renderCalculator(95);
    fireEvent.change(priceField(), { target: { value: '20' } });
    fireEvent.change(rateField(), { target: { value: '5' } });
    fireEvent.click(calculateButton());
    expect(calculateListingPrice).not.toHaveBeenCalled();
    expect(screen.getByText('listingSettingsGroup.calculator.combinedRateError')).toBeInTheDocument();
  });
});
