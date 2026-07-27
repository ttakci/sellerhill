# Zon Assistant SSE Protocol

Zon uses two authenticated Server-Sent Event streams. Both use normal bearer authentication headers and HttpOnly-cookie refresh; tokens must never be placed in URLs.

## Generation stream

Initial message:

```http
POST /api/v1/assistant/conversations/:id/messages/stream
Content-Type: application/json
Authorization: Bearer <access-token>

{"clientMessageId":"<uuid>","content":"..."}
```

Retry of an incomplete assistant response:

```http
POST /api/v1/assistant/conversations/:id/messages/:userMessageId/retry-stream
```

Events use the shared `AssistantStreamEventType` enum. The normal lifecycle is:

1. `stream_started`
2. `user_message_accepted`
3. `assistant_message_started`
4. zero or more `assistant_message_snapshot`
5. optional `citations_ready` or `handoff_offered`
6. `assistant_message_completed` or `assistant_message_incomplete`
7. `stream_completed`

Additional terminal/error signals include `rate_limited` and `error`.

### Terminal rule

A successful generation requires both:

- `assistant_message_completed`
- `stream_completed`

A socket close alone is not success. If completion was not observed, preserve the durable incomplete state and offer the dedicated retry flow rather than blindly resending the original customer message.

Snapshots carry a revision. Clients must replace the current partial value only with an equal or newer revision; token-by-token concatenation is not the wire contract.

The server writes 15-second heartbeat comments. Comments are connectivity signals, not business events.

## Inbox stream

```http
GET /api/v1/assistant/events?after=<signed-cursor>
Authorization: Bearer <access-token>
```

The `after` value is a signed replay cursor, not a token. Keep it in memory. The server can rotate it during a live connection.

Inbox event types:

- `durable_event` — persisted conversation/message/assignment/read/availability metadata.
- `ephemeral_event` — snapshots, typing, or presence hints that need not survive reconnect.
- `resync_required` — cursor invalid, expired, or outside retention; discard local cursor and refetch REST state.
- `auth_expired` — refresh authentication once and reconnect with the last valid cursor.

The server sends 20-second heartbeat comments. Cursor rotation is independent of heartbeats.

## Reconnect behavior

Frontend reconnect delays are bounded exponential backoff with jitter: approximately 1s, 2s, 5s, 10s, then a 30s ceiling. Browser `online` is an early-retry hint, not proof that the API is reachable.

On reconnect:

1. Preserve the last signed inbox cursor in memory.
2. If the initial request returns 401, use the shared single-flight refresh coordinator and retry once.
3. On `auth_expired`, refresh once and reconnect.
4. On `resync_required`, clear the cursor and invalidate/refetch assistant REST caches.
5. Unknown event types must not crash the client; ignore or log them safely and continue.

## Framing

The frontend parser supports incremental chunks, LF, CRLF, comments, IDs, and multi-line `data:` fields. Do not use the backend LLM provider parser in the browser; the frontend parser is `apps/web/src/features/assistant/api/sseParser.ts`.
