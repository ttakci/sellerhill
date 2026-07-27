import { generateRequestId } from '@repo/shared';

import { refreshAuthSession } from './authRefreshCoordinator';

export interface AuthenticatedRequestOptions extends RequestInit {
  accessToken: string | null;
  retryOnUnauthorized?: boolean;
}

export interface AuthenticatedResponse {
  requestId: string;
  response: Response;
}

export async function authenticatedRequest(
  input: string | URL,
  options: AuthenticatedRequestOptions
): Promise<AuthenticatedResponse> {
  const { accessToken, retryOnUnauthorized = true, ...requestInit } = options;
  const requestId = generateRequestId();
  const response = await send(input, requestInit, accessToken, requestId);

  if (response.status !== 401 || !retryOnUnauthorized || requestInit.signal?.aborted) {
    return { requestId, response };
  }

  const refreshed = await refreshAuthSession();
  if (!refreshed.success || requestInit.signal?.aborted) {
    return { requestId, response };
  }

  return {
    requestId,
    response: await send(input, requestInit, refreshed.accessToken, requestId),
  };
}

function send(
  input: string | URL,
  init: RequestInit,
  accessToken: string | null,
  requestId: string
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('X-Request-ID', requestId);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetch(input, {
    ...init,
    credentials: init.credentials ?? 'include',
    headers,
    signal: init.signal,
  });
}
