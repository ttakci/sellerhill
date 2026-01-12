import type { CreateExampleRequest, CreateExampleFormData } from '@repo/shared';

/**
 * Converts form data to API request
 * 
 * Purpose:
 * - Transforms frontend form data to backend API request format
 * - Applies data transformations (trim, sanitization, etc.)
 * - Separates UI concerns from API contracts
 * 
 * Best Practice:
 * - Always use adapters between form and API
 * - Form data types can differ from API types
 * - Makes refactoring easier
 */
export function toCreateExampleRequest(formData: CreateExampleFormData): CreateExampleRequest {
  return {
    name: formData.name.trim(),
  };
}