/**
 * DashboardPage (Presentation)
 * Page shell: header, tab rail, store filter and the active tab panel.
 */

import { DashboardTab } from '@repo/shared';
import { PageHeader } from '@repo/ui';
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
    </S.Toolbar>

    {activeTab === DashboardTab.CHART && <ChartPanel {...chartProps} />}
    {activeTab === DashboardTab.PNL && <PnlPanel {...pnlProps} />}
    {activeTab === DashboardTab.CARDS && <CardsPanel {...cardsProps} />}
  </S.Container>
);
