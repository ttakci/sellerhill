/**
 * DashboardPage (Presentation)
 * Page shell: header, tab rail, store filter and the active tab panel.
 */

import { DashboardTab } from '@repo/shared';
import { Dropdown, Icon, PageHeader, Text } from '@repo/ui';
import React from 'react';

import { CardsPanel } from '../components/CardsPanel';
import { ChartPanel } from '../components/ChartPanel';
import { PnlPanel } from '../components/PnlPanel';

import * as S from './DashboardPage.style';
import type { DashboardPageComponentProps } from './DashboardPage.types';

export const DashboardPageComponent = ({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  storeSelectorLabel,
  storeSelectorTitle,
  storeItems,
  showStoreSelector,
  cardsProps,
  chartProps,
  pnlProps,
}: DashboardPageComponentProps): React.ReactElement => (
  <S.Container>
    <PageHeader title={title} subtitle={subtitle} />

    <S.Toolbar>
      {/* Shared TabNav — this rail was hand-rolled here while Admin and
          Support faked tabs with Buttons; one implementation now. */}
      <S.Tabs
        items={tabs.map(({ id, label, icon }) => ({ id, label, icon }))}
        value={activeTab}
        onChange={(id) => onTabChange(id as DashboardTab)}
      />

      {showStoreSelector && (
        <S.ToolbarRight>
          <Dropdown
            align="right"
            width="14rem"
            items={storeItems}
            trigger={
              <S.StoreTrigger title={storeSelectorTitle}>
                <Icon name="storefront" size={16} />
                <S.StoreLabel>
                  <Text variant="body-sm" weight="medium" truncate>
                    {storeSelectorLabel}
                  </Text>
                </S.StoreLabel>
                <Icon name="chevron-down" size={14} color="text.tertiary" />
              </S.StoreTrigger>
            }
          />
        </S.ToolbarRight>
      )}
    </S.Toolbar>

    {activeTab === DashboardTab.CHART && <ChartPanel {...chartProps} />}
    {activeTab === DashboardTab.PNL && <PnlPanel {...pnlProps} />}
    {activeTab === DashboardTab.CARDS && <CardsPanel {...cardsProps} />}
  </S.Container>
);
