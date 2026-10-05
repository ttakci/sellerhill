import { ThemeProvider } from '@emotion/react';
import { OrderStage } from '@repo/shared';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { Badge } from '../../../../../../packages/ui/src/atoms/Badge/Badge.component';
import { darkTheme, lightTheme } from '../../../../../../packages/ui/src/theme/themes';

import { orderStagePresentation } from './order-stage';

function normalizedColor(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.append(probe);
  const normalized = getComputedStyle(probe).color;
  probe.remove();
  return normalized;
}

describe('PURCHASE_UNKNOWN badge contrast', () => {
  it.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ])('uses sidebar text on its solid navy fill in %s mode', (_mode, theme) => {
    render(
      <ThemeProvider theme={theme}>
        <Badge variant="solidNavy" solid>
          Purchase unknown
        </Badge>
      </ThemeProvider>
    );

    const badge = screen.getByText('Purchase unknown');
    expect(getComputedStyle(badge).backgroundColor).toBe(normalizedColor(theme.colors.sidebar.background));
    expect(getComputedStyle(badge).color).toBe(normalizedColor(theme.colors.sidebar.text));
  });

  it('keeps PURCHASE_UNKNOWN mapped to the solid navy variant', () => {
    expect(orderStagePresentation(OrderStage.PURCHASE_UNKNOWN, { now: new Date() }).variant).toBe('solidNavy');
  });
});
