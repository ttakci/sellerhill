import { generateCorrelationId, stampJobData } from '@repo/shared';

import { getCorrelation } from './correlation.context';

export function stampCurrentCorrelation<T extends object>(data: T): T & { correlationId?: string } {
  return stampJobData(data, getCorrelation().correlationId ?? generateCorrelationId());
}
