import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StatusLegendComponent } from './StatusLegend.component';
import type { StatusLegendProps } from './StatusLegend.types';

export const StatusLegend: React.FC<StatusLegendProps> = ({ rows }) => {
  // The labels are the orders page's own legend wording, so a status legend reads the same everywhere.
  const { t } = useTranslation(['orders']);
  const [isOpen, setIsOpen] = useState(false);
  const handleToggle = useCallback(() => setIsOpen((open) => !open), []);
  return (
    <StatusLegendComponent
      rows={rows}
      title={t('orders.stageLegend.title')}
      openLabel={t('orders.stageLegend.open')}
      columnStatus={t('orders.stageLegend.columnStage')}
      columnMeaning={t('orders.stageLegend.columnMeaning')}
      isOpen={isOpen}
      onToggle={handleToggle}
    />
  );
};
