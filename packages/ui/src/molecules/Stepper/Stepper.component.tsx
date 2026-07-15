import React from 'react';

import * as S from './Stepper.style';
import type { StepperProps, StepStatus } from './Stepper.types';

export const Stepper = ({
  steps,
  currentStep,
  orientation = 'horizontal',
  className,
  clickable = false,
  onStepClick,
}: StepperProps): React.ReactElement => {
  const getStatus = (index: number): StepStatus => {
    if (index < currentStep) {
      return 'completed';
    }
    if (index === currentStep) {
      return 'current';
    }
    return 'upcoming';
  };

  const handleStepClick = (index: number) => {
    if (clickable && onStepClick) {
      onStepClick(index);
    }
  };

  return (
    <S.StepperContainer $orientation={orientation} className={className}>
      {steps.map((step, index) => {
        const status = getStatus(index);

        if (orientation === 'horizontal') {
          return (
            <S.StepWrapper key={index} $orientation={orientation}>
              <S.StepLabel $status={status}>
                <span className="step-label">{step.label}</span>
                {step.description && <span className="step-description">{step.description}</span>}
              </S.StepLabel>
              <S.HorizontalStepRow>
                <S.StepCircle
                  $status={status}
                  $clickable={clickable}
                  onClick={clickable ? () => handleStepClick(index) : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleStepClick(index);
                          }
                        }
                      : undefined
                  }
                >
                  {status === 'current' ? index + 1 : ''}
                </S.StepCircle>
                {index < steps.length - 1 && (
                  <S.StepConnector $active={status === 'completed'} $orientation={orientation} />
                )}
              </S.HorizontalStepRow>
            </S.StepWrapper>
          );
        }

        return (
          <S.StepWrapper key={index} $orientation={orientation}>
            <S.StepCircle
              $status={status}
              $clickable={clickable}
              onClick={clickable ? () => handleStepClick(index) : undefined}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleStepClick(index);
                      }
                    }
                  : undefined
              }
            >
              {status === 'current' ? index + 1 : ''}
            </S.StepCircle>
            <div>
              <S.StepLabel $status={status} $noMargin>
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
