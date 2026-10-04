import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { orderStageHasAction, SELLER_VISIBLE_ORDER_STAGES } from '../order-stage';

import { OrderStageLegendComponent } from './OrderStageLegend.component';
import type { OrderStageLegendRow } from './OrderStageLegend.types';

export const OrderStageLegend: React.FC = () => {
  const { t } = useTranslation(['orders']);
  const [isOpen, setIsOpen] = useState(false);
  const handleToggle = useCallback(() => setIsOpen((open) => !open), []);
  const rows = useMemo<OrderStageLegendRow[]>(
    () =>
      SELLER_VISIBLE_ORDER_STAGES.map((stage) => ({
        stage,
        meaning: t(`orders.stage.${stage}.meaning`),
        action: orderStageHasAction(stage) ? t(`orders.stage.${stage}.action`) : null,
      })),
    [t]
  );
  return (
    <OrderStageLegendComponent
      rows={rows}
      title={t('orders.stageLegend.title')}
      openLabel={t('orders.stageLegend.open')}
      columnStage={t('orders.stageLegend.columnStage')}
      columnMeaning={t('orders.stageLegend.columnMeaning')}
      columnAction={t('orders.stageLegend.columnAction')}
      isOpen={isOpen}
      onToggle={handleToggle}
    />
  );
};
