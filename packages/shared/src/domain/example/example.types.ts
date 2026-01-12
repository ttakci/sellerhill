import type { ExampleStatus } from './example.constants';

/**
 * Example domain entity
 * Represents the business domain model
 */
export type ExampleEntity = {
  id: string;
  name: string;
  status: ExampleStatus;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Example aggregate root
 * Can include related entities and value objects
 */
export type ExampleAggregate = {
  example: ExampleEntity;
  // Add related entities here as needed
};
