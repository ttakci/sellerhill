// apps/api/src/modules/llm/sse-parser.ts

export interface ParsedSseEvent {
  /** Raw contents of the `data:` field (may be JSON or `[DONE]`). */
  data: string;
}

/**
 * Incremental SSE parser for OpenAI-compatible chat streams.
 * Feed successive byte chunks; carry `rest` between reads.
 */
export function parseSseChunk(buffer: string): { events: ParsedSseEvent[]; rest: string } {
  const events: ParsedSseEvent[] = [];
  let start = 0;

  for (;;) {
    const sep = buffer.indexOf('\n\n', start);
    if (sep === -1) {
      break;
    }
    const block = buffer.slice(start, sep);
    start = sep + 2;

    const lines = block.split('\n');
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith(':')) {
        continue; // keep-alive / comment
      }
      if (line.startsWith('data:')) {
        // Spec allows optional space after colon
        dataLines.push(line.slice(5).replace(/^\s/, ''));
      }
    }
    if (dataLines.length > 0) {
      events.push({ data: dataLines.join('\n') });
    }
  }

  return { events, rest: buffer.slice(start) };
}
