export type ErrorDTO = {
  errorCode: string;
  messageKey: string;
  params?: Record<string, unknown>;
};
