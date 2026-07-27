export interface ParsedSseEvent {
  comment?: string;
  data: string;
  event?: string;
  id?: string;
}

export interface SseParser {
  feed(chunk: string): ParsedSseEvent[];
  flush(): ParsedSseEvent[];
  reset(): void;
}

export function createSseParser(): SseParser {
  let buffer = '';
  let fields: ParsedSseEvent = { data: '' };

  const consume = (flush: boolean): ParsedSseEvent[] => {
    const events: ParsedSseEvent[] = [];
    const lines = buffer.split(/\r\n|\r|\n/);
    buffer = flush ? '' : (lines.pop() ?? '');

    for (const line of lines) {
      if (line === '') {
        if (fields.data !== '' || fields.event || fields.id || fields.comment !== undefined) {
          if (fields.data.endsWith('\n')) {fields.data = fields.data.slice(0, -1);}
          events.push(fields);
        }
        fields = { data: '' };
        continue;
      }
      if (line.startsWith(':')) {
        fields.comment = line.slice(1).trimStart();
        continue;
      }
      const separator = line.indexOf(':');
      const name = separator < 0 ? line : line.slice(0, separator);
      const rawValue = separator < 0 ? '' : line.slice(separator + 1);
      const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
      if (name === 'data') {fields.data += `${value}\n`;}
      else if (name === 'event') {fields.event = value;}
      else if (name === 'id' && !value.includes('\0')) {fields.id = value;}
    }

    if (flush) {
      if (buffer) {
        const remaining = buffer;
        buffer = `${remaining}\n\n`;
        events.push(...consume(false));
      } else if (fields.data !== '' || fields.event || fields.id || fields.comment !== undefined) {
        if (fields.data.endsWith('\n')) {fields.data = fields.data.slice(0, -1);}
        events.push(fields);
        fields = { data: '' };
      }
    }
    return events;
  };

  return {
    feed(chunk) {
      buffer += chunk;
      return consume(false);
    },
    flush() {
      return consume(true);
    },
    reset() {
      buffer = '';
      fields = { data: '' };
    },
  };
}
