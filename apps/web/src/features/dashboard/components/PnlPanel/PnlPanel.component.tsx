/**
 * PnlPanel (Presentation)
 * Month-by-month P&L matrix: sticky metric column, grouped sections,
 * emphasized totals and an optional heat map.
 */

import { Button, Card, CardHeader, Icon, Text, Toggle } from '@repo/ui';
import React from 'react';

import * as S from './PnlPanel.style';
import type { PnlPanelComponentProps } from './PnlPanel.types';

export const PnlPanelComponent = ({
  title,
  subtitle,
  parameterLabel,
  heatmapLabel,
  exportLabel,
  emptyLabel,
  columns,
  sections,
  heatmapEnabled,
  onToggleHeatmap,
  onExport,
  isEmpty,
}: PnlPanelComponentProps): React.ReactElement => (
  <Card variant="bordered">
    <CardHeader
      description={
        <Text variant="caption" color="text.tertiary">
          {subtitle}
        </Text>
      }
      actions={
        <S.Toolbar>
          <Toggle checked={heatmapEnabled} onChange={onToggleHeatmap} label={heatmapLabel} />
          <Button variant="tertiary" size="small" onClick={onExport} disabled={isEmpty}>
            <Icon name="file-download" size={16} />
            <Text variant="body-sm" weight="medium" color="inherit">
              {exportLabel}
            </Text>
          </Button>
        </S.Toolbar>
      }
    >
      <Text variant="h4" weight="semibold">
        {title}
      </Text>
    </CardHeader>

    {isEmpty ? (
      <S.EmptyState>
        <Text variant="body-sm" color="text.tertiary">
          {emptyLabel}
        </Text>
      </S.EmptyState>
    ) : (
      <S.Scroll>
        <S.Table>
          <thead>
            <tr>
              <S.Th>
                <Text variant="body-sm" weight="semibold">
                  {parameterLabel}
                </Text>
              </S.Th>
              {columns.map((column, index) => (
                <S.Th key={column} $current={index === 0}>
                  <Text variant="body-sm" weight="semibold">
                    {column}
                  </Text>
                </S.Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <React.Fragment key={section.group}>
                <S.GroupRow>
                  <td colSpan={columns.length + 1}>
                    <Text variant="overline" color="text.tertiary">
                      {section.label}
                    </Text>
                  </td>
                </S.GroupRow>
                {section.rows.map((row) => (
                  <S.Row key={row.key} $emphasis={row.emphasis}>
                    <S.LabelCell>
                      <Text variant="body-sm" weight={row.emphasis ? 'semibold' : 'medium'}>
                        {row.label}
                      </Text>
                    </S.LabelCell>
                    {row.cells.map((cell) => (
                      <S.ValueCell
                        key={cell.key}
                        $intensity={heatmapEnabled ? cell.intensity : 0}
                        $positive={cell.positive}
                      >
                        <Text variant="body-sm" weight={row.emphasis ? 'semibold' : 'regular'}>
                          {cell.value}
                        </Text>
                      </S.ValueCell>
                    ))}
                  </S.Row>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </S.Table>
      </S.Scroll>
    )}
  </Card>
);
