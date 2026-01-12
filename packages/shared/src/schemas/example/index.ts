/**
 * Example Form Schemas
 * 
 * Central export point for all example-related form schemas
 * All schemas now support i18n for validation messages
 */

// Form Data Types
export type { CreateExampleFormData } from './createExample.formData';
export type { UpdateExampleFormData } from './updateExample.formData';
export type { ListExamplesFilterData } from './listExamples.formData';

// Form Schemas
export { createExampleFormDataSchema } from './createExample.schema';
export { updateExampleFormDataSchema } from './updateExample.schema';
export { listExamplesFilterDataSchema } from './listExamples.schema';
