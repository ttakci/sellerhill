import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { orderStageHasAction, orderStagePresentation } from '../order-stage';

import { OrderStageBadgeComponent } from './OrderStageBadge.component';
import type { OrderStageBadgeProps } from './OrderStageBadge.types';

export const OrderStageBadge: React.FC<OrderStageBadgeProps> = ({
  stage,
  shippedDetectedAt,
  size = 'xs',
  withTooltip = true,
}) => {
  const { t } = useTranslation(['orders']);
  const presentation = useMemo(
    () => orderStagePresentation(stage, { shippedDetectedAt, now: new Date() }),
    [stage, shippedDetectedAt]
  );
  const tooltip = useMemo(() => {
    if (!withTooltip) {
      return null;
    }
    const meaning = t(`orders.stage.${stage}.meaning`);
    return orderStageHasAction(stage) ? `${meaning} ${t(`orders.stage.${stage}.action`)}` : meaning;
  }, [stage, t, withTooltip]);
  return (
    <OrderStageBadgeComponent
      label={t(`orders.stage.${stage}.label`)}
      tooltip={tooltip}
      variant={presentation.variant}
      icon={presentation.icon}
      size={size}
    />
  );
};
