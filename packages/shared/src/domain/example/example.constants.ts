export const EXAMPLE_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;

export type ExampleStatus = (typeof EXAMPLE_STATUS)[keyof typeof EXAMPLE_STATUS];
