import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { StepperOrientation } from './Stepper.types';

export const StepperContainer = styled.div<{ $orientation: StepperOrientation }>`
  display: flex;
  ${(props) =>
    props.$orientation === 'horizontal' ? 'flex-direction: row; align-items: flex-start;' : 'flex-direction: column;'}
`;

export const StepWrapper = styled.div<{ $orientation: StepperOrientation }>`
  display: flex;
  ${(props) =>
    props.$orientation === 'horizontal'
      ? 'flex-direction: column; align-items: center; flex: 1; position: relative; z-index: 1;'
      : 'flex-direction: row; align-items: flex-start; position: relative; z-index: 1;'}
`;

/**
 * Connector line.
 * Horizontal: an absolutely-positioned track sitting at the vertical center of
 * the dots, spanning between the first and last dot centers. It is inset by
 * half a dot width on each side so it never touches the dots — leaving a clear
 * gap. Sits behind the dots (z-index 0 on the container side).
 * Vertical: a track on the left under each dot, with vertical margins so it
 * doesn't touch the dots above/below.
 */
export const StepConnector = styled.div<{ $active: boolean; $orientation: StepperOrientation }>`
  ${(props) =>
    props.$orientation === 'horizontal'
      ? `position: absolute; top: 50%; transform: translateY(-50%); left: calc(50% + 0.375rem); right: calc(-50% + 0.375rem); height: 0.1875rem; border-radius: ${tkn(
          'radius.sm'
        )({ theme: props.theme })}; background: ${
          props.$active ? tkn('colors.brand.primary')(props) : tkn('colors.border.primary')(props)
        }; z-index: 0;`
      : `width: 0.1875rem; min-height: 1.5rem; border-radius: ${tkn('radius.sm')({
          theme: props.theme,
        })}; background: ${
          props.$active ? tkn('colors.brand.primary')(props) : tkn('colors.border.primary')(props)
        }; margin: ${tkn('spacing.xs')(props)} ${tkn('spacing.sm-md+')(props)};`}
`;

export const StepLabel = styled.div<{ $status: 'completed' | 'current' | 'upcoming'; $noMargin?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  ${(props) => (props.$noMargin ? '' : `margin-bottom: ${tkn('spacing.sm')(props)};`)}
  gap: 0.0625rem;
  text-align: center;

  .step-label {
    font-size: ${tkn('typography.fontSize.2xs')};
    font-weight: ${(props) =>
      props.$status === 'current'
        ? tkn('typography.fontWeight.semibold')(props)
        : tkn('typography.fontWeight.normal')(props)};
    color: ${(props) =>
      props.$status === 'current' ? tkn('colors.brand.primary')(props) : tkn('colors.text.tertiary')(props)};
  }

  .step-description {
    font-size: ${tkn('typography.fontSize.2xs')};
    color: ${tkn('colors.text.tertiary')};
  }
`;

export const StepCircle = styled.div<{ $status: 'completed' | 'current' | 'upcoming'; $clickable?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${tkn('typography.fontWeight.semibold')};
  flex-shrink: 0;
  /* Solid surface fill so the connector line behind is masked by the dot. */
  background: ${tkn('colors.surface.primary')};
  z-index: 1;
  transition: all 0.2s ease;

  /* Active step: medium circle with number */
  ${(props) =>
    props.$status === 'current'
      ? `width: 1.5rem; height: 1.5rem; border-radius: 50%; font-size: ${tkn('typography.fontSize.2xs')(
          props
        )}; background: ${tkn('colors.brand.primary')(props)}; border: 0.0625rem solid ${tkn('colors.brand.primary')(
          props
        )}; color: ${tkn('colors.surface.primary')(props)}; box-shadow: 0 0 0 0.1875rem ${tkn('colors.brand.secondary')(
          props
        )};`
      : /* Completed and upcoming: small dots */
        `width: 0.5rem; height: 0.5rem; border-radius: 50%; border: none;`}

  /* Completed dot: filled blue */
  ${(props) => (props.$status === 'completed' ? `background: ${tkn('colors.brand.primary')(props)};` : '')}

  /* Upcoming dot: gray */
  ${(props) => (props.$status === 'upcoming' ? `background: ${tkn('colors.border.primary')(props)};` : '')}

  ${(props) =>
    props.$clickable
      ? `cursor: pointer; &:hover { border-color: ${tkn('colors.brand.primary')(props)}; color: ${tkn(
          'colors.brand.primary'
        )(props)}; }`
      : ''}
`;

export const HorizontalStepRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  position: relative;
  min-height: 1.5rem;
`;
