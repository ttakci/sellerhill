import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { StepperOrientation } from './Stepper.types';

export const StepperContainer = styled.div<{ $orientation: StepperOrientation }>`
  display: flex;
  ${(props) =>
    props.$orientation === 'horizontal'
      ? 'flex-direction: row; align-items: flex-start;'
      : 'flex-direction: column;'}
`;

export const StepWrapper = styled.div<{ $orientation: StepperOrientation }>`
  display: flex;
  ${(props) =>
    props.$orientation === 'horizontal'
      ? 'flex-direction: column; align-items: center; flex: 1; position: relative;'
      : 'flex-direction: row; align-items: flex-start;'}
`;

export const StepCircle = styled.div<{ $status: 'completed' | 'current' | 'upcoming' }>`
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  flex-shrink: 0;

  ${(props) => {
    switch (props.$status) {
      case 'completed':
        return `background: ${tkn('colors.semantic.success')(props)}; color: white;`;
      case 'current':
        return `background: ${tkn('colors.brand.primary')(props)}; color: white;`;
      case 'upcoming':
        return `background: ${tkn('colors.background.tertiary')(props)}; color: ${tkn('colors.text.tertiary')(props)}; border: 0.0625rem solid ${tkn('colors.border.primary')(props)};`;
    }
  }}
`;

export const StepConnector = styled.div<{ $active: boolean; $orientation: StepperOrientation }>`
  ${(props) =>
    props.$orientation === 'horizontal'
      ? `flex: 1; height: 0.125rem; background: ${props.$active ? tkn('colors.semantic.success')(props) : tkn('colors.border.primary')(props)}; margin: 1rem 0.25rem;`
      : `width: 0.125rem; min-height: 1.5rem; background: ${props.$active ? tkn('colors.semantic.success')(props) : tkn('colors.border.primary')(props)}; margin: 0.25rem 0.875rem;`}
`;

export const StepLabel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: ${tkn('spacing.xs')};
  gap: 0.0625rem;

  .step-label {
    font-size: ${tkn('typography.fontSize.xs')};
    font-weight: ${tkn('typography.fontWeight.medium')};
    color: ${tkn('colors.text.primary')};
  }

  .step-description {
    font-size: 0.625rem;
    color: ${tkn('colors.text.tertiary')};
  }
`;

export const HorizontalStepRow = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
`;
