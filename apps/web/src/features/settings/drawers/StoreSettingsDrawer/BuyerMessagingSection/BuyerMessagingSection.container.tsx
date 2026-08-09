import React from 'react';

import { BuyerMessagingSectionComponent } from './BuyerMessagingSection.component';
import type { BuyerMessagingSectionProps } from './BuyerMessagingSection.types';

/**
 * Controlled adapter for the Store Settings flow. Messaging draft ownership
 * and persistence live in StoreSettingsDrawer.container so the drawer's own
 * Continue/Save action is the only save surface.
 */
export const BuyerMessagingSection: React.FC<BuyerMessagingSectionProps> = (props) => (
  <BuyerMessagingSectionComponent {...props} />
);

BuyerMessagingSection.displayName = 'BuyerMessagingSection';
