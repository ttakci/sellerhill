import { AssistantConnectionStatus, AssistantInboxEventType } from '@repo/shared';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';

import { AssistantInboxClient } from '../api/assistantInboxClient';

import { baseApi } from '@/api/baseApi';


export function useAssistantInbox(accessToken: string | null): AssistantConnectionStatus {
  const dispatch = useDispatch();
  const tokenRef = useRef(accessToken);
  const [status, setStatus] = useState(AssistantConnectionStatus.DISCONNECTED);
  tokenRef.current = accessToken;

  useEffect(() => {
    if (!accessToken) {
      setStatus(AssistantConnectionStatus.DISCONNECTED);
      return undefined;
    }

    const client = new AssistantInboxClient({
      accessToken: () => tokenRef.current,
      callbacks: {
        onConnectionStatus: setStatus,
        onEvent: (event) => {
          if (event.eventType === AssistantInboxEventType.DURABLE_EVENT) {
            dispatch(baseApi.util.invalidateTags(['Assistant']));
          }
        },
        onResyncRequired: () => {
          dispatch(baseApi.util.invalidateTags(['Assistant']));
        },
      },
    });
    client.connect();
    return () => client.disconnect();
  }, [accessToken, dispatch]);

  return status;
}
