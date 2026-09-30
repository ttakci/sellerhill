import React from 'react';
import { useTranslation } from 'react-i18next';

import { returnBucketPresentation } from '../return-presentation';

import { ReturnBucketBadgeComponent } from './ReturnBucketBadge.component';
import type { ReturnBucketBadgeProps } from './ReturnBucketBadge.types';

export const ReturnBucketBadge: React.FC<ReturnBucketBadgeProps> = ({ bucket, size = 'xs', withTooltip = true }) => {
  const { t } = useTranslation(['returns']);
  const presentation = returnBucketPresentation(bucket);
  return (
    <ReturnBucketBadgeComponent
      label={t(`returns.bucket.${bucket}`)}
      tooltip={withTooltip ? t(`returns.bucketHint.${bucket}`) : null}
      variant={presentation.variant}
      icon={presentation.icon}
      size={size}
    />
  );
};
