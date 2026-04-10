import React from 'react';

export type StepperOrientation = 'horizontal' | 'vertical';
export type StepStatus = 'completed' | 'current' | 'upcoming';

export interface StepItem {
  label: string;
  description?: string;
}

export interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  orientation?: StepperOrientation;
  className?: string;
}
