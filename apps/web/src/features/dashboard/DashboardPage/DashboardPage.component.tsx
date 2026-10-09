/**
 * DashboardPage (Presentation)
 * Page shell: header, tab rail with the date filter, and the active tab panel.
 */

import { DashboardTab } from '@repo/shared';
import { PageHeader } from '@repo/ui';
import React from 'react';

import { CardsPanel } from '../components/CardsPanel';
import { ChartPanel } from '../components/ChartPanel';
import { PnlPanel } from '../components/PnlPanel';
import { TopSellersPanel } from '../components/TopSellersPanel';

import * as S from './DashboardPage.style';
import type { DashboardPageComponentProps } from './DashboardPage.types';

import type { StatusTabColor } from '@/components/StatusTabs';

/**
 * One colour per tab, in the container's order: cards blue · chart purple ·
 * P&L green (the profit colour) · top sellers amber. The tabs are views, not
 * statuses, so the colours only tell them apart.
 */
const TAB_COLORS: readonly StatusTabColor[] = [
  'colors.brand.primary',
  'colors.badge.purple',
  'colors.semantic.success',
  'colors.semantic.warning',
];

export const DashboardPageComponent = ({
  title,
  subtitle,
  subtitleEmphasis,
  tabs,
  activeTab,
  onTabChange,
  rangePickerProps,
  cardsProps,
  chartProps,
  pnlProps,
  topSellersProps,
}: DashboardPageComponentProps): React.ReactElement => (
  <S.Container>
    <PageHeader
      title={title}
      subtitle={
        subtitleEmphasis && subtitle.includes(subtitleEmphasis) ? (
          <>
            {subtitle.slice(0, subtitle.indexOf(subtitleEmphasis))}
            <strong>{subtitleEmphasis}</strong>
            {subtitle.slice(subtitle.indexOf(subtitleEmphasis) + subtitleEmphasis.length)}
          </>
        ) : (
          subtitle
        )
      }
    />

    <S.Toolbar>
      {/* Shared TabNav — this rail was hand-rolled here while Admin and
          Support faked tabs with Buttons; one implementation now. */}
      <S.Tabs
        $colors={TAB_COLORS}
        items={tabs.map(({ id, label, icon }) => ({ id, label, icon }))}
        value={activeTab}
        onChange={(id) => onTabChange(id as DashboardTab)}
      />
      {rangePickerProps && <S.RangePicker {...rangePickerProps} />}
    </S.Toolbar>

    {activeTab === DashboardTab.CHART && <ChartPanel {...chartProps} />}
    {activeTab === DashboardTab.PNL && <PnlPanel {...pnlProps} />}
    {activeTab === DashboardTab.CARDS && <CardsPanel {...cardsProps} />}
    {activeTab === DashboardTab.TOP_SELLERS && <TopSellersPanel {...topSellersProps} />}
  </S.Container>
);
