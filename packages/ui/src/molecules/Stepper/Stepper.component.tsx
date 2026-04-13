import React from 'react';

import { Icon } from '../../atoms/Icon';

import * as S from './Stepper.style';
import type { StepperProps, StepStatus } from './Stepper.types';

export const Stepper = ({
  steps,
  currentStep,
  orientation = 'horizontal',
  className,
}: StepperProps): React.ReactElement => {
  const getStatus = (index: number): StepStatus => {
    if (index < currentStep) {return 'completed';}
    if (index === currentStep) {return 'current';}
    return 'upcoming';
  };

  return (
    <S.StepperContainer $orientation={orientation} className={className}>
      {steps.map((step, index) => {
        const status = getStatus(index);

        if (orientation === 'horizontal') {
          return (
            <S.StepWrapper key={index} $orientation={orientation}>
              <S.HorizontalStepRow>
                <S.StepCircle $status={status}>
                  {status === 'completed' ? <Icon name="check" size="sm" /> : index + 1}
                </S.StepCircle>
                {index < steps.length - 1 && (
                  <S.StepConnector $active={status === 'completed'} $orientation={orientation} />
                )}
              </S.HorizontalStepRow>
              <S.StepLabel>
                <span className="step-label">{step.label}</span>
                {step.description && <span className="step-description">{step.description}</span>}
              </S.StepLabel>
            </S.StepWrapper>
          );
        }

        return (
          <S.StepWrapper key={index} $orientation={orientation}>
            <S.StepCircle $status={status}>
              {status === 'completed' ? <Icon name="check" size="sm" /> : index + 1}
            </S.StepCircle>
            <div>
              <S.StepLabel style={{ marginTop: 0 }}>
                <span className="step-label">{step.label}</span>
                {step.description && <span className="step-description">{step.description}</span>}
              </S.StepLabel>
              {index < steps.length - 1 && (
                <S.StepConnector $active={status === 'completed'} $orientation={orientation} />
              )}
            </div>
          </S.StepWrapper>
        );
      })}
    </S.StepperContainer>
  );
};

Stepper.displayName = 'Stepper';
