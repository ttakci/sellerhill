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
  /** Whether steps are clickable. When true, dots render as buttons. */
  clickable?: boolean;
  /** Called with the zero-based step index when a step is clicked. */
  onStepClick?: (index: number) => void;
}
