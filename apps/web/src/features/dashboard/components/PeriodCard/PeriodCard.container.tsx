/**
 * PeriodCard Container
 * Owns the per-card "more details" disclosure and derives the trend/tier flags.
 */

import React, { useCallback, useMemo, useState } from 'react';

import { PeriodCardComponent } from './PeriodCard.component';
import type { PeriodCardContainerProps } from './PeriodCard.types';

export const PeriodCard = (props: PeriodCardContainerProps): React.ReactElement => {
  const { metrics, formatters, onSelect } = props;
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleDetails = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsExpanded((prev) => !prev);
  }, []);

  const handleSelectKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    },
    [onSelect],
  );

  const derived = useMemo(
    () => ({
      salesTrend: formatters.trend(metrics.trend),
      profitTrend: formatters.trend(metrics.profitTrend),
      salesTrendPositive: (metrics.trend ?? 0) >= 0,
      profitTrendPositive: (metrics.profitTrend ?? 0) >= 0,
      profitPositive: metrics.netProfit >= 0,
      hasEstimated: metrics.profitProvisional !== 0,
      hasUncosted: metrics.revenueUncosted !== 0,
    }),
    [metrics, formatters],
  );

  return (
    <PeriodCardComponent
      {...props}
      isExpanded={isExpanded}
      onSelectKeyDown={handleSelectKeyDown}
      onToggleDetails={handleToggleDetails}
      {...derived}
    />
  );
};
