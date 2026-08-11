import { ModernTextInput, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './PriceCalculatorSection.style';
import type { PriceCalculatorSectionComponentProps } from './PriceCalculatorSection.types';

const blockNonNumeric = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
    e.preventDefault();
  }
};

/**
 * Unsaved what-if tool: type an Amazon price, see what this group's CURRENT
 * (possibly unsaved) repricing strategy + fees would list it at on eBay.
 * Nothing here is persisted — it reads the live form values, never writes them.
 */
export const PriceCalculatorSectionComponent = ({
  amazonPriceInput,
  onAmazonPriceChange,
  onCalculate,
  isCalculateDisabled,
  breakdown,
}: PriceCalculatorSectionComponentProps): React.ReactElement => {
  const { t } = useTranslation(['listingSettingsGroup', 'translation']);

  return (
    <S.FormCard>
      <Text variant="body-sm" weight="semibold">
        {t('listingSettingsGroup.calculator.title')}
      </Text>
      <Text variant="caption" color="text.secondary">
        {t('listingSettingsGroup.calculator.subtitle')}
      </Text>
      <S.Row>
        <ModernTextInput
          name="calculatorAmazonPrice"
          label={t('listingSettingsGroup.calculator.amazonPrice')}
          type="number"
          suffixText="$"
          size="small"
          value={amazonPriceInput}
          onChange={(e) => onAmazonPriceChange(e.target.value)}
          onKeyDown={blockNonNumeric}
          fullWidth
        />
        <S.CalculateButton
          variant="secondary"
          size="small"
          type="button"
          onClick={onCalculate}
          disabled={isCalculateDisabled}
        >
          <Text weight="semibold">{t('listingSettingsGroup.calculator.calculate')}</Text>
        </S.CalculateButton>
      </S.Row>
      {breakdown.length > 0 && (
        <S.BreakdownList>
          {breakdown.map((row) => (
            <S.BreakdownRow key={row.label} $emphasis={row.emphasis}>
              <Text variant="body-sm" weight={row.emphasis ? 'semibold' : 'regular'} color="text.secondary">
                {row.label}
              </Text>
              <Text
                variant={row.emphasis ? 'metric-sm' : 'body-sm'}
                weight="semibold"
                color={row.emphasis ? 'text.primary' : 'text.secondary'}
                numeric
              >
                {row.value}
              </Text>
            </S.BreakdownRow>
          ))}
        </S.BreakdownList>
      )}
    </S.FormCard>
  );
};

PriceCalculatorSectionComponent.displayName = 'PriceCalculatorSectionComponent';
