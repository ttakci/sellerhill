import { describe, expect, it } from 'vitest';

import { createSseParser } from './sseParser';

describe('createSseParser', () => {
  it('parses incremental LF events and comments', () => {
    const parser = createSseParser();
    expect(parser.feed(': heart')).toEqual([]);
    expect(parser.feed('beat\n\nevent: ready\ndata: {"ok":true}\n\n')).toEqual([
      { comment: 'heartbeat', data: '' },
      { data: '{"ok":true}', event: 'ready' },
    ]);
  });

  it('parses CRLF and joins multi-line data', () => {
    const parser = createSseParser();
    expect(parser.feed('id: 7\r\nevent: snapshot\r\ndata: first\r\ndata: second\r\n\r\n')).toEqual([
      { data: 'first\nsecond', event: 'snapshot', id: '7' },
    ]);
  });

  it('flushes an unterminated final event', () => {
    const parser = createSseParser();
    parser.feed('event: final\ndata: done');
    expect(parser.flush()).toEqual([{ data: 'done', event: 'final' }]);
  });
});
