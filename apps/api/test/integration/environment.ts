const TEST_DATABASE_MARKER = '_zonds_test';

export function assertSafeIntegrationDatabase(databaseName: string): void {
  if (!databaseName.toLowerCase().includes(TEST_DATABASE_MARKER)) {
    throw new Error(`Integration database name must include ${TEST_DATABASE_MARKER}`);
  }
}
